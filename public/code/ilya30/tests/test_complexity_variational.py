import itertools

import numpy as np

from ilya30.complexity import (
    bernoulli_nml_codelength,
    bernoulli_nml_probability,
    block_coarse_grain,
    coffee_initial_state,
    empirical_entropy,
    finite_set_two_part_codelength,
    randomness_deficiency,
    simulate_coffee,
    two_part_codelength,
    zlib_codelength,
)
from ilya30.variational import (
    elbo,
    free_bits,
    kl_diag_gaussian_standard,
    kl_diag_gaussians,
    reparameterize,
)


def test_empirical_entropy_separates_constant_and_balanced_bits():
    assert empirical_entropy(np.zeros(100, dtype=int)) == 0.0
    np.testing.assert_allclose(empirical_entropy([0, 1] * 50), 1.0)


def test_repetition_compresses_better_than_seeded_noise():
    constant = np.zeros(20_000, dtype=np.uint8)
    random = np.random.default_rng(0).integers(0, 256, size=20_000, dtype=np.uint8)
    assert zlib_codelength(constant) < zlib_codelength(random) / 10


def test_better_compression_only_tightens_the_known_upper_bound():
    data = (b"structured-pattern-" * 2_000)
    assert zlib_codelength(data, level=9) <= zlib_codelength(data, level=0)


def test_bernoulli_nml_is_a_distribution_over_each_fixed_length():
    for length in range(0, 7):
        total = sum(
            bernoulli_nml_probability(sequence)
            for sequence in itertools.product((0, 1), repeat=length)
        )
        np.testing.assert_allclose(total, 1.0, atol=1e-12)
    assert bernoulli_nml_codelength([0, 1, 0, 1]) > 0


def test_flexible_bernoulli_code_pays_for_flexibility():
    balanced = [0, 1] * 5
    biased = [1] * 10
    fair_coin_bits = 10.0
    assert bernoulli_nml_codelength(balanced) > fair_coin_bits
    assert bernoulli_nml_codelength(biased) < fair_coin_bits


def test_two_part_and_randomness_deficiency_algebra():
    assert two_part_codelength(3.0, 7.5) == 10.5
    assert finite_set_two_part_codelength(3.0, 32) == 8.0
    assert randomness_deficiency(5.0, 4.25) == 0.75


def test_block_coarse_graining_has_explicit_boundary_policy():
    grid = np.array(
        [
            [1, 1, 0, 0],
            [1, 0, 0, 0],
            [1, 1, 1, 1],
            [1, 1, 0, 0],
        ]
    )
    means = block_coarse_grain(grid, 2, threshold=None)
    np.testing.assert_allclose(means, [[0.75, 0.0], [1.0, 0.5]])
    np.testing.assert_array_equal(block_coarse_grain(grid, 2), [[1, 0], [1, 1]])


def test_coffee_automaton_conserves_particles_and_seed_is_reproducible():
    initial = coffee_initial_state(20, 16, 0.4)
    first = simulate_coffee(initial, 8, seed=123)
    second = simulate_coffee(initial, 8, seed=123)
    np.testing.assert_array_equal(first, second)
    np.testing.assert_array_equal(first.sum(axis=(1, 2)), np.full(9, initial.sum()))


def test_reparameterization_is_deterministic_when_noise_is_supplied():
    mean = np.array([1.0, -2.0])
    log_variance = np.log([4.0, 0.25])
    sample = reparameterize(mean, log_variance, epsilon=[0.5, -2.0])
    np.testing.assert_allclose(sample, [2.0, -3.0])


def test_gaussian_kl_formulas_and_monte_carlo_agree():
    mean = np.array([0.7, -0.4])
    log_variance = np.log([0.5, 1.8])
    analytic = kl_diag_gaussian_standard(mean, log_variance)
    general = kl_diag_gaussians(mean, log_variance, np.zeros(2), np.zeros(2))
    np.testing.assert_allclose(analytic, general)

    rng = np.random.default_rng(5)
    samples = mean + np.exp(0.5 * log_variance) * rng.standard_normal((200_000, 2))
    log_q = -0.5 * np.sum(
        np.log(2 * np.pi) + log_variance + (samples - mean) ** 2 / np.exp(log_variance),
        axis=1,
    )
    log_p = -0.5 * np.sum(np.log(2 * np.pi) + samples**2, axis=1)
    np.testing.assert_allclose(np.mean(log_q - log_p), analytic, atol=0.01)


def test_zero_kl_is_best_when_decoder_ignores_latent():
    reconstruction = -3.0
    collapsed_kl = kl_diag_gaussian_standard([0.0, 0.0], [0.0, 0.0])
    informative_kl = kl_diag_gaussian_standard([1.0, 0.5], [-0.2, 0.3])
    assert collapsed_kl == 0.0
    assert elbo(reconstruction, collapsed_kl) > elbo(reconstruction, informative_kl)
    assert free_bits([0.01, 0.4], 0.1) == 0.5
