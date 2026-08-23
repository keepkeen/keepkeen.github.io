"""Small calculations for pipeline schedules and empirical scaling laws."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def pipeline_schedule(num_microbatches: int, num_stages: int) -> NDArray[np.int_]:
    """Return unit-time forward start slots indexed by microbatch and stage."""

    if num_microbatches <= 0 or num_stages <= 0:
        raise ValueError("num_microbatches and num_stages must be positive")
    microbatches = np.arange(num_microbatches)[:, None]
    stages = np.arange(num_stages)[None, :]
    return microbatches + stages


def pipeline_utilization(num_microbatches: int, num_stages: int) -> float:
    """Ideal forward-pipeline utilization ``M / (M + K - 1)``."""

    if num_microbatches <= 0 or num_stages <= 0:
        raise ValueError("num_microbatches and num_stages must be positive")
    return num_microbatches / (num_microbatches + num_stages - 1)


def pipeline_bubble_fraction(num_microbatches: int, num_stages: int) -> float:
    """Ideal fraction of stage capacity lost while filling/draining the pipeline."""

    return 1.0 - pipeline_utilization(num_microbatches, num_stages)


@dataclass(frozen=True)
class PowerLawFit:
    """Fit of ``y = floor + coefficient * x**(-exponent)``."""

    coefficient: float
    exponent: float
    floor: float
    residuals: FloatArray

    def predict(self, x: ArrayLike) -> FloatArray:
        values = np.asarray(x, dtype=float)
        return self.floor + self.coefficient * np.power(values, -self.exponent)


def fit_power_law(x: ArrayLike, y: ArrayLike, *, floor: float = 0.0) -> PowerLawFit:
    """Fit a power law by linear regression in log space.

    The floor is held fixed.  Residuals are returned in the original ``y`` space so
    callers can inspect where the straight-line assumption fails.
    """

    inputs = np.asarray(x, dtype=float)
    outputs = np.asarray(y, dtype=float)
    if inputs.ndim != 1 or outputs.shape != inputs.shape or inputs.size < 2:
        raise ValueError("x and y must be equal-length vectors with at least two points")
    if np.any(inputs <= 0) or np.any(outputs <= floor):
        raise ValueError("x must be positive and every y must exceed floor")
    design = np.column_stack((np.ones_like(inputs), np.log(inputs)))
    intercept, slope = np.linalg.lstsq(design, np.log(outputs - floor), rcond=None)[0]
    coefficient = float(np.exp(intercept))
    exponent = float(-slope)
    predictions = floor + coefficient * np.power(inputs, -exponent)
    return PowerLawFit(coefficient, exponent, float(floor), outputs - predictions)


def estimate_training_flops(parameters: float, tokens: float) -> float:
    """Dense Transformer rule of thumb: training compute is about ``6 N D`` FLOPs."""

    if parameters <= 0 or tokens <= 0:
        raise ValueError("parameters and tokens must be positive")
    return 6.0 * parameters * tokens


def scaling_loss(
    parameters: ArrayLike,
    tokens: ArrayLike,
    *,
    parameter_coefficient: float,
    data_coefficient: float,
    parameter_exponent: float,
    data_exponent: float,
    floor: float = 0.0,
) -> FloatArray:
    """Evaluate ``floor + A/N**alpha + B/D**beta``."""

    model_size = np.asarray(parameters, dtype=float)
    data_size = np.asarray(tokens, dtype=float)
    if np.any(model_size <= 0) or np.any(data_size <= 0):
        raise ValueError("parameters and tokens must be positive")
    if min(parameter_coefficient, data_coefficient, parameter_exponent, data_exponent) <= 0:
        raise ValueError("coefficients and exponents must be positive")
    return (
        floor
        + parameter_coefficient * np.power(model_size, -parameter_exponent)
        + data_coefficient * np.power(data_size, -data_exponent)
    )


@dataclass(frozen=True)
class ComputeAllocation:
    parameters: float
    tokens: float
    loss: float
    compute: float


def grid_search_compute_allocation(
    compute_budget: float,
    *,
    parameter_coefficient: float,
    data_coefficient: float,
    parameter_exponent: float,
    data_exponent: float,
    floor: float = 0.0,
    min_parameters: float = 1.0,
    max_parameters: float | None = None,
    grid_size: int = 10_000,
) -> ComputeAllocation:
    """Find a loss-minimizing ``(N, D)`` under the approximation ``C = 6ND``."""

    if compute_budget <= 0 or min_parameters <= 0 or grid_size < 2:
        raise ValueError("compute, min_parameters and grid_size must be positive")
    maximum = compute_budget / 6.0 if max_parameters is None else max_parameters
    if maximum < min_parameters:
        raise ValueError("max_parameters must be at least min_parameters")
    model_sizes = np.geomspace(min_parameters, maximum, grid_size)
    token_counts = compute_budget / (6.0 * model_sizes)
    losses = scaling_loss(
        model_sizes,
        token_counts,
        parameter_coefficient=parameter_coefficient,
        data_coefficient=data_coefficient,
        parameter_exponent=parameter_exponent,
        data_exponent=data_exponent,
        floor=floor,
    )
    best = int(np.argmin(losses))
    return ComputeAllocation(
        float(model_sizes[best]),
        float(token_counts[best]),
        float(losses[best]),
        float(compute_budget),
    )
