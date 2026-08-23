import numpy as np
import pytest

from ilya30.attention import (
    causal_mask,
    combine_heads,
    scaled_dot_product_attention,
    sinusoidal_position_encoding,
    softmax,
    split_heads,
)
from ilya30.sequence import (
    additive_attention,
    locked_dropout,
    lstm_step,
    pointer_distribution,
    rnn_forward,
)
from ilya30.vision import numerical_gradient


def test_softmax_is_stable_and_respects_mask():
    scores = np.array([[1_000.0, 1_001.0, -500.0]])
    probabilities = softmax(scores, mask=[[True, True, False]])
    np.testing.assert_allclose(probabilities.sum(axis=-1), 1.0)
    assert probabilities[0, 2] == 0.0
    assert probabilities[0, 1] > probabilities[0, 0]


def test_softmax_rejects_fully_masked_row():
    with pytest.raises(ValueError, match="fully masked"):
        softmax([[1.0, 2.0]], mask=[[False, False]])


def test_causal_scaled_attention_cannot_see_future():
    values = np.eye(4)
    output, weights = scaled_dot_product_attention(
        values,
        values,
        values,
        mask=causal_mask(4),
    )
    assert output.shape == (4, 4)
    np.testing.assert_allclose(weights.sum(axis=-1), 1.0)
    assert np.all(weights[np.triu_indices(4, k=1)] == 0.0)


def test_split_and_combine_heads_are_exact_inverses():
    values = np.arange(2 * 3 * 12).reshape(2, 3, 12)
    np.testing.assert_array_equal(combine_heads(split_heads(values, 3)), values)


def test_sinusoidal_encoding_has_expected_origin():
    encoding = sinusoidal_position_encoding(5, 7)
    np.testing.assert_allclose(encoding[0, 0::2], 0.0)
    np.testing.assert_allclose(encoding[0, 1::2], 1.0)
    assert encoding.shape == (5, 7)


def test_rnn_state_carries_history():
    sequence = np.array([[1.0], [0.0], [0.0]])
    states = rnn_forward(sequence, np.array([0.0]), [[1.0]], [[0.8]], [0.0])
    assert states[0, 0] > states[1, 0] > states[2, 0] > 0.0


def test_rnn_gradient_through_time_matches_chain_rule():
    sequence = np.array([[0.2], [0.0], [0.0]])
    recurrent_weight = 0.8

    def final_state(initial_hidden):
        return float(
            rnn_forward(sequence, initial_hidden, [[0.7]], [[recurrent_weight]], [0.0])[-1, 0]
        )

    hidden = 0.1
    derivative = 1.0
    for current in sequence[:, 0]:
        hidden = np.tanh(0.7 * current + recurrent_weight * hidden)
        derivative *= recurrent_weight * (1.0 - hidden**2)
    numeric = numerical_gradient(final_state, np.array([0.1]))
    np.testing.assert_allclose(numeric, [derivative], rtol=1e-8, atol=1e-8)


def test_lstm_cell_is_preserved_when_forget_open_and_input_closed():
    hidden = np.zeros(2)
    cell = np.array([0.25, -0.4])
    weights = np.zeros((3 + 2, 4 * 2))
    # Packed order is input, forget, candidate, output.
    bias = np.concatenate((np.full(2, -100.0), np.full(2, 100.0), np.zeros(2), np.full(2, 100.0)))
    _, next_cell, gates = lstm_step(np.zeros(3), hidden, cell, weights, bias)
    np.testing.assert_allclose(next_cell, cell, atol=1e-12)
    np.testing.assert_allclose(gates["forget"], 1.0, atol=1e-12)
    np.testing.assert_allclose(gates["input"], 0.0, atol=1e-12)


def test_locked_dropout_reuses_one_mask_across_time():
    sequence = np.ones((8, 3, 20))
    dropped, mask = locked_dropout(sequence, 0.4, np.random.default_rng(7))
    assert mask.shape == (1, 3, 20)
    for time in range(8):
        np.testing.assert_array_equal(dropped[time], mask[0])
    assert np.any(mask == 0.0) and np.any(mask > 1.0)


def test_additive_attention_masks_and_normalizes():
    annotations = np.array([[1.0, 0.0], [0.0, 1.0], [5.0, 5.0]])
    context, weights = additive_attention(
        query=np.array([1.0, 0.0]),
        annotations=annotations,
        query_weights=np.eye(2),
        annotation_weights=np.eye(2),
        score_weights=np.array([2.0, -1.0]),
        mask=np.array([True, True, False]),
    )
    np.testing.assert_allclose(weights.sum(), 1.0)
    assert weights[2] == 0.0
    np.testing.assert_allclose(context, weights @ annotations)
    assert weights[0] > weights[1]


def test_pointer_distribution_is_over_input_positions():
    states = np.eye(3)
    probabilities = pointer_distribution(
        np.array([0.0, 0.0, 2.0]),
        states,
        np.eye(3),
        np.eye(3),
        np.ones(3),
        mask=[True, False, True],
    )
    np.testing.assert_allclose(probabilities.sum(), 1.0)
    assert probabilities[1] == 0.0
