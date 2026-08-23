"""Attention primitives with explicit shapes and masking semantics."""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def softmax(
    values: ArrayLike,
    axis: int = -1,
    mask: ArrayLike | None = None,
) -> FloatArray:
    """Compute a numerically stable softmax.

    ``mask`` is boolean and uses ``True`` for positions that may be attended to.
    It must be broadcastable to ``values``.  Fully masked rows are rejected rather
    than silently producing NaNs or a uniform distribution.
    """

    scores = np.asarray(values, dtype=float)
    if scores.size == 0:
        raise ValueError("softmax is undefined for an empty axis")

    if mask is not None:
        allowed = np.broadcast_to(np.asarray(mask, dtype=bool), scores.shape)
        if np.any(np.all(~allowed, axis=axis)):
            raise ValueError("softmax received a fully masked row")
        scores = np.where(allowed, scores, -np.inf)
    else:
        allowed = None

    maximum = np.max(scores, axis=axis, keepdims=True)
    exponentials = np.exp(scores - maximum)
    if allowed is not None:
        exponentials = np.where(allowed, exponentials, 0.0)
    return exponentials / np.sum(exponentials, axis=axis, keepdims=True)


def causal_mask(query_length: int, key_length: int | None = None) -> NDArray[np.bool_]:
    """Return a mask in which query position ``i`` may see keys ``j <= i``."""

    if query_length <= 0:
        raise ValueError("query_length must be positive")
    key_length = query_length if key_length is None else key_length
    if key_length <= 0:
        raise ValueError("key_length must be positive")
    query_positions = np.arange(query_length)[:, None]
    key_positions = np.arange(key_length)[None, :]
    return key_positions <= query_positions


def scaled_dot_product_attention(
    queries: ArrayLike,
    keys: ArrayLike,
    values: ArrayLike,
    mask: ArrayLike | None = None,
) -> tuple[FloatArray, FloatArray]:
    """Apply scaled dot-product attention over the penultimate sequence axis.

    Expected shapes are ``(..., T_query, D_key)``, ``(..., T_key, D_key)`` and
    ``(..., T_key, D_value)``.  The returned attention weights have shape
    ``(..., T_query, T_key)``.
    """

    q = np.asarray(queries, dtype=float)
    k = np.asarray(keys, dtype=float)
    v = np.asarray(values, dtype=float)
    if q.ndim < 2 or k.ndim < 2 or v.ndim < 2:
        raise ValueError("queries, keys and values must each have at least two axes")
    if q.shape[-1] != k.shape[-1]:
        raise ValueError("query and key feature dimensions must match")
    if k.shape[-2] != v.shape[-2]:
        raise ValueError("keys and values must contain the same number of positions")

    scores = np.matmul(q, np.swapaxes(k, -1, -2)) / np.sqrt(q.shape[-1])
    weights = softmax(scores, axis=-1, mask=mask)
    return np.matmul(weights, v), weights


def split_heads(values: ArrayLike, num_heads: int) -> FloatArray:
    """Convert ``(batch, time, model)`` to ``(batch, heads, time, head_dim)``."""

    x = np.asarray(values, dtype=float)
    if x.ndim != 3:
        raise ValueError("split_heads expects shape (batch, time, model_dim)")
    if num_heads <= 0 or x.shape[-1] % num_heads:
        raise ValueError("model_dim must be divisible by a positive num_heads")
    batch, time, model_dim = x.shape
    head_dim = model_dim // num_heads
    return x.reshape(batch, time, num_heads, head_dim).transpose(0, 2, 1, 3)


def combine_heads(values: ArrayLike) -> FloatArray:
    """Invert :func:`split_heads`."""

    x = np.asarray(values, dtype=float)
    if x.ndim != 4:
        raise ValueError("combine_heads expects shape (batch, heads, time, head_dim)")
    batch, heads, time, head_dim = x.shape
    return x.transpose(0, 2, 1, 3).reshape(batch, time, heads * head_dim)


def sinusoidal_position_encoding(length: int, model_dim: int) -> FloatArray:
    """Return the sinusoidal positional encoding from Vaswani et al. (2017)."""

    if length <= 0 or model_dim <= 0:
        raise ValueError("length and model_dim must be positive")
    positions = np.arange(length, dtype=float)[:, None]
    even_dimensions = np.arange(0, model_dim, 2, dtype=float)
    angles = positions / np.power(10_000.0, even_dimensions / model_dim)
    encoding = np.zeros((length, model_dim), dtype=float)
    encoding[:, 0::2] = np.sin(angles)
    encoding[:, 1::2] = np.cos(angles[:, : encoding[:, 1::2].shape[1]])
    return encoding
