import numpy as np

from ilya30.graphs import (
    graph_sum_readout,
    message_passing,
    mpnn_step,
    ordered_pair_count,
    relation_network,
)
from ilya30.sets import attention_read, set2set_read, shared_encode, sum_pool
from ilya30.vision import (
    conv2d,
    conv_output_shape,
    dilated_conv2d,
    max_pool2d,
    numerical_gradient,
    receptive_field,
    relative_error,
    residual_block,
    shortcut_gradient_product,
)


def test_conv2d_matches_hand_calculation_and_shape_formula():
    image = np.arange(1, 10).reshape(3, 3)
    kernel = np.array([[1.0, 0.0], [0.0, -1.0]])
    output = conv2d(image, kernel)
    np.testing.assert_array_equal(output, np.full((2, 2), -4.0))
    assert output.shape == conv_output_shape(image.shape, kernel.shape)


def test_dilation_one_is_ordinary_convolution():
    rng = np.random.default_rng(2)
    image = rng.normal(size=(2, 6, 5))
    kernels = rng.normal(size=(3, 2, 3, 2))
    np.testing.assert_allclose(
        dilated_conv2d(image, kernels, 1),
        conv2d(image, kernels),
    )


def test_dilated_convolution_samples_spaced_positions():
    image = np.zeros((5, 5))
    image[::2, ::2] = 1.0
    kernel = np.ones((3, 3))
    assert dilated_conv2d(image, kernel, 2).item() == 9.0
    assert receptive_field([1, 2, 4], kernel_size=3) == 15


def test_pooling_and_multichannel_bias():
    image = np.array([[1.0, 4.0], [3.0, 2.0]])
    assert max_pool2d(image, 2).item() == 4.0
    stacked = np.stack((image, image))
    kernels = np.ones((2, 2, 1, 1))
    output = conv2d(stacked, kernels, bias=[1.0, -1.0])
    np.testing.assert_allclose(output[0], 2 * image + 1)
    np.testing.assert_allclose(output[1], 2 * image - 1)


def test_residual_identity_path_and_post_activation():
    values = np.array([-2.0, 3.0])
    np.testing.assert_array_equal(residual_block(values, lambda x: np.zeros_like(x)), values)
    activated = residual_block(values, lambda x: np.ones_like(x), post_activation=lambda x: np.maximum(x, 0))
    np.testing.assert_array_equal(activated, [0.0, 4.0])
    assert shortcut_gradient_product(np.ones(1_000)) == 1.0
    assert shortcut_gradient_product(np.full(10, 0.9)) < 0.35


def test_zero_residual_has_unit_numerical_gradient():
    gradient = numerical_gradient(
        lambda x: float(np.sum(residual_block(x, lambda value: np.zeros_like(value)))),
        np.array([-1.0, 2.0, 0.5]),
    )
    np.testing.assert_allclose(gradient, 1.0, atol=1e-10)


def test_numerical_gradient_matches_quadratic_derivative():
    point = np.array([0.5, -2.0, 4.0])
    numeric = numerical_gradient(lambda x: float(np.sum(x**2)), point)
    analytic = 2 * point
    assert relative_error(numeric, analytic) < 1e-9


def test_set_read_is_permutation_invariant():
    elements = np.array([[1.0, 0.0], [0.0, 2.0], [3.0, 1.0]])
    query = np.array([0.5, -0.2])
    permutation = np.array([2, 0, 1])
    original, original_weights = attention_read(elements, query)
    permuted, permuted_weights = attention_read(elements[permutation], query)
    np.testing.assert_allclose(permuted, original)
    np.testing.assert_allclose(permuted_weights, original_weights[permutation])
    np.testing.assert_allclose(sum_pool(elements), sum_pool(elements[permutation]))
    np.testing.assert_allclose(shared_encode(elements, lambda x: x**2), elements**2)


def test_iterative_set2set_read_stays_invariant():
    elements = np.array([[1.0, 0.0], [0.0, 1.0], [2.0, -1.0]])
    update = lambda query, read: 0.5 * query + read
    query_a, reads_a = set2set_read(elements, np.ones(2), 3, update)
    query_b, reads_b = set2set_read(elements[[1, 2, 0]], np.ones(2), 3, update)
    np.testing.assert_allclose(query_a, query_b)
    np.testing.assert_allclose(reads_a, reads_b)


def test_message_passing_is_equivariant_to_node_renaming():
    states = np.array([[1.0], [2.0], [4.0]])
    senders = np.array([0, 1, 2, 0])
    receivers = np.array([1, 2, 0, 2])
    message = lambda sender, receiver, edge: sender
    update = lambda old, incoming: old + incoming
    original = mpnn_step(states, senders, receivers, message, update)

    permutation = np.array([2, 0, 1])  # new index -> old index
    old_to_new = np.argsort(permutation)
    renamed = mpnn_step(
        states[permutation],
        old_to_new[senders],
        old_to_new[receivers],
        message,
        update,
    )
    np.testing.assert_allclose(renamed, original[permutation])
    np.testing.assert_allclose(graph_sum_readout(renamed), graph_sum_readout(original))


def test_t_steps_only_cross_t_edges_on_a_chain():
    states = np.array([[1.0], [0.0], [0.0]])
    senders, receivers = [0, 1], [1, 2]
    message = lambda sender, receiver, edge: sender
    update = lambda old, incoming: incoming
    after_one = message_passing(states, senders, receivers, message, update, 1)
    after_two = message_passing(states, senders, receivers, message, update, 2)
    assert after_one[2, 0] == 0.0
    assert after_two[2, 0] == 1.0


def test_relation_network_pair_sum_is_order_invariant_and_directional():
    objects = np.array([[1.0], [3.0], [7.0]])
    relation = lambda left, right, question: np.array([10 * left.item() + right.item()])
    all_pairs = relation_network(objects, relation)
    permuted = relation_network(objects[[2, 0, 1]], relation)
    np.testing.assert_allclose(all_pairs, permuted)
    forward = relation_network(objects, relation, edges=[(0, 1)])
    backward = relation_network(objects, relation, edges=[(1, 0)])
    assert forward.item() != backward.item()
    assert ordered_pair_count(3) == 9
    assert ordered_pair_count(3, include_self=False) == 6
