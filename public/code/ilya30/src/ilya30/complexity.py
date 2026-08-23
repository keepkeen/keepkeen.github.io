"""Computable proxies for MDL/complexity examples, carefully named as proxies."""

from __future__ import annotations

import math
import zlib
from collections.abc import Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def _bytes(data: bytes | bytearray | str | ArrayLike) -> bytes:
    if isinstance(data, bytes):
        return data
    if isinstance(data, bytearray):
        return bytes(data)
    if isinstance(data, str):
        return data.encode("utf-8")
    return np.ascontiguousarray(np.asarray(data)).tobytes()


def zlib_codelength(data: bytes | bytearray | str | ArrayLike, level: int = 9) -> int:
    """Return a zlib length in bits: a computable upper-bound proxy, not ``K(x)``."""

    if not 0 <= level <= 9:
        raise ValueError("zlib level must lie in [0, 9]")
    return 8 * len(zlib.compress(_bytes(data), level))


def empirical_entropy(symbols: ArrayLike, base: float = 2.0) -> float:
    """Empirical zero-order Shannon entropy per symbol."""

    values = np.asarray(symbols).ravel()
    if values.size == 0:
        return 0.0
    if base <= 0 or base == 1:
        raise ValueError("base must be positive and unequal to one")
    _, counts = np.unique(values, return_counts=True)
    probabilities = counts / values.size
    return float(-np.sum(probabilities * np.log(probabilities)) / np.log(base))


def bernoulli_nml_normalizer(sample_size: int) -> float:
    """Parametric-complexity normalizer for Bernoulli NML at fixed length."""

    if sample_size < 0:
        raise ValueError("sample_size cannot be negative")
    if sample_size == 0:
        return 1.0
    total = 0.0
    n = sample_size
    for successes in range(n + 1):
        probability = successes / n
        if successes == 0:
            maximum_likelihood = 1.0
        elif successes == n:
            maximum_likelihood = 1.0
        else:
            maximum_likelihood = probability**successes * (1.0 - probability) ** (n - successes)
        total += math.comb(n, successes) * maximum_likelihood
    return total


def bernoulli_nml_probability(bits: Sequence[int]) -> float:
    """NML probability of one binary sequence under the Bernoulli model class."""

    sequence = np.asarray(bits, dtype=int)
    if sequence.ndim != 1 or np.any((sequence != 0) & (sequence != 1)):
        raise ValueError("bits must be a one-dimensional binary sequence")
    n = sequence.size
    if n == 0:
        return 1.0
    successes = int(np.sum(sequence))
    if successes in (0, n):
        likelihood = 1.0
    else:
        probability = successes / n
        likelihood = probability**successes * (1.0 - probability) ** (n - successes)
    return likelihood / bernoulli_nml_normalizer(n)


def bernoulli_nml_codelength(bits: Sequence[int], base: float = 2.0) -> float:
    """Ideal NML codelength for one binary sequence."""

    if base <= 0 or base == 1:
        raise ValueError("base must be positive and unequal to one")
    return float(-np.log(bernoulli_nml_probability(bits)) / np.log(base))


def two_part_codelength(model_bits: float, data_given_model_bits: float) -> float:
    """Add the two explicit parts of a crude MDL code."""

    if model_bits < 0 or data_given_model_bits < 0:
        raise ValueError("codelengths cannot be negative")
    return float(model_bits + data_given_model_bits)


def finite_set_two_part_codelength(model_bits: float, cardinality: int) -> float:
    """Compute ``model_bits + log2(cardinality)`` for an explicit finite set model."""

    if cardinality <= 0:
        raise ValueError("cardinality must be positive")
    return two_part_codelength(model_bits, math.log2(cardinality))


def randomness_deficiency(log_cardinality: float, conditional_codelength: float) -> float:
    """Finite-model proxy ``log|A| - C(x|A)`` supplied in matching units."""

    if log_cardinality < 0 or conditional_codelength < 0:
        raise ValueError("length arguments cannot be negative")
    return float(log_cardinality - conditional_codelength)


def block_coarse_grain(
    grid: ArrayLike,
    block_size: int | tuple[int, int],
    *,
    threshold: float | None = 0.5,
) -> FloatArray:
    """Average non-overlapping blocks, optionally thresholding the averages.

    Dimensions must divide exactly so that changing boundary policy cannot create a
    hidden apparent-complexity artifact.
    """

    values = np.asarray(grid, dtype=float)
    if values.ndim != 2:
        raise ValueError("grid must be two-dimensional")
    if isinstance(block_size, int):
        block_h = block_w = block_size
    else:
        block_h, block_w = block_size
    if block_h <= 0 or block_w <= 0:
        raise ValueError("block sizes must be positive")
    height, width = values.shape
    if height % block_h or width % block_w:
        raise ValueError("grid dimensions must be exactly divisible by block_size")
    means = values.reshape(height // block_h, block_h, width // block_w, block_w).mean(axis=(1, 3))
    if threshold is None:
        return means
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must lie in [0, 1]")
    return (means >= threshold).astype(float)


def coffee_initial_state(height: int, width: int, cream_fraction: float = 0.5) -> NDArray[np.int8]:
    """Create a separated binary cup with cream occupying the top fraction."""

    if height <= 0 or width <= 0 or not 0.0 <= cream_fraction <= 1.0:
        raise ValueError("dimensions must be positive and cream_fraction in [0, 1]")
    state = np.zeros((height, width), dtype=np.int8)
    cream_rows = int(round(height * cream_fraction))
    state[:cream_rows] = 1
    return state


def coffee_automaton_step(
    state: ArrayLike,
    *,
    rng: np.random.Generator | None = None,
    attempted_swaps: int | None = None,
) -> NDArray[np.int8]:
    """Perform random nearest-neighbor swaps with periodic boundaries.

    This is an interacting exclusion-style toy rule.  Every operation is a swap, so
    particle count is exactly conserved.  It is not claimed to produce a complexity
    peak—the original paper's claim for this rule was retracted.
    """

    grid = np.asarray(state, dtype=np.int8)
    if grid.ndim != 2 or np.any((grid != 0) & (grid != 1)):
        raise ValueError("state must be a two-dimensional binary grid")
    generator = np.random.default_rng() if rng is None else rng
    output = grid.copy()
    attempts = output.size if attempted_swaps is None else attempted_swaps
    if attempts < 0:
        raise ValueError("attempted_swaps cannot be negative")
    directions = ((-1, 0), (1, 0), (0, -1), (0, 1))
    height, width = output.shape
    for _ in range(attempts):
        row = int(generator.integers(height))
        column = int(generator.integers(width))
        delta_row, delta_column = directions[int(generator.integers(4))]
        neighbor = ((row + delta_row) % height, (column + delta_column) % width)
        output[row, column], output[neighbor] = output[neighbor], output[row, column]
    return output


def simulate_coffee(
    initial_state: ArrayLike,
    steps: int,
    *,
    seed: int | None = None,
    attempted_swaps_per_step: int | None = None,
) -> NDArray[np.int8]:
    """Return the initial state and all subsequent exclusion-process states."""

    if steps < 0:
        raise ValueError("steps cannot be negative")
    generator = np.random.default_rng(seed)
    current = np.asarray(initial_state, dtype=np.int8).copy()
    history = [current.copy()]
    for _ in range(steps):
        current = coffee_automaton_step(
            current,
            rng=generator,
            attempted_swaps=attempted_swaps_per_step,
        )
        history.append(current.copy())
    return np.stack(history)
