"""Finite toy calculations inspired by universal-intelligence equations."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def environment_weights(description_lengths: ArrayLike, *, normalize: bool = False) -> FloatArray:
    """Convert explicit user-supplied lengths to ``2**(-length)`` weights.

    These lengths are not called Kolmogorov complexities: the real quantities are
    uncomputable and depend on a reference universal machine.
    """

    lengths = np.asarray(description_lengths, dtype=float)
    if lengths.ndim != 1 or lengths.size == 0 or np.any(lengths < 0):
        raise ValueError("description_lengths must be a non-empty non-negative vector")
    weights = np.power(2.0, -lengths)
    if normalize:
        weights = weights / np.sum(weights)
    return weights


def finite_universal_score(
    environment_values: ArrayLike,
    description_lengths: ArrayLike,
    *,
    normalize_weights: bool = False,
) -> FloatArray:
    """Compute ``sum_mu 2**(-length_mu) * V_mu`` over an explicit finite list.

    ``environment_values`` may be one vector or a ``(policies, environments)``
    matrix.  Values are required to lie in ``[0, 1]`` to keep comparisons bounded.
    """

    values = np.asarray(environment_values, dtype=float)
    weights = environment_weights(description_lengths, normalize=normalize_weights)
    if values.ndim not in (1, 2) or values.shape[-1] != weights.size:
        raise ValueError("the final value axis must match the number of environments")
    if np.any((values < 0) | (values > 1)):
        raise ValueError("environment values must lie in [0, 1]")
    return np.matmul(values, weights)


def rank_policies(
    policy_values: ArrayLike,
    description_lengths: ArrayLike,
    names: Sequence[str] | None = None,
) -> list[tuple[str, float]]:
    """Rank policies under the finite toy score, highest first."""

    values = np.asarray(policy_values, dtype=float)
    if values.ndim != 2:
        raise ValueError("policy_values must have shape (policies, environments)")
    labels = [f"policy_{index}" for index in range(values.shape[0])] if names is None else list(names)
    if len(labels) != values.shape[0]:
        raise ValueError("names must contain one label per policy")
    scores = np.asarray(finite_universal_score(values, description_lengths))
    order = np.argsort(-scores)
    return [(labels[index], float(scores[index])) for index in order]
