"""Computed chart data, independent of any plotting backend."""

import math

import numpy as np

from shelf_events import emit

from .table_helpers import buckets

STYLE_OPTIONS = {
    "alpha",
    "color",
    "colors",
    "label",
    "linewidth",
    "linestyle",
    "marker",
    "edgecolor",
    "facecolor",
    "zorder",
    "xlim",
    "ylim",
    "title",
    "xlabel",
    "ylabel",
    "log",
    "clip_on",
    "hatch",
}


def numeric(values):
    if values.dtype.kind not in "iuf":
        raise ValueError("The selected columns must contain numerical values")
    return values


def linear_fit(x, y):
    if len(x) == 0:
        raise TypeError("expected non-empty vector for x")
    x_values = [float(value) for value in x]
    y_values = [float(value) for value in y]
    if not all(math.isfinite(value) for value in x_values) or not any(x_values):
        raise np.linalg.LinAlgError("SVD did not converge in Linear Least Squares")
    if not all(math.isfinite(value) for value in y_values):
        return np.array([np.nan, np.nan])
    x_mean = math.fsum(x_values) / len(x_values)
    y_mean = math.fsum(y_values) / len(y_values)
    centered = [value - x_mean for value in x_values]
    variance = math.fsum(value * value for value in centered)
    if variance == 0:
        return np.array([y_mean / (2 * x_mean), y_mean / 2])
    slope = (
        math.fsum(dx * (value - y_mean) for dx, value in zip(centered, y_values))
        / variance
    )
    return np.array([slope, y_mean - slope * x_mean])


def select_columns(table, select, excluded):
    if select is None:
        return [label for label in table._columns if label not in excluded]
    return [table._label(label) for label in table._labels_args((select,))]


def settings(options, extra=()):
    unknown = options.keys() - STYLE_OPTIONS - set(extra)
    if unknown:
        raise AttributeError(f"Unsupported chart setting: {next(iter(unknown))}")
    return dict(options)


def publish(table, kind, series, axes, options):
    for item in series:
        item["pointCount"] = len(item["y"])
    first = series[0] if series else {}
    emit(
        kind,
        (table,),
        None,
        series=series,
        axes=axes,
        settings=options,
        x=first.get("x", []),
        y=first.get("y", []),
        labels=first.get("labels", []),
        label=first.get("label", kind),
    )


def barh(table, categories, select, overlay, width, options):
    label = table._label(categories)
    selected = select_columns(table, select, {label})
    indices = np.arange(table._num_rows - 1, -1, -1)
    series = [
        {
            "label": name,
            "x": np.arange(table._num_rows),
            "y": numeric(table._columns[name])[indices],
            "labels": table._columns[label][indices].astype(str),
            "indices": indices,
        }
        for name in selected
    ]
    publish(
        table,
        "barh",
        series,
        {"x": "", "y": label},
        {
            **settings(options, ("left", "height", "align", "xerr")),
            "overlay": overlay,
            "width": width,
        },
    )


def plot(table, column, select, overlay, width, height, options):
    if column is None:
        label, x = "", np.arange(table._num_rows)
    elif isinstance(column, (str, int, np.integer)):
        label = table._label(column)
        x = table._columns[label]
    else:
        label, x = "", np.asarray(column)
        if len(x) != table._num_rows:
            raise ValueError("The x values must match the number of rows")
    selected = select_columns(table, select, {label})
    indices = np.argsort(x, kind="stable")
    series = [
        {
            "label": name,
            "x": x[indices],
            "y": numeric(table._columns[name])[indices],
            "indices": indices,
            "labels": x[indices].astype(str),
        }
        for name in selected
    ]
    publish(
        table,
        "plot",
        series,
        {"x": label, "y": selected[0] if len(selected) == 1 else ""},
        {
            **settings(options, ("markersize", "drawstyle")),
            "overlay": overlay,
            "width": width,
            "height": height,
        },
    )


def scatter(
    table,
    column,
    select,
    overlay,
    fit_line,
    group,
    labels,
    sizes,
    width,
    height,
    s,
    options,
):
    if "colors" in options:
        group = options.pop("colors")
    x_label = table._label(column)
    x = numeric(table._columns[x_label])
    excluded = {x_label}
    auxiliary = {}
    for name, value in (("group", group), ("labels", labels), ("sizes", sizes)):
        if value is not None:
            label = table._label(value)
            excluded.add(label)
            auxiliary[name] = table._columns[label]
    selected = select_columns(table, select, excluded)
    if any(
        value is not None and table._label(value) == x_label
        for value in (group, labels, sizes)
    ):
        raise ValueError("The x column cannot also be an annotation column")
    if group is None:
        groups = [("", np.arange(table._num_rows))]
    else:
        first, order, offsets = buckets([auxiliary["group"]])
        groups = [
            (str(auxiliary["group"][i]), order[start:end])
            for i, start, end in zip(first, offsets[:-1], offsets[1:])
        ]
    point_sizes = s
    if sizes is not None:
        values = numeric(auxiliary["sizes"])
        point_sizes = 2 * s * np.sqrt(values / np.max(values))
    series = []
    for name in selected:
        y = numeric(table._columns[name])
        for category, indices in groups:
            item = {
                "label": f"{table._label(group)}={category}"
                if group is not None
                else name,
                "x": x[indices],
                "y": y[indices],
                "indices": indices,
                "sizes": point_sizes
                if np.isscalar(point_sizes)
                else point_sizes[indices],
            }
            if labels is not None:
                item["labels"] = auxiliary["labels"][indices]
            if fit_line:
                coefficients = linear_fit(x[indices], y[indices])
                ends = np.array([np.min(x[indices]), np.max(x[indices])])
                item["fitLine"] = {
                    "x": ends,
                    "y": np.polyval(coefficients, ends),
                    "coefficients": coefficients,
                }
            series.append(item)
    publish(
        table,
        "scatter",
        series,
        {"x": x_label, "y": selected[0] if len(selected) == 1 else ""},
        {
            **settings(
                options,
                (
                    "c",
                    "cmap",
                    "vmin",
                    "vmax",
                    "norm",
                    "marker",
                    "linewidths",
                    "edgecolors",
                ),
            ),
            "overlay": overlay,
            "fitLine": fit_line,
            "width": width,
            "height": height,
        },
    )


def histogram(
    table,
    columns,
    overlay,
    bins,
    bin_column,
    unit,
    counts,
    group,
    rug,
    side_by_side,
    left_end,
    right_end,
    width,
    height,
    options,
):
    options = settings(
        options,
        (
            "density",
            "cumulative",
            "range",
            "weights",
            "orientation",
            "histtype",
            "stacked",
            "rwidth",
            "align",
            "bottom",
            "shade_split",
        ),
    )
    if counts is not None:
        bin_column = counts
    excluded = {table._label(c) for c in (bin_column, group) if c is not None}
    selected = (
        [table._argument_label(c) for c in table._labels_args(columns)]
        if columns
        else [name for name in table._columns if name not in excluded]
    )
    if any(table._columns[name].dtype.kind == "b" for name in selected):
        raise TypeError("Boolean histogram bin subtraction is undefined")
    if group is not None and (bin_column is not None or len(selected) != 1):
        raise ValueError("Grouped histograms require one column and no bin column")
    datasets = []
    if bin_column is not None:
        data = numeric(table._column(bin_column))
        if bins is None:
            bins = np.sort(data)
        datasets = [
            (label, data, numeric(table._columns[label]), np.arange(len(data)))
            for label in selected
        ]
    elif group is not None:
        data = numeric(table._columns[selected[0]])
        categories = table._column(group)
        first, order, offsets = buckets([categories])
        datasets = [
            (
                f"{table._label(group)}={categories[i]}",
                data[order[start:end]],
                None,
                order[start:end],
            )
            for i, start, end in zip(first, offsets[:-1], offsets[1:])
        ]
    else:
        datasets = [
            (
                label,
                numeric(table._columns[label]),
                options.get("weights"),
                np.arange(table._num_rows),
            )
            for label in selected
        ]
    bins = 10 if bins is None else bins
    density = options.get("density", True)
    cumulative = options.get("cumulative", False)
    shared_bins = None
    if overlay and datasets:
        all_values = np.concatenate([data for _, data, _, _ in datasets])
        shared_bins = histogram_edges(all_values, bins, options.get("range"))
        datasets.reverse()
    series = []
    for label, data, weights, indices in datasets:
        edges = (
            shared_bins
            if shared_bins is not None
            else histogram_edges(data, bins, options.get("range"))
        )
        frequencies, _ = np.histogram(data, edges, weights=weights)
        heights = frequencies.astype(float)
        if density:
            with np.errstate(divide="ignore", invalid="ignore"):
                heights = 100 * heights / (np.sum(heights) * np.diff(edges))
        if cumulative:
            if density:
                heights = heights * np.diff(edges)
            heights = (
                np.cumsum(heights) if cumulative > 0 else np.cumsum(heights[::-1])[::-1]
            )
        item = {
            "label": label,
            "x": edges[:-1],
            "y": heights,
            "binEdges": edges,
            "counts": frequencies,
            "density": density,
            "indices": indices,
        }
        if rug:
            item["rug"] = data
        if left_end is not None or right_end is not None:
            item["shade"] = {
                "left": edges[0] if left_end is None else left_end,
                "right": edges[-1] if right_end is None else right_end,
                "split": options.get("shade_split", "whole"),
            }
        series.append(item)
    y_label = f"Percent per {unit or 'unit'}" if density else "Count"
    x_label = selected[0] if len(selected) == 1 else ""
    if unit is not None and x_label:
        x_label += f" ({unit})"
    publish(
        table,
        "hist",
        series,
        {"x": x_label, "y": y_label},
        {
            **options,
            "overlay": overlay,
            "sideBySide": side_by_side,
            "unit": unit,
            "width": width,
            "height": height,
            "rug": rug,
        },
    )


def histogram_edges(data, bins, value_range):
    finite = data[~np.isnan(data)]
    if len(data) and not len(finite) and np.isscalar(bins) and value_range is None:
        raise ValueError("Histogram range is not finite")
    return np.histogram_bin_edges(finite, bins, range=value_range)
