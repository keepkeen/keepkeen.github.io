"""Transparent NumPy operators for convolution, residual paths and checks."""

from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray


FloatArray = NDArray[np.floating]


def _pair(value: int | Sequence[int], name: str) -> tuple[int, int]:
    if isinstance(value, (int, np.integer)):
        pair = (int(value), int(value))
    else:
        if len(value) != 2:
            raise ValueError(f"{name} must contain exactly two integers")
        pair = (int(value[0]), int(value[1]))
    if name == "padding":
        if min(pair) < 0:
            raise ValueError("padding cannot be negative")
    elif min(pair) <= 0:
        raise ValueError(f"{name} must be positive")
    return pair


def conv_output_shape(
    input_shape: Sequence[int],
    kernel_shape: Sequence[int],
    *,
    stride: int | Sequence[int] = 1,
    padding: int | Sequence[int] = 0,
    dilation: int | Sequence[int] = 1,
) -> tuple[int, int]:
    """Return spatial output dimensions for a valid dilated convolution."""

    in_h, in_w = map(int, input_shape)
    kernel_h, kernel_w = map(int, kernel_shape)
    stride_h, stride_w = _pair(stride, "stride")
    pad_h, pad_w = _pair(padding, "padding")
    dilation_h, dilation_w = _pair(dilation, "dilation")
    effective_h = dilation_h * (kernel_h - 1) + 1
    effective_w = dilation_w * (kernel_w - 1) + 1
    out_h = (in_h + 2 * pad_h - effective_h) // stride_h + 1
    out_w = (in_w + 2 * pad_w - effective_w) // stride_w + 1
    if out_h <= 0 or out_w <= 0:
        raise ValueError("kernel does not fit the padded input")
    return out_h, out_w


def conv2d(
    inputs: ArrayLike,
    kernels: ArrayLike,
    bias: ArrayLike | None = None,
    *,
    stride: int | Sequence[int] = 1,
    padding: int | Sequence[int] = 0,
    dilation: int | Sequence[int] = 1,
) -> FloatArray:
    """A slow cross-correlation operator exposing stride, padding and dilation.

    Multi-channel shapes are ``inputs=(channels, height, width)`` and
    ``kernels=(outputs, channels, kernel_h, kernel_w)``.  Supplying two 2D arrays
    returns a 2D result for convenient hand calculations.
    """

    x = np.asarray(inputs, dtype=float)
    w = np.asarray(kernels, dtype=float)
    squeeze = x.ndim == 2 and w.ndim == 2
    if x.ndim == 2:
        x = x[None, ...]
    if w.ndim == 2:
        w = w[None, None, ...]
    if x.ndim != 3 or w.ndim != 4:
        raise ValueError("expected 2D arrays or channel-first convolution arrays")
    if x.shape[0] != w.shape[1]:
        raise ValueError("input and kernel channel counts differ")

    stride_h, stride_w = _pair(stride, "stride")
    pad_h, pad_w = _pair(padding, "padding")
    dilation_h, dilation_w = _pair(dilation, "dilation")
    out_h, out_w = conv_output_shape(
        x.shape[-2:],
        w.shape[-2:],
        stride=(stride_h, stride_w),
        padding=(pad_h, pad_w),
        dilation=(dilation_h, dilation_w),
    )
    padded = np.pad(x, ((0, 0), (pad_h, pad_h), (pad_w, pad_w)))
    output = np.empty((w.shape[0], out_h, out_w), dtype=float)
    kernel_h, kernel_w = w.shape[-2:]
    for out_channel in range(w.shape[0]):
        for row in range(out_h):
            row_indices = row * stride_h + np.arange(kernel_h) * dilation_h
            for column in range(out_w):
                column_indices = column * stride_w + np.arange(kernel_w) * dilation_w
                patch = padded[:, row_indices[:, None], column_indices[None, :]]
                output[out_channel, row, column] = np.sum(patch * w[out_channel])
    if bias is not None:
        offset = np.asarray(bias, dtype=float)
        if offset.ndim == 0:
            output += offset
        else:
            output += offset.reshape(-1, 1, 1)
    return output[0] if squeeze else output


def dilated_conv2d(
    inputs: ArrayLike,
    kernels: ArrayLike,
    dilation: int | Sequence[int],
    **kwargs: object,
) -> FloatArray:
    """Name the dilation argument explicitly while delegating to :func:`conv2d`."""

    return conv2d(inputs, kernels, dilation=dilation, **kwargs)


def max_pool2d(
    inputs: ArrayLike,
    kernel_size: int | Sequence[int],
    *,
    stride: int | Sequence[int] | None = None,
) -> FloatArray:
    """Channel-first max pooling without padding."""

    x = np.asarray(inputs, dtype=float)
    squeeze = x.ndim == 2
    if squeeze:
        x = x[None, ...]
    if x.ndim != 3:
        raise ValueError("max_pool2d expects (channels, height, width) or a 2D array")
    kernel_h, kernel_w = _pair(kernel_size, "kernel_size")
    stride_h, stride_w = _pair(kernel_size if stride is None else stride, "stride")
    out_h, out_w = conv_output_shape(x.shape[-2:], (kernel_h, kernel_w), stride=(stride_h, stride_w))
    output = np.empty((x.shape[0], out_h, out_w), dtype=float)
    for row in range(out_h):
        for column in range(out_w):
            patch = x[
                :,
                row * stride_h : row * stride_h + kernel_h,
                column * stride_w : column * stride_w + kernel_w,
            ]
            output[:, row, column] = np.max(patch, axis=(-2, -1))
    return output[0] if squeeze else output


def receptive_field(dilations: Sequence[int], kernel_size: int = 3) -> int:
    """Compute the 1D receptive-field width for stride-one dilated layers."""

    if kernel_size <= 0 or any(dilation <= 0 for dilation in dilations):
        raise ValueError("kernel size and dilations must be positive")
    return 1 + (kernel_size - 1) * sum(dilations)


def residual_block(
    inputs: ArrayLike,
    residual_function: Callable[[FloatArray], ArrayLike],
    *,
    projection: Callable[[FloatArray], ArrayLike] | None = None,
    post_activation: Callable[[FloatArray], ArrayLike] | None = None,
) -> FloatArray:
    """Compute ``shortcut(x) + F(x)`` with an optional post-addition activation."""

    x = np.asarray(inputs, dtype=float)
    shortcut = x if projection is None else np.asarray(projection(x), dtype=float)
    residual = np.asarray(residual_function(x), dtype=float)
    if shortcut.shape != residual.shape:
        raise ValueError("shortcut and residual branches must have equal shapes")
    output = shortcut + residual
    return output if post_activation is None else np.asarray(post_activation(output), dtype=float)


def shortcut_gradient_product(shortcut_derivatives: ArrayLike) -> float:
    """Return the scalar gradient multiplier across consecutive shortcut maps."""

    derivatives = np.asarray(shortcut_derivatives, dtype=float)
    return float(np.prod(derivatives))


def cross_entropy(logits: ArrayLike, targets: ArrayLike) -> float:
    """Mean multiclass cross-entropy for integer targets."""

    scores = np.asarray(logits, dtype=float)
    labels = np.asarray(targets, dtype=int)
    if scores.ndim == 1:
        scores = scores[None, :]
        labels = labels.reshape(1)
    if scores.ndim != 2 or labels.shape != (scores.shape[0],):
        raise ValueError("expected logits=(batch, classes) and one target per row")
    shifted = scores - np.max(scores, axis=1, keepdims=True)
    log_normalizer = np.log(np.sum(np.exp(shifted), axis=1))
    return float(np.mean(log_normalizer - shifted[np.arange(scores.shape[0]), labels]))


def numerical_gradient(
    function: Callable[[FloatArray], float],
    point: ArrayLike,
    epsilon: float = 1e-5,
) -> FloatArray:
    """Central-difference gradient for small debugging problems."""

    if epsilon <= 0:
        raise ValueError("epsilon must be positive")
    x = np.asarray(point, dtype=float).copy()
    gradient = np.empty_like(x)
    for index in np.ndindex(x.shape):
        original = x[index]
        x[index] = original + epsilon
        positive = float(function(x))
        x[index] = original - epsilon
        negative = float(function(x))
        x[index] = original
        gradient[index] = (positive - negative) / (2.0 * epsilon)
    return gradient


def relative_error(left: ArrayLike, right: ArrayLike, epsilon: float = 1e-12) -> float:
    """Maximum symmetric relative error used in gradient checks."""

    a = np.asarray(left, dtype=float)
    b = np.asarray(right, dtype=float)
    denominator = np.maximum(epsilon, np.abs(a) + np.abs(b))
    return float(np.max(np.abs(a - b) / denominator))
