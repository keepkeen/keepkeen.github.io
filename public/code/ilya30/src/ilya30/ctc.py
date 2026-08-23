"""A log-space Connectionist Temporal Classification forward algorithm."""

from __future__ import annotations

import itertools
from collections.abc import Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def logsumexp(values: ArrayLike) -> float:
    """Stable scalar log-sum-exp, including the all-negative-infinity case."""

    array = np.asarray(values, dtype=float)
    if array.size == 0:
        return -np.inf
    maximum = float(np.max(array))
    if np.isneginf(maximum):
        return -np.inf
    return float(maximum + np.log(np.sum(np.exp(array - maximum))))


def collapse_path(path: Sequence[int], blank: int = 0) -> tuple[int, ...]:
    """Apply the CTC map: merge adjacent repeats, then remove blanks."""

    collapsed: list[int] = []
    previous: int | None = None
    for symbol in path:
        current = int(symbol)
        if current != previous:
            collapsed.append(current)
        previous = current
    return tuple(symbol for symbol in collapsed if symbol != blank)


def _extended_labels(labels: Sequence[int], blank: int) -> NDArray[np.int_]:
    output = np.full(2 * len(labels) + 1, blank, dtype=int)
    output[1::2] = np.asarray(labels, dtype=int)
    return output


def ctc_log_probability(
    log_probabilities: ArrayLike,
    labels: Sequence[int],
    blank: int = 0,
) -> float:
    """Sum log probabilities of all paths that collapse to ``labels``.

    ``log_probabilities`` has shape ``(time, classes)``.  Adjacent repeated target
    symbols may only be reached through an intervening blank state.
    """

    log_probs = np.asarray(log_probabilities, dtype=float)
    if log_probs.ndim != 2:
        raise ValueError("log_probabilities must have shape (time, classes)")
    time_steps, classes = log_probs.shape
    if not 0 <= blank < classes:
        raise ValueError("blank index is outside the class axis")
    target = tuple(int(label) for label in labels)
    if any(label == blank or label < 0 or label >= classes for label in target):
        raise ValueError("target labels must be valid non-blank class indices")
    if time_steps == 0:
        return 0.0 if not target else -np.inf
    if not target:
        return float(np.sum(log_probs[:, blank]))

    extended = _extended_labels(target, blank)
    states = extended.size
    alpha = np.full((time_steps, states), -np.inf, dtype=float)
    alpha[0, 0] = log_probs[0, blank]
    alpha[0, 1] = log_probs[0, extended[1]]

    for time in range(1, time_steps):
        for state, symbol in enumerate(extended):
            predecessors = [alpha[time - 1, state]]
            if state > 0:
                predecessors.append(alpha[time - 1, state - 1])
            if (
                state > 1
                and symbol != blank
                and symbol != extended[state - 2]
            ):
                predecessors.append(alpha[time - 1, state - 2])
            alpha[time, state] = log_probs[time, symbol] + logsumexp(predecessors)
    return logsumexp(alpha[-1, -2:])


def ctc_loss(
    log_probabilities: ArrayLike,
    labels: Sequence[int],
    blank: int = 0,
) -> float:
    """Negative CTC log-likelihood."""

    return -ctc_log_probability(log_probabilities, labels, blank)


def brute_force_ctc_probability(
    probabilities: ArrayLike,
    labels: Sequence[int],
    blank: int = 0,
) -> float:
    """Enumerate paths for tiny tests; exponential and intentionally not scalable."""

    probs = np.asarray(probabilities, dtype=float)
    if probs.ndim != 2:
        raise ValueError("probabilities must have shape (time, classes)")
    if probs.shape[0] > 10:
        raise ValueError("brute-force enumeration is restricted to at most ten steps")
    target = tuple(int(label) for label in labels)
    total = 0.0
    for path in itertools.product(range(probs.shape[1]), repeat=probs.shape[0]):
        if collapse_path(path, blank) == target:
            total += float(np.prod(probs[np.arange(probs.shape[0]), path]))
    return total
