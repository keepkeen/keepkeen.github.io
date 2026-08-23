"""Minimal recurrent, dropout and additive-attention mechanisms."""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .attention import softmax


FloatArray = NDArray[np.floating]


def sigmoid(values: ArrayLike) -> FloatArray:
    """Numerically stable logistic sigmoid."""

    x = np.asarray(values, dtype=float)
    output = np.empty_like(x)
    positive = x >= 0
    output[positive] = 1.0 / (1.0 + np.exp(-x[positive]))
    exp_x = np.exp(x[~positive])
    output[~positive] = exp_x / (1.0 + exp_x)
    return output


def rnn_step(
    inputs: ArrayLike,
    previous_hidden: ArrayLike,
    input_weights: ArrayLike,
    recurrent_weights: ArrayLike,
    bias: ArrayLike,
) -> FloatArray:
    """One ``tanh`` RNN step using row-vector batches."""

    x = np.asarray(inputs, dtype=float)
    h = np.asarray(previous_hidden, dtype=float)
    w_x = np.asarray(input_weights, dtype=float)
    w_h = np.asarray(recurrent_weights, dtype=float)
    b = np.asarray(bias, dtype=float)
    return np.tanh(x @ w_x + h @ w_h + b)


def rnn_forward(
    sequence: ArrayLike,
    initial_hidden: ArrayLike,
    input_weights: ArrayLike,
    recurrent_weights: ArrayLike,
    bias: ArrayLike,
) -> FloatArray:
    """Unroll :func:`rnn_step` over the first (time) axis."""

    inputs = np.asarray(sequence, dtype=float)
    hidden = np.asarray(initial_hidden, dtype=float)
    outputs = []
    for current in inputs:
        hidden = rnn_step(current, hidden, input_weights, recurrent_weights, bias)
        outputs.append(hidden)
    return np.stack(outputs) if outputs else np.empty((0,) + hidden.shape)


def lstm_step(
    inputs: ArrayLike,
    previous_hidden: ArrayLike,
    previous_cell: ArrayLike,
    weights: ArrayLike,
    bias: ArrayLike,
) -> tuple[FloatArray, FloatArray, dict[str, FloatArray]]:
    """One LSTM step with packed gates ordered ``input, forget, candidate, output``.

    ``weights`` has shape ``(input_dim + hidden_dim, 4 * hidden_dim)``.  The gate
    dictionary is returned to make inspection and invariant tests straightforward.
    """

    x = np.asarray(inputs, dtype=float)
    h = np.asarray(previous_hidden, dtype=float)
    cell = np.asarray(previous_cell, dtype=float)
    packed = np.concatenate((x, h), axis=-1) @ np.asarray(weights, dtype=float)
    packed = packed + np.asarray(bias, dtype=float)
    if packed.shape[-1] != 4 * h.shape[-1]:
        raise ValueError("weights must produce four values per hidden feature")
    input_pre, forget_pre, candidate_pre, output_pre = np.split(packed, 4, axis=-1)
    gates = {
        "input": sigmoid(input_pre),
        "forget": sigmoid(forget_pre),
        "candidate": np.tanh(candidate_pre),
        "output": sigmoid(output_pre),
    }
    next_cell = gates["forget"] * cell + gates["input"] * gates["candidate"]
    next_hidden = gates["output"] * np.tanh(next_cell)
    return next_hidden, next_cell, gates


def lstm_forward(
    sequence: ArrayLike,
    initial_hidden: ArrayLike,
    initial_cell: ArrayLike,
    weights: ArrayLike,
    bias: ArrayLike,
) -> tuple[FloatArray, FloatArray]:
    """Unroll :func:`lstm_step` and return all hidden and cell states."""

    inputs = np.asarray(sequence, dtype=float)
    hidden = np.asarray(initial_hidden, dtype=float)
    cell = np.asarray(initial_cell, dtype=float)
    hidden_states: list[FloatArray] = []
    cell_states: list[FloatArray] = []
    for current in inputs:
        hidden, cell, _ = lstm_step(current, hidden, cell, weights, bias)
        hidden_states.append(hidden)
        cell_states.append(cell)
    empty_shape = (0,) + hidden.shape
    return (
        np.stack(hidden_states) if hidden_states else np.empty(empty_shape),
        np.stack(cell_states) if cell_states else np.empty(empty_shape),
    )


def locked_dropout(
    sequence: ArrayLike,
    drop_probability: float,
    rng: np.random.Generator | None = None,
    *,
    training: bool = True,
) -> tuple[FloatArray, FloatArray]:
    """Apply one inverted-dropout mask shared across the time axis.

    The input convention is ``(time, ..., features)``.  A mask with leading size
    one is returned so callers can verify that every time step receives the same
    pattern.  Set ``training=False`` for the identity operation.
    """

    values = np.asarray(sequence, dtype=float)
    if values.ndim < 2:
        raise ValueError("locked_dropout expects a time axis and at least one feature axis")
    if not 0.0 <= drop_probability < 1.0:
        raise ValueError("drop_probability must lie in [0, 1)")
    mask_shape = (1,) + values.shape[1:]
    if not training or drop_probability == 0.0:
        mask = np.ones(mask_shape, dtype=float)
    else:
        generator = np.random.default_rng() if rng is None else rng
        keep_probability = 1.0 - drop_probability
        mask = (generator.random(mask_shape) < keep_probability) / keep_probability
    return values * mask, mask


def additive_attention(
    query: ArrayLike,
    annotations: ArrayLike,
    query_weights: ArrayLike,
    annotation_weights: ArrayLike,
    score_weights: ArrayLike,
    bias: ArrayLike | None = None,
    mask: ArrayLike | None = None,
) -> tuple[FloatArray, FloatArray]:
    """Bahdanau additive attention for a single query and annotation sequence.

    Shapes are ``query=(Dq,)``, ``annotations=(time, Da)``,
    ``query_weights=(hidden, Dq)``, ``annotation_weights=(hidden, Da)`` and
    ``score_weights=(hidden,)``.
    """

    q = np.asarray(query, dtype=float)
    states = np.asarray(annotations, dtype=float)
    w_q = np.asarray(query_weights, dtype=float)
    w_a = np.asarray(annotation_weights, dtype=float)
    v = np.asarray(score_weights, dtype=float)
    if q.ndim != 1 or states.ndim != 2:
        raise ValueError("additive_attention expects one query and a 2D state sequence")
    projected = states @ w_a.T + q @ w_q.T
    if bias is not None:
        projected = projected + np.asarray(bias, dtype=float)
    scores = np.tanh(projected) @ v
    weights = softmax(scores, mask=mask)
    return weights @ states, weights


def pointer_distribution(
    query: ArrayLike,
    encoder_states: ArrayLike,
    query_weights: ArrayLike,
    state_weights: ArrayLike,
    score_weights: ArrayLike,
    mask: ArrayLike | None = None,
) -> FloatArray:
    """Return attention weights interpreted as a distribution over input positions."""

    _, weights = additive_attention(
        query,
        encoder_states,
        query_weights,
        state_weights,
        score_weights,
        mask=mask,
    )
    return weights
