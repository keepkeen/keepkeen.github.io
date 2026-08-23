"""Message passing and pairwise relation-network building blocks."""

from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def mpnn_step(
    node_states: ArrayLike,
    senders: Sequence[int],
    receivers: Sequence[int],
    message_function: Callable[[FloatArray, FloatArray, FloatArray | None], ArrayLike],
    update_function: Callable[[FloatArray, FloatArray], ArrayLike],
    edge_features: ArrayLike | None = None,
) -> FloatArray:
    """Run one sum-aggregating message-passing step.

    Edges are directed from ``senders[e]`` to ``receivers[e]``.  The aggregation
    contains no node ordering, so a consistent permutation of states and indices is
    equivariant.
    """

    states = np.asarray(node_states, dtype=float)
    if states.ndim != 2:
        raise ValueError("node_states must have shape (nodes, features)")
    sender_array = np.asarray(senders, dtype=int)
    receiver_array = np.asarray(receivers, dtype=int)
    if sender_array.shape != receiver_array.shape or sender_array.ndim != 1:
        raise ValueError("senders and receivers must be equal-length vectors")
    if sender_array.size and (
        np.min(sender_array) < 0
        or np.max(sender_array) >= states.shape[0]
        or np.min(receiver_array) < 0
        or np.max(receiver_array) >= states.shape[0]
    ):
        raise ValueError("an edge endpoint is outside the node array")
    features = None if edge_features is None else np.asarray(edge_features, dtype=float)
    if features is not None and features.shape[0] != sender_array.size:
        raise ValueError("edge_features must have one row per edge")

    messages: list[FloatArray] = []
    for edge, (sender, receiver) in enumerate(zip(sender_array, receiver_array, strict=True)):
        edge_feature = None if features is None else features[edge]
        message = np.asarray(
            message_function(states[sender], states[receiver], edge_feature),
            dtype=float,
        )
        messages.append(message)
    message_dim = states.shape[1] if not messages else messages[0].shape[-1]
    aggregated = np.zeros((states.shape[0], message_dim), dtype=float)
    for receiver, message in zip(receiver_array, messages, strict=True):
        if message.shape != (message_dim,):
            raise ValueError("every message must have the same vector shape")
        aggregated[receiver] += message
    return np.stack(
        [
            np.asarray(update_function(state, incoming), dtype=float)
            for state, incoming in zip(states, aggregated, strict=True)
        ]
    )


def message_passing(
    node_states: ArrayLike,
    senders: Sequence[int],
    receivers: Sequence[int],
    message_function: Callable[[FloatArray, FloatArray, FloatArray | None], ArrayLike],
    update_function: Callable[[FloatArray, FloatArray], ArrayLike],
    steps: int,
    edge_features: ArrayLike | None = None,
) -> FloatArray:
    """Repeat :func:`mpnn_step` with shared message and update functions."""

    if steps < 0:
        raise ValueError("steps cannot be negative")
    states = np.asarray(node_states, dtype=float)
    for _ in range(steps):
        states = mpnn_step(
            states,
            senders,
            receivers,
            message_function,
            update_function,
            edge_features,
        )
    return states


def graph_sum_readout(
    node_states: ArrayLike,
    transform: Callable[[FloatArray], ArrayLike] | None = None,
) -> FloatArray:
    """Permutation-invariant graph readout by transformed sum."""

    states = np.asarray(node_states, dtype=float)
    if states.ndim != 2:
        raise ValueError("node_states must have shape (nodes, features)")
    transformed = states if transform is None else np.stack(
        [np.asarray(transform(state), dtype=float) for state in states]
    )
    return np.sum(transformed, axis=0)


def relation_network(
    objects: ArrayLike,
    relation_function: Callable[[FloatArray, FloatArray, FloatArray | None], ArrayLike],
    output_function: Callable[[FloatArray], ArrayLike] | None = None,
    *,
    question: ArrayLike | None = None,
    edges: Sequence[tuple[int, int]] | None = None,
) -> FloatArray:
    """Compute ``f(sum_(i,j) g(o_i, o_j, q))``.

    By default all ordered pairs, including self-pairs, are used as in the original
    Relation Network.  ``edges`` can make directionality and sparsity explicit.
    """

    values = np.asarray(objects, dtype=float)
    if values.ndim != 2 or values.shape[0] == 0:
        raise ValueError("objects must be a non-empty (objects, features) array")
    q = None if question is None else np.asarray(question, dtype=float)
    pair_indices = (
        [(i, j) for i in range(values.shape[0]) for j in range(values.shape[0])]
        if edges is None
        else list(edges)
    )
    if not pair_indices:
        raise ValueError("relation network needs at least one edge")
    relations = []
    for left, right in pair_indices:
        if not 0 <= left < values.shape[0] or not 0 <= right < values.shape[0]:
            raise ValueError("relation edge endpoint is outside the object array")
        relations.append(
            np.asarray(relation_function(values[left], values[right], q), dtype=float)
        )
    aggregate = np.sum(np.stack(relations), axis=0)
    return aggregate if output_function is None else np.asarray(output_function(aggregate), dtype=float)


def ordered_pair_count(num_objects: int, *, include_self: bool = True) -> int:
    """Return the number of dense ordered relation pairs."""

    if num_objects < 0:
        raise ValueError("num_objects cannot be negative")
    return num_objects * num_objects if include_self else num_objects * (num_objects - 1)
