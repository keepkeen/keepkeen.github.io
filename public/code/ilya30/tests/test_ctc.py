import numpy as np
import pytest

from ilya30.ctc import (
    brute_force_ctc_probability,
    collapse_path,
    ctc_log_probability,
    ctc_loss,
)


def test_ctc_collapse_merges_before_removing_blank():
    assert collapse_path([1, 1, 0, 1, 2, 2, 0], blank=0) == (1, 1, 2)
    assert collapse_path([0, 0, 1, 0, 0], blank=0) == (1,)


@pytest.mark.parametrize("labels", [(), (1,), (1, 2), (1, 1)])
def test_log_space_dynamic_program_matches_path_enumeration(labels):
    probabilities = np.array(
        [
            [0.4, 0.5, 0.1],
            [0.3, 0.2, 0.5],
            [0.2, 0.6, 0.2],
            [0.5, 0.2, 0.3],
        ]
    )
    brute_force = brute_force_ctc_probability(probabilities, labels)
    dynamic = np.exp(ctc_log_probability(np.log(probabilities), labels))
    np.testing.assert_allclose(dynamic, brute_force, rtol=1e-12, atol=1e-12)


def test_repeated_target_needs_an_intervening_blank():
    log_probabilities = np.log(np.array([[0.1, 0.9], [0.1, 0.9]]))
    assert np.isneginf(ctc_log_probability(log_probabilities, [1, 1]))
    three_steps = np.log(np.array([[0.1, 0.9], [0.9, 0.1], [0.1, 0.9]]))
    assert np.isfinite(ctc_log_probability(three_steps, [1, 1]))


def test_empty_target_has_only_all_blank_path():
    probabilities = np.array([[0.6, 0.4], [0.7, 0.3], [0.8, 0.2]])
    expected = np.prod(probabilities[:, 0])
    np.testing.assert_allclose(np.exp(ctc_log_probability(np.log(probabilities), [])), expected)
    np.testing.assert_allclose(ctc_loss(np.log(probabilities), []), -np.log(expected))


def test_invalid_blank_target_is_rejected():
    with pytest.raises(ValueError, match="non-blank"):
        ctc_log_probability(np.log(np.full((2, 2), 0.5)), [0])
