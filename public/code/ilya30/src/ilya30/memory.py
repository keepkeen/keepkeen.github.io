"""Differentiable memory operators used by NTM, LRUA and RMC explanations."""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .attention import scaled_dot_product_attention, softmax
from .sequence import sigmoid


FloatArray = NDArray[np.floating]


def _probability_vector(weights: ArrayLike, name: str = "weights") -> FloatArray:
    values = np.asarray(weights, dtype=float)
    if values.ndim != 1 or values.size == 0 or np.any(values < 0):
        raise ValueError(f"{name} must be a non-negative one-dimensional vector")
    total = np.sum(values)
    if total <= 0:
        raise ValueError(f"{name} must have positive mass")
    return values / total


def content_weights(
    memory: ArrayLike,
    key: ArrayLike,
    strength: float = 1.0,
    epsilon: float = 1e-12,
) -> FloatArray:
    """Cosine-softmax weights over memory slots."""

    slots = np.asarray(memory, dtype=float)
    query = np.asarray(key, dtype=float)
    if slots.ndim != 2 or query.shape != (slots.shape[1],):
        raise ValueError("key must match the memory feature dimension")
    if strength < 0:
        raise ValueError("strength cannot be negative")
    norms = np.linalg.norm(slots, axis=1) * np.linalg.norm(query)
    similarities = (slots @ query) / np.maximum(norms, epsilon)
    return softmax(strength * similarities)


def interpolate_weights(
    content: ArrayLike,
    previous: ArrayLike,
    gate: float,
) -> FloatArray:
    """Interpolate content and previous addressing weights."""

    if not 0.0 <= gate <= 1.0:
        raise ValueError("gate must lie in [0, 1]")
    content_vector = _probability_vector(content, "content weights")
    previous_vector = _probability_vector(previous, "previous weights")
    if content_vector.shape != previous_vector.shape:
        raise ValueError("content and previous weights must have equal shape")
    return gate * content_vector + (1.0 - gate) * previous_vector


def circular_shift(weights: ArrayLike, shift_distribution: ArrayLike) -> FloatArray:
    """Convolve weights with centered circular shifts.

    For three shift probabilities, indices correspond to shifts ``-1, 0, +1``.
    More generally an odd-length vector spans symmetric integer offsets.
    """

    values = _probability_vector(weights)
    shifts = _probability_vector(shift_distribution, "shift distribution")
    if shifts.size % 2 == 0:
        raise ValueError("shift_distribution must have odd length")
    radius = shifts.size // 2
    output = np.zeros_like(values)
    for probability, offset in zip(shifts, range(-radius, radius + 1), strict=True):
        output += probability * np.roll(values, offset)
    return output


def sharpen(weights: ArrayLike, gamma: float) -> FloatArray:
    """Sharpen a probability vector using exponent ``gamma >= 1``."""

    if gamma < 1.0:
        raise ValueError("gamma must be at least one")
    values = _probability_vector(weights)
    powered = np.power(values, gamma)
    return powered / np.sum(powered)


def ntm_address(
    memory: ArrayLike,
    key: ArrayLike,
    *,
    strength: float = 1.0,
    previous_weights: ArrayLike | None = None,
    interpolation_gate: float = 1.0,
    shift_distribution: ArrayLike | None = None,
    gamma: float = 1.0,
) -> FloatArray:
    """Compose the NTM content/interpolate/shift/sharpen addressing pipeline."""

    weights = content_weights(memory, key, strength)
    if previous_weights is not None:
        weights = interpolate_weights(weights, previous_weights, interpolation_gate)
    if shift_distribution is not None:
        weights = circular_shift(weights, shift_distribution)
    return sharpen(weights, gamma)


def read(memory: ArrayLike, weights: ArrayLike) -> FloatArray:
    """Read the convex combination selected by ``weights``."""

    slots = np.asarray(memory, dtype=float)
    distribution = _probability_vector(weights)
    if slots.ndim != 2 or distribution.shape != (slots.shape[0],):
        raise ValueError("weights must contain one value per memory slot")
    return distribution @ slots


def erase_add_write(
    memory: ArrayLike,
    weights: ArrayLike,
    erase_vector: ArrayLike,
    add_vector: ArrayLike,
) -> FloatArray:
    """Apply the NTM erase-then-add write equation."""

    slots = np.asarray(memory, dtype=float)
    distribution = _probability_vector(weights)
    erase = np.asarray(erase_vector, dtype=float)
    addition = np.asarray(add_vector, dtype=float)
    if slots.ndim != 2 or distribution.shape != (slots.shape[0],):
        raise ValueError("weights must contain one value per memory slot")
    if erase.shape != (slots.shape[1],) or addition.shape != (slots.shape[1],):
        raise ValueError("erase and add vectors must match memory width")
    if np.any((erase < 0) | (erase > 1)):
        raise ValueError("erase_vector entries must lie in [0, 1]")
    return slots * (1.0 - np.outer(distribution, erase)) + np.outer(distribution, addition)


def update_usage(
    usage: ArrayLike,
    read_weights: ArrayLike,
    write_weights: ArrayLike,
    decay: float = 0.99,
) -> FloatArray:
    """LRUA usage update ``decay * usage + read + write``."""

    if not 0.0 <= decay <= 1.0:
        raise ValueError("decay must lie in [0, 1]")
    old = np.asarray(usage, dtype=float)
    read_vector = np.asarray(read_weights, dtype=float)
    write_vector = np.asarray(write_weights, dtype=float)
    if old.ndim != 1 or old.shape != read_vector.shape or old.shape != write_vector.shape:
        raise ValueError("usage, read_weights and write_weights must have equal vector shapes")
    return decay * old + read_vector + write_vector


def least_used_weights(usage: ArrayLike, count: int = 1) -> FloatArray:
    """Return equal mass on the ``count`` least-used slots."""

    values = np.asarray(usage, dtype=float)
    if values.ndim != 1 or values.size == 0:
        raise ValueError("usage must be a non-empty vector")
    if not 1 <= count <= values.size:
        raise ValueError("count must lie between one and the number of slots")
    selected = np.argpartition(values, count - 1)[:count]
    weights = np.zeros_like(values)
    weights[selected] = 1.0 / count
    return weights


def lrua_write_weights(
    previous_read_weights: ArrayLike,
    usage: ArrayLike,
    reuse_gate: float,
    *,
    least_used_count: int = 1,
) -> FloatArray:
    """Mix the previous read location with newly allocated least-used slots."""

    if not 0.0 <= reuse_gate <= 1.0:
        raise ValueError("reuse_gate must lie in [0, 1]")
    previous = _probability_vector(previous_read_weights, "previous read weights")
    allocation = least_used_weights(usage, least_used_count)
    if previous.shape != allocation.shape:
        raise ValueError("previous read weights and usage must have equal shape")
    return reuse_gate * previous + (1.0 - reuse_gate) * allocation


def rmc_attention_proposal(
    memory: ArrayLike,
    input_vector: ArrayLike,
    query_weights: ArrayLike,
    key_weights: ArrayLike,
    value_weights: ArrayLike,
) -> tuple[FloatArray, FloatArray]:
    """Make a one-head RMC proposal by attending from slots to slots plus input."""

    slots = np.asarray(memory, dtype=float)
    current_input = np.asarray(input_vector, dtype=float)
    if slots.ndim != 2 or current_input.shape != (slots.shape[1],):
        raise ValueError("input_vector must have the memory width")
    tokens = np.vstack((slots, current_input))
    queries = slots @ np.asarray(query_weights, dtype=float)
    keys = tokens @ np.asarray(key_weights, dtype=float)
    values = tokens @ np.asarray(value_weights, dtype=float)
    return scaled_dot_product_attention(queries, keys, values)


def gated_memory_update(
    memory: ArrayLike,
    proposal: ArrayLike,
    input_gate_logits: ArrayLike,
    forget_gate_logits: ArrayLike,
) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Combine old slots and an attention proposal with LSTM-style gates."""

    slots = np.asarray(memory, dtype=float)
    candidate = np.asarray(proposal, dtype=float)
    if slots.shape != candidate.shape:
        raise ValueError("memory and proposal must have equal shapes")
    input_gate = np.broadcast_to(sigmoid(input_gate_logits), slots.shape)
    forget_gate = np.broadcast_to(sigmoid(forget_gate_logits), slots.shape)
    updated = forget_gate * slots + input_gate * np.tanh(candidate)
    return updated, input_gate, forget_gate
