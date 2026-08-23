import numpy as np

from ilya30.systems import (
    estimate_training_flops,
    fit_power_law,
    grid_search_compute_allocation,
    pipeline_bubble_fraction,
    pipeline_schedule,
    pipeline_utilization,
)
from ilya30.universal import environment_weights, finite_universal_score, rank_policies


def test_pipeline_schedule_and_bubble_formula():
    schedule = pipeline_schedule(3, 4)
    np.testing.assert_array_equal(
        schedule,
        [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5]],
    )
    assert pipeline_utilization(1, 4) == 0.25
    np.testing.assert_allclose(pipeline_utilization(100, 4), 100 / 103)
    np.testing.assert_allclose(pipeline_bubble_fraction(100, 4), 3 / 103)


def test_power_law_fit_recovers_synthetic_exponent_and_floor():
    x = np.geomspace(10, 10_000, 20)
    y = 1.5 + 8.0 * x ** (-0.37)
    fitted = fit_power_law(x, y, floor=1.5)
    np.testing.assert_allclose(fitted.coefficient, 8.0, rtol=1e-12)
    np.testing.assert_allclose(fitted.exponent, 0.37, rtol=1e-12)
    np.testing.assert_allclose(fitted.residuals, 0.0, atol=1e-12)
    np.testing.assert_allclose(fitted.predict(x), y)


def test_floor_misspecification_changes_extrapolation():
    x = np.geomspace(10, 1_000, 20)
    y = 2.0 + 5.0 * x ** -0.5
    correct = fit_power_law(x, y, floor=2.0)
    wrong = fit_power_law(x, y, floor=0.0)
    assert abs(correct.exponent - wrong.exponent) > 0.3


def test_compute_allocation_obeys_six_nd_constraint():
    budget = 6e12
    allocation = grid_search_compute_allocation(
        budget,
        parameter_coefficient=3.0,
        data_coefficient=2.0,
        parameter_exponent=0.5,
        data_exponent=0.5,
        min_parameters=1e3,
        max_parameters=1e9,
        grid_size=2_000,
    )
    np.testing.assert_allclose(estimate_training_flops(allocation.parameters, allocation.tokens), budget)
    # For equal exponents the analytic optimum is N=(A/B)^(1/(a+b))*sqrt(C/6).
    expected_parameters = (3 / 2) * np.sqrt(budget / 6)
    np.testing.assert_allclose(allocation.parameters, expected_parameters, rtol=0.01)


def test_finite_universal_score_uses_explicit_description_weights():
    lengths = np.array([1.0, 3.0])
    weights = environment_weights(lengths)
    np.testing.assert_allclose(weights, [0.5, 0.125])
    values = np.array([[1.0, 0.0], [0.4, 1.0]])
    scores = finite_universal_score(values, lengths)
    np.testing.assert_allclose(scores, [0.5, 0.325])
    assert rank_policies(values, lengths, names=["simple-specialist", "broad"])[0][0] == "simple-specialist"


def test_ranking_can_change_when_the_environment_list_changes():
    original_values = np.array([[1.0], [0.4]])
    assert rank_policies(original_values, [1], ["A", "B"])[0][0] == "A"
    expanded_values = np.array([[1.0, 0.0], [0.4, 1.0]])
    # Give the newly specified environment equal explicit weight.
    assert rank_policies(expanded_values, [1, 1], ["A", "B"])[0][0] == "B"
