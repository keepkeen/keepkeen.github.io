"""Gaussian variational-inference equations shared by several chapters."""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def reparameterize(
    mean: ArrayLike,
    log_variance: ArrayLike,
    *,
    rng: np.random.Generator | None = None,
    epsilon: ArrayLike | None = None,
) -> FloatArray:
    """Sample ``mean + exp(0.5 * log_variance) * epsilon``.

    Supplying ``epsilon`` makes examples and finite-difference tests deterministic.
    """

    location = np.asarray(mean, dtype=float)
    log_var = np.asarray(log_variance, dtype=float)
    if location.shape != log_var.shape:
        raise ValueError("mean and log_variance must have equal shapes")
    if epsilon is None:
        generator = np.random.default_rng() if rng is None else rng
        noise = generator.standard_normal(location.shape)
    else:
        noise = np.asarray(epsilon, dtype=float)
        if noise.shape != location.shape:
            raise ValueError("epsilon must match the mean shape")
    return location + np.exp(0.5 * log_var) * noise


def kl_diag_gaussian_standard(
    mean: ArrayLike,
    log_variance: ArrayLike,
    *,
    reduce: bool = True,
) -> float | FloatArray:
    """KL from a diagonal Gaussian to a standard normal, in nats."""

    location = np.asarray(mean, dtype=float)
    log_var = np.asarray(log_variance, dtype=float)
    if location.shape != log_var.shape:
        raise ValueError("mean and log_variance must have equal shapes")
    per_dimension = 0.5 * (np.square(location) + np.exp(log_var) - 1.0 - log_var)
    return float(np.sum(per_dimension)) if reduce else per_dimension


def kl_diag_gaussians(
    mean_q: ArrayLike,
    log_variance_q: ArrayLike,
    mean_p: ArrayLike,
    log_variance_p: ArrayLike,
    *,
    reduce: bool = True,
) -> float | FloatArray:
    """KL ``KL(q || p)`` for two diagonal Gaussians, in nats."""

    mq = np.asarray(mean_q, dtype=float)
    lq = np.asarray(log_variance_q, dtype=float)
    mp = np.asarray(mean_p, dtype=float)
    lp = np.asarray(log_variance_p, dtype=float)
    if not (mq.shape == lq.shape == mp.shape == lp.shape):
        raise ValueError("all Gaussian parameter arrays must have equal shapes")
    variance_ratio = np.exp(lq - lp)
    squared_distance = np.square(mq - mp) / np.exp(lp)
    per_dimension = 0.5 * (lp - lq + variance_ratio + squared_distance - 1.0)
    return float(np.sum(per_dimension)) if reduce else per_dimension


def elbo(reconstruction_log_probability: ArrayLike, kl_divergence: ArrayLike, beta: float = 1.0) -> FloatArray:
    """Evidence lower bound ``E[log p(x|z)] - beta * KL``."""

    if beta < 0:
        raise ValueError("beta cannot be negative")
    return np.asarray(reconstruction_log_probability, dtype=float) - beta * np.asarray(
        kl_divergence, dtype=float
    )


def free_bits(kl_per_dimension: ArrayLike, minimum_nats: float) -> float:
    """Apply a per-dimension free-bits floor before summing KL costs."""

    if minimum_nats < 0:
        raise ValueError("minimum_nats cannot be negative")
    values = np.asarray(kl_per_dimension, dtype=float)
    if np.any(values < -1e-10):
        raise ValueError("KL contributions cannot be negative")
    return float(np.sum(np.maximum(values, minimum_nats)))
