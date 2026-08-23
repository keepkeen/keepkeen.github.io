"""Run four small, inspectable mechanisms from the reading guide.

This file is intentionally a mechanism demonstration, not a benchmark
reproduction. Install the project with ``python3 -m pip install -e .`` first,
then run ``python3 examples/core_mechanisms.py`` from the repository root.
"""

from __future__ import annotations

import json

import numpy as np

from ilya30.attention import causal_mask, scaled_dot_product_attention
from ilya30.ctc import brute_force_ctc_probability, ctc_log_probability
from ilya30.meta import (
    class_prototypes,
    prototype_probabilities,
    quadratic_maml_step,
    quadratic_meta_loss,
)


def run_demo() -> dict[str, object]:
    """Execute the demonstrations and assert their defining invariants."""

    tokens = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    values = np.array([[1.0, 10.0], [2.0, 20.0], [3.0, 30.0]])
    attended, weights = scaled_dot_product_attention(
        tokens,
        tokens,
        values,
        mask=causal_mask(3),
    )
    future_attention = float(np.max(np.triu(weights, k=1)))
    assert future_attention == 0.0

    frame_probabilities = np.array(
        [
            [0.50, 0.40, 0.10],
            [0.25, 0.60, 0.15],
            [0.40, 0.20, 0.40],
            [0.55, 0.10, 0.35],
        ]
    )
    target = (1, 2)
    ctc_dynamic = float(
        np.exp(ctc_log_probability(np.log(frame_probabilities), target))
    )
    ctc_exhaustive = brute_force_ctc_probability(frame_probabilities, target)
    assert np.isclose(ctc_dynamic, ctc_exhaustive)

    support = np.array([[0.0, 0.0], [0.2, 0.0], [2.0, 2.0], [2.2, 2.0]])
    prototypes, classes = class_prototypes(support, [0, 0, 1, 1])
    queries = np.array([[0.1, 0.1], [2.1, 1.9]])
    prototype_probs = prototype_probabilities(queries, prototypes)
    predictions = classes[np.argmax(prototype_probs, axis=1)]
    assert predictions.tolist() == [0, 1]

    theta = 3.0
    task_targets = np.array([-2.0, 0.0, 2.0])
    inner_rate = 0.25
    before = quadratic_meta_loss(theta, task_targets, inner_rate)
    full_step = quadratic_maml_step(theta, task_targets, inner_rate, 0.5)
    first_order_step = quadratic_maml_step(
        theta,
        task_targets,
        inner_rate,
        0.5,
        first_order=True,
    )
    after = quadratic_meta_loss(full_step.theta_after, task_targets, inner_rate)
    assert after < before

    return {
        "causal_attention": {
            "output": attended.round(6).tolist(),
            "weights": weights.round(6).tolist(),
            "maximum_future_weight": future_attention,
        },
        "ctc": {
            "dynamic_programming_probability": ctc_dynamic,
            "exhaustive_probability": ctc_exhaustive,
            "absolute_difference": abs(ctc_dynamic - ctc_exhaustive),
        },
        "prototypical_network": {
            "prototypes": prototypes.tolist(),
            "query_probabilities": prototype_probs.round(6).tolist(),
            "predictions": predictions.tolist(),
        },
        "maml": {
            "meta_loss_before": before,
            "meta_loss_after_full_step": after,
            "full_meta_gradient": full_step.meta_gradient,
            "first_order_meta_gradient": first_order_step.meta_gradient,
        },
    }


if __name__ == "__main__":
    print(json.dumps(run_demo(), ensure_ascii=False, indent=2))
