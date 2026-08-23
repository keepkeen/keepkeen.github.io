"""Few-shot prototypes and an analytic one-dimensional MAML laboratory."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .attention import softmax


FloatArray = NDArray[np.floating]


def remap_episode_labels(
    labels: ArrayLike,
    *,
    rng: np.random.Generator | None = None,
) -> tuple[NDArray[np.int_], dict[Any, int]]:
    """Randomly bind the unique labels in an episode to ``0..way-1``."""

    original = np.asarray(labels)
    if original.ndim != 1 or original.size == 0:
        raise ValueError("labels must be a non-empty vector")
    classes = np.unique(original)
    generator = np.random.default_rng() if rng is None else rng
    destinations = generator.permutation(classes.size)
    mapping = {
        source.item() if hasattr(source, "item") else source: int(destination)
        for source, destination in zip(classes, destinations, strict=True)
    }
    remapped = np.array(
        [mapping[label.item() if hasattr(label, "item") else label] for label in original],
        dtype=int,
    )
    return remapped, mapping


def class_prototypes(
    support_embeddings: ArrayLike,
    support_labels: ArrayLike,
    classes: ArrayLike | None = None,
) -> tuple[FloatArray, NDArray]:
    """Average support embeddings per class and return prototypes plus class order."""

    embeddings = np.asarray(support_embeddings, dtype=float)
    labels = np.asarray(support_labels)
    if embeddings.ndim != 2 or labels.shape != (embeddings.shape[0],):
        raise ValueError("support embeddings and labels must agree on sample count")
    class_order = np.unique(labels) if classes is None else np.asarray(classes)
    prototypes: list[FloatArray] = []
    for label in class_order:
        members = embeddings[labels == label]
        if members.shape[0] == 0:
            raise ValueError(f"class {label!r} has no support examples")
        prototypes.append(np.mean(members, axis=0))
    return np.stack(prototypes), class_order


def prototype_logits(queries: ArrayLike, prototypes: ArrayLike) -> FloatArray:
    """Return negative squared Euclidean distances for every query/prototype pair."""

    query_vectors = np.asarray(queries, dtype=float)
    centers = np.asarray(prototypes, dtype=float)
    squeeze = query_vectors.ndim == 1
    if squeeze:
        query_vectors = query_vectors[None, :]
    if query_vectors.ndim != 2 or centers.ndim != 2 or query_vectors.shape[1] != centers.shape[1]:
        raise ValueError("queries and prototypes must share an embedding dimension")
    logits = -np.sum(np.square(query_vectors[:, None, :] - centers[None, :, :]), axis=-1)
    return logits[0] if squeeze else logits


def prototype_linear_logits(queries: ArrayLike, prototypes: ArrayLike) -> FloatArray:
    """Equivalent class-dependent part ``2 c_k^T z - ||c_k||^2``."""

    query_vectors = np.asarray(queries, dtype=float)
    centers = np.asarray(prototypes, dtype=float)
    return 2.0 * np.matmul(query_vectors, centers.T) - np.sum(np.square(centers), axis=1)


def prototype_probabilities(queries: ArrayLike, prototypes: ArrayLike) -> FloatArray:
    """Softmax probabilities induced by squared-distance prototype logits."""

    return softmax(prototype_logits(queries, prototypes), axis=-1)


def quadratic_adapt(theta: float, target: float, inner_learning_rate: float) -> float:
    """One gradient step for ``0.5 * (theta - target)**2``."""

    if inner_learning_rate < 0:
        raise ValueError("inner_learning_rate cannot be negative")
    return float(theta - inner_learning_rate * (theta - target))


def quadratic_meta_loss(
    theta: float,
    task_targets: ArrayLike,
    inner_learning_rate: float,
) -> float:
    """Mean post-update loss across scalar quadratic tasks."""

    targets = np.asarray(task_targets, dtype=float)
    if targets.ndim != 1 or targets.size == 0:
        raise ValueError("task_targets must be a non-empty vector")
    adapted = theta - inner_learning_rate * (theta - targets)
    return float(np.mean(0.5 * np.square(adapted - targets)))


def quadratic_meta_gradient(
    theta: float,
    task_targets: ArrayLike,
    inner_learning_rate: float,
    *,
    first_order: bool = False,
) -> float:
    """Analytic MAML or FOMAML gradient for scalar quadratic tasks."""

    targets = np.asarray(task_targets, dtype=float)
    if targets.ndim != 1 or targets.size == 0:
        raise ValueError("task_targets must be a non-empty vector")
    adapted = theta - inner_learning_rate * (theta - targets)
    gradient = adapted - targets
    if not first_order:
        gradient = gradient * (1.0 - inner_learning_rate)
    return float(np.mean(gradient))


@dataclass(frozen=True)
class MAMLStep:
    theta_before: float
    theta_after: float
    meta_loss: float
    meta_gradient: float
    first_order: bool


def quadratic_maml_step(
    theta: float,
    task_targets: ArrayLike,
    inner_learning_rate: float,
    meta_learning_rate: float,
    *,
    first_order: bool = False,
) -> MAMLStep:
    """Take one analytic meta-update in the quadratic laboratory."""

    if meta_learning_rate < 0:
        raise ValueError("meta_learning_rate cannot be negative")
    loss = quadratic_meta_loss(theta, task_targets, inner_learning_rate)
    gradient = quadratic_meta_gradient(
        theta,
        task_targets,
        inner_learning_rate,
        first_order=first_order,
    )
    return MAMLStep(
        float(theta),
        float(theta - meta_learning_rate * gradient),
        loss,
        gradient,
        first_order,
    )
