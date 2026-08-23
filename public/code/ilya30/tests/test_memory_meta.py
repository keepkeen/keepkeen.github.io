import numpy as np

from ilya30.memory import (
    circular_shift,
    content_weights,
    erase_add_write,
    gated_memory_update,
    least_used_weights,
    lrua_write_weights,
    ntm_address,
    read,
    rmc_attention_proposal,
    sharpen,
    update_usage,
)
from ilya30.meta import (
    class_prototypes,
    prototype_linear_logits,
    prototype_logits,
    prototype_probabilities,
    quadratic_maml_step,
    quadratic_meta_gradient,
    quadratic_meta_loss,
    remap_episode_labels,
)


def test_content_addressing_prefers_matching_slot():
    memory = np.eye(3)
    weights = content_weights(memory, np.array([0.0, 1.0, 0.0]), strength=20.0)
    assert np.argmax(weights) == 1
    assert weights[1] > 0.999
    np.testing.assert_allclose(weights.sum(), 1.0)


def test_ntm_shift_wraps_and_sharpen_concentrates():
    shifted = circular_shift([1.0, 0.0, 0.0], [0.0, 0.0, 1.0])
    np.testing.assert_array_equal(shifted, [0.0, 1.0, 0.0])
    broad = np.array([0.6, 0.3, 0.1])
    assert sharpen(broad, 3.0)[0] > broad[0]
    addressed = ntm_address(np.eye(3), [1.0, 0.0, 0.0], strength=10.0)
    np.testing.assert_allclose(addressed.sum(), 1.0)


def test_exact_read_erase_and_add():
    memory = np.array([[1.0, 2.0], [3.0, 4.0]])
    np.testing.assert_array_equal(read(memory, [0.0, 1.0]), [3.0, 4.0])
    erased = erase_add_write(memory, [1.0, 0.0], [1.0, 1.0], [0.0, 0.0])
    np.testing.assert_array_equal(erased, [[0.0, 0.0], [3.0, 4.0]])
    added = erase_add_write(np.zeros_like(memory), [0.0, 1.0], [0.0, 0.0], [5.0, 6.0])
    np.testing.assert_array_equal(added[1], [5.0, 6.0])


def test_lrua_allocates_least_used_or_reuses_last_read():
    usage = np.array([3.0, 0.2, 1.0])
    previous_read = np.array([1.0, 0.0, 0.0])
    np.testing.assert_array_equal(least_used_weights(usage), [0.0, 1.0, 0.0])
    np.testing.assert_array_equal(lrua_write_weights(previous_read, usage, 0.0), [0.0, 1.0, 0.0])
    np.testing.assert_array_equal(lrua_write_weights(previous_read, usage, 1.0), previous_read)
    new_usage = update_usage(usage, [0.0, 1.0, 0.0], [0.0, 1.0, 0.0], decay=0.5)
    np.testing.assert_allclose(new_usage, 0.5 * usage + [0.0, 2.0, 0.0])


def test_rmc_proposal_is_equivariant_to_slot_permutation():
    memory = np.array([[1.0, 0.0], [0.0, 2.0], [-1.0, 1.0]])
    input_vector = np.array([0.5, -0.5])
    identity = np.eye(2)
    proposal, weights = rmc_attention_proposal(memory, input_vector, identity, identity, identity)
    permutation = np.array([2, 0, 1])
    permuted_proposal, permuted_weights = rmc_attention_proposal(
        memory[permutation], input_vector, identity, identity, identity
    )
    np.testing.assert_allclose(permuted_proposal, proposal[permutation])
    np.testing.assert_allclose(permuted_weights[:, -1], weights[permutation, -1])
    np.testing.assert_allclose(permuted_weights[:, :-1], weights[permutation][:, permutation])
    changed, _ = rmc_attention_proposal(memory, -input_vector, identity, identity, identity)
    assert not np.allclose(changed, proposal)


def test_gated_memory_update_preserves_shape_and_gate_limits():
    memory = np.ones((2, 3))
    proposal = np.full((2, 3), 2.0)
    updated, input_gate, forget_gate = gated_memory_update(memory, proposal, 100.0, -100.0)
    np.testing.assert_allclose(updated, np.tanh(proposal), atol=1e-12)
    np.testing.assert_allclose(input_gate, 1.0, atol=1e-12)
    np.testing.assert_allclose(forget_gate, 0.0, atol=1e-12)


def test_episode_label_shuffle_preserves_equivalence_classes():
    labels = np.array([10, 10, 20, 30, 20])
    remapped, mapping = remap_episode_labels(labels, rng=np.random.default_rng(4))
    assert len(mapping) == 3
    assert remapped[0] == remapped[1]
    assert remapped[2] == remapped[4]
    assert remapped[0] != remapped[2]
    assert set(remapped) == {0, 1, 2}


def test_prototypes_and_linear_equivalence():
    support = np.array([[0.0, 0.0], [2.0, 0.0], [4.0, 4.0], [6.0, 4.0]])
    prototypes, classes = class_prototypes(support, [3, 3, 9, 9])
    np.testing.assert_array_equal(classes, [3, 9])
    np.testing.assert_allclose(prototypes, [[1.0, 0.0], [5.0, 4.0]])
    queries = np.array([[2.0, 1.0], [-1.0, 3.0]])
    distances = prototype_logits(queries, prototypes)
    linear = prototype_linear_logits(queries, prototypes)
    expected_offset = -np.sum(queries**2, axis=1)
    np.testing.assert_allclose(
        distances - linear,
        np.broadcast_to(expected_offset[:, None], distances.shape),
    )
    np.testing.assert_allclose(prototype_probabilities(queries, prototypes).sum(axis=1), 1.0)


def test_full_quadratic_maml_gradient_matches_finite_difference():
    theta = 0.7
    targets = np.array([-2.0, 1.0, 4.0])
    alpha = 0.25
    epsilon = 1e-6
    numeric = (
        quadratic_meta_loss(theta + epsilon, targets, alpha)
        - quadratic_meta_loss(theta - epsilon, targets, alpha)
    ) / (2 * epsilon)
    exact = quadratic_meta_gradient(theta, targets, alpha)
    np.testing.assert_allclose(exact, numeric, rtol=1e-8, atol=1e-8)
    first_order = quadratic_meta_gradient(theta, targets, alpha, first_order=True)
    np.testing.assert_allclose(exact, first_order * (1 - alpha))
    step = quadratic_maml_step(theta, targets, alpha, 0.1)
    assert step.theta_after == theta - 0.1 * step.meta_gradient
