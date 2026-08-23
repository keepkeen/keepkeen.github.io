"""Permutation-aware set encoders and attention readouts."""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .attention import softmax


FloatArray = NDArray[np.floating]


def shared_encode(
    elements: ArrayLike,
    encoder: Callable[[FloatArray], ArrayLike],
) -> FloatArray:
    """Apply the same encoder to every element without using its list position."""

    values = np.asarray(elements, dtype=float)
    if values.ndim != 2:
        raise ValueError("elements must have shape (set_size, features)")
    return np.stack([np.asarray(encoder(element), dtype=float) for element in values])


def sum_pool(elements: ArrayLike, mask: ArrayLike | None = None) -> FloatArray:
    """Permutation-invariant sum pooling."""

    values = np.asarray(elements, dtype=float)
    if values.ndim != 2:
        raise ValueError("elements must have shape (set_size, features)")
    if mask is None:
        return np.sum(values, axis=0)
    allowed = np.asarray(mask, dtype=bool)
    if allowed.shape != (values.shape[0],):
        raise ValueError("mask must contain one value per set element")
    return np.sum(values[allowed], axis=0)


def mean_pool(elements: ArrayLike, mask: ArrayLike | None = None) -> FloatArray:
    """Permutation-invariant mean pooling with an explicit empty-set error."""

    values = np.asarray(elements, dtype=float)
    if mask is None:
        selected = values
    else:
        allowed = np.asarray(mask, dtype=bool)
        if allowed.shape != (values.shape[0],):
            raise ValueError("mask must contain one value per set element")
        selected = values[allowed]
    if selected.shape[0] == 0:
        raise ValueError("cannot average an empty set")
    return np.mean(selected, axis=0)


def attention_read(
    elements: ArrayLike,
    query: ArrayLike,
    *,
    mask: ArrayLike | None = None,
    temperature: float = 1.0,
) -> tuple[FloatArray, FloatArray]:
    """Read a set with dot-product attention.

    Reordering elements reorders the returned weights but leaves the read vector
    unchanged, provided the same permutation is applied to the mask.
    """

    values = np.asarray(elements, dtype=float)
    q = np.asarray(query, dtype=float)
    if values.ndim != 2 or q.shape != (values.shape[1],):
        raise ValueError("query must have the same feature dimension as set elements")
    if temperature <= 0:
        raise ValueError("temperature must be positive")
    weights = softmax(values @ q / temperature, mask=mask)
    return weights @ values, weights


def set2set_read(
    elements: ArrayLike,
    initial_query: ArrayLike,
    steps: int,
    update_query: Callable[[FloatArray, FloatArray], ArrayLike],
    *,
    mask: ArrayLike | None = None,
) -> tuple[FloatArray, FloatArray]:
    """Iteratively attend to a set, abstracting the recurrent query update.

    This is the order-invariant read half of Set2Set.  The caller supplies the
    recurrent update so the function stays focused on the set invariant.
    """

    if steps <= 0:
        raise ValueError("steps must be positive")
    query = np.asarray(initial_query, dtype=float)
    reads: list[FloatArray] = []
    for _ in range(steps):
        read_vector, _ = attention_read(elements, query, mask=mask)
        reads.append(read_vector)
        query = np.asarray(update_query(query, read_vector), dtype=float)
    return query, np.stack(reads)
