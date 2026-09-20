"""Original column-oriented subset of the datascience Table API."""

import csv
import html
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

import numpy as np

from shelf_events import check_api, emit

from .predicates import Predicate, are
from . import table_charts
from .table_helpers import (
    aggregation_array,
    buckets,
    collected,
    collected_label,
    join_indices,
    key,
    predicate_mask,
    unique_label,
)


class Row(tuple):
    def __new__(cls, values, labels):
        row = super().__new__(cls, values)
        row._labels = labels
        return row

    def item(self, index):
        if isinstance(index, str):
            index = self._labels.index(index)
        return self[index]

    def __repr__(self):
        return (
            "Row("
            + ", ".join(
                f"{label}={value!r}" for label, value in zip(self._labels, self)
            )
            + ")"
        )


class Rows(Sequence):
    def __init__(self, table):
        self._table = table

    def __len__(self):
        return self._table._num_rows

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self._table.row(i) for i in range(len(self))[index]]
        return self._table.row(index)


class _RowSelection:
    def __init__(self, table, exclude=False):
        self.table = table
        self.exclude = exclude

    def __call__(self, *indices):
        name = "exclude" if self.exclude else "take"
        check_api(name)
        single = len(indices) == 1 and np.isscalar(indices[0])
        if len(indices) == 1 and isinstance(indices[0], Iterable):
            indices = tuple(indices[0])
        if self.exclude:
            if single:
                indices = (indices[0] % self.table._num_rows,)
            chosen = np.array(
                [i for i in range(self.table._num_rows) if i not in indices], dtype=int
            )
            result = self.table._rows_at(chosen)
        else:
            chosen = np.arange(self.table._num_rows).take(indices)
            result = self.table._rows_at(chosen) if single else self.table._take(chosen)
        emit(name, (self.table,), result, indices=chosen)
        return result

    def __getitem__(self, index):
        if isinstance(index, slice):
            name = "exclude" if self.exclude else "take"
            check_api(name)
            rows = np.arange(self.table._num_rows)
            if self.exclude:
                chosen = np.r_[rows[: index.start or 0], rows[index.stop or 0 :]]
            else:
                chosen = rows[index]
            result = self.table._rows_at(chosen)
            emit(name, (self.table,), result, indices=chosen)
            return result
        return self(index)


class Table:
    def __init__(self, labels=None, formatter=None):
        check_api("Table")
        if formatter is not None:
            raise NotImplementedError("Custom table formatters are not supported")
        self._columns = {}
        self._num_rows = 0
        if labels is not None:
            for label in labels:
                self._validate_label(label)
                self._columns[label] = np.array([])
        emit("Table", (), self)

    @staticmethod
    def _validate_label(label):
        if not isinstance(label, str):
            raise ValueError(
                f"The column label must be a string, but a {type(label).__name__} was given"
            )

    @classmethod
    def _from_columns(cls, columns):
        result = object.__new__(cls)
        result._columns = dict(columns)
        result._num_rows = len(next(iter(result._columns.values()), []))
        return result

    def _label(self, index):
        if isinstance(index, (int, np.integer)):
            if 0 <= index < len(self._columns):
                return tuple(self._columns)[index]
            raise ValueError(f"Column index {index} is out of range")
        if index not in self._columns:
            raise ValueError(
                f'The column "{index}" is not in the table. '
                f"The table contains these columns: {', '.join(self._columns)}"
            )
        return index

    def _column(self, column_or_label):
        if isinstance(column_or_label, (str, int, np.integer)):
            return self._columns[self._label(column_or_label)]
        return np.asarray(column_or_label)

    def _take(self, indices):
        return self._from_columns(
            (label, values[indices]) for label, values in self._columns.items()
        )

    def _rows_at(self, indices):
        if not len(indices):
            return self._from_columns(())
        return self._from_columns(
            (label, np.array([values[i] for i in indices]))
            for label, values in self._columns.items()
        )

    @property
    def labels(self):
        check_api("labels")
        result = tuple(self._columns)
        emit("labels", (self,), result)
        return result

    @property
    def num_rows(self):
        check_api("num_rows")
        emit("num_rows", (self,), self._num_rows)
        return self._num_rows

    @property
    def num_columns(self):
        check_api("num_columns")
        result = len(self._columns)
        emit("num_columns", (self,), result)
        return result

    @property
    def rows(self):
        check_api("rows")
        result = Rows(self)
        emit("rows", (self,), self)
        return result

    @property
    def take(self):
        return _RowSelection(self)

    @property
    def exclude(self):
        return _RowSelection(self, exclude=True)

    def column(self, index_or_label):
        check_api("column")
        result = self._columns[self._label(index_or_label)]
        emit("column", (self,), result, label=self._label(index_or_label))
        return result

    def with_column(self, label, values, formatter=None):
        check_api("with_column")
        self._validate_label(label)
        if np.isscalar(values) or values is None:
            values = np.repeat(values, self._num_rows or 1)
        else:
            values = np.array(
                tuple(values) if not isinstance(values, np.ndarray) else values
            )
        if self._num_rows and len(values) != self._num_rows:
            raise ValueError(
                "Column length mismatch. New column does not have the same number of rows as table."
            )
        columns = dict(self._columns)
        columns[label] = values
        result = self._from_columns(columns.items())
        result._num_rows = len(values)
        emit("with_column", (self, values), result, label=label)
        return result

    def with_columns(self, *labels_and_values, **formatter):
        check_api("with_columns")
        arguments = labels_and_values
        if len(arguments) == 1:
            if isinstance(arguments[0], Mapping):
                arguments = tuple(
                    item for pair in arguments[0].items() for item in pair
                )
            else:
                arguments = tuple(arguments[0])
        if len(arguments) % 2:
            raise ValueError("with_columns requires alternating labels and values")
        result = self
        for label, values in zip(arguments[::2], arguments[1::2]):
            result = result.with_column(label, values)
        emit("with_columns", (self,), result, labels=tuple(result._columns))
        return result

    @staticmethod
    def _labels_args(labels):
        if len(labels) == 1 and not isinstance(labels[0], (str, int, np.integer)):
            return tuple(labels[0])
        return labels

    def select(self, *labels):
        check_api("select")
        selected = [self._label(label) for label in self._labels_args(labels)]
        result = self._from_columns((label, self._columns[label]) for label in selected)
        emit("select", (self,), result, labels=selected)
        return result

    def drop(self, *labels):
        check_api("drop")
        dropped = {
            self._label(label) if isinstance(label, (int, np.integer)) else label
            for label in self._labels_args(labels)
        }
        result = self._from_columns(
            (label, values)
            for label, values in self._columns.items()
            if label not in dropped
        )
        emit("drop", (self,), result, labels=sorted(dropped))
        return result

    def relabeled(self, label, new_label):
        check_api("relabeled")
        old = [label] if isinstance(label, (str, int, np.integer)) else list(label)
        new = [new_label] if isinstance(new_label, str) else list(new_label)
        if len(old) != len(new):
            raise ValueError("The number of old and new labels must match")
        replacement = dict(
            zip(
                (
                    tuple(self._columns)[item]
                    if isinstance(item, (int, np.integer))
                    else self._label(item)
                    for item in old
                ),
                new,
            )
        )
        labels = [replacement.get(item, item) for item in self._columns]
        for item in labels:
            self._validate_label(item)
        if len(set(labels)) != len(labels):
            raise ValueError("Duplicate column labels")
        result = self._from_columns(zip(labels, self._columns.values()))
        emit("relabeled", (self,), result, labels=labels)
        return result

    def row(self, index):
        check_api("row")
        if index >= self._num_rows or index < -self._num_rows:
            raise IndexError(f"Row index {index} is out of range")
        result = Row(
            (column[index] for column in self._columns.values()), tuple(self._columns)
        )
        emit("row", (self,), result, index=index)
        return result

    def sort(self, column_or_label, descending=False, distinct=False):
        check_api("sort")
        values = self._column(column_or_label)
        if distinct:
            _, indices = np.unique(values, return_index=True)
            if descending:
                indices = indices[::-1]
        elif descending:
            indices = len(values) - 1 - np.argsort(values[::-1], kind="stable")[::-1]
        else:
            indices = np.argsort(values, kind="stable")
        result = self._take(indices)
        _, tie_order, tie_offsets = buckets([values[indices]])
        emit(
            "sort",
            (self,),
            result,
            permutation=indices,
            descending=descending,
            distinct=distinct,
            sortValues=values[indices],
            tieGroups=[
                indices[tie_order[start:end]]
                for start, end in zip(tie_offsets[:-1], tie_offsets[1:])
                if end - start > 1
            ],
        )
        return result

    def where(self, column_or_label, value_or_predicate=None, other=None):
        check_api("where")
        values = self._column(column_or_label)
        if other is not None:
            other_values = self._column(other)
            mask = [value_or_predicate(b)(a) for a, b in zip(values, other_values)]
        elif callable(value_or_predicate):
            mask = predicate_mask(values, value_or_predicate)
        elif value_or_predicate is None:
            mask = values
        else:
            predicate = are.equal_to(value_or_predicate)
            mask = predicate_mask(values, predicate)
        indices = np.flatnonzero(mask)
        result = self._take(indices)
        predicate = (
            repr(value_or_predicate)
            if isinstance(value_or_predicate, Predicate)
            else (
                "custom predicate"
                if callable(value_or_predicate)
                else repr(value_or_predicate)
            )
        )
        emit("where", (self,), result, keptIndices=indices, predicate=predicate)
        return result

    def apply(self, fn, *column_or_columns):
        check_api("apply")
        labels = self._labels_args(column_or_columns)
        if labels:
            columns = [self._columns[self._argument_label(label)] for label in labels]
            result = np.array([fn(*row) for row in zip(*columns)])
        else:
            result = np.array(
                [
                    fn(Row(row, tuple(self._columns)))
                    for row in zip(*self._columns.values())
                ]
            )
        emit("apply", (self,), result, columns=labels)
        return result

    def _argument_label(self, label):
        if isinstance(label, (int, np.integer)):
            return tuple(self._columns)[label]
        return self._label(label)

    def _group_columns(self, column_or_label):
        if isinstance(column_or_label, (str, int, np.integer)):
            label = self._label(column_or_label)
            return [label], [self._columns[label]]
        labels = list(column_or_label)
        if not labels:
            raise ValueError("At least one grouping column is required")
        if len(labels) == self._num_rows:
            return ["group"], [np.asarray(labels)]
        labels = [self._argument_label(label) for label in labels]
        return labels, [self._columns[label] for label in labels]

    def group(self, column_or_label, collect=None):
        check_api("group")
        if collect is not None and not callable(collect):
            raise TypeError("collect must be callable")
        labels, columns = self._group_columns(column_or_label)
        first, order, offsets = buckets(columns)
        output = {
            label: np.array(column[first].tolist())
            for label, column in zip(labels, columns)
        }
        if collect is None:
            if "count" not in output:
                output["count"] = np.array(np.diff(offsets).tolist())
        else:
            for label, column in self._columns.items():
                if label not in labels:
                    output[unique_label(collected_label(label, collect), output)] = (
                        aggregation_array(
                            [
                                collected(collect, column[order[start:end]])
                                for start, end in zip(offsets[:-1], offsets[1:])
                            ]
                        )
                    )
        result = self._from_columns(output.items())
        emit(
            "group",
            (self,),
            result,
            labels=labels,
            keys=[column[first] for column in columns],
            bucketIndices=order,
            bucketOffsets=offsets,
            buckets=[
                {
                    "key": [column[index] for column in columns],
                    "indices": order[start:end],
                }
                for index, start, end in zip(first[:100], offsets[:-1], offsets[1:])
            ],
            bucketCount=len(first),
        )
        return result

    def pivot(self, columns, rows, values=None, collect=None, zero=None):
        check_api("pivot")
        if (values is None) != (collect is None):
            raise TypeError("values and collect must be specified together")
        column_label = self._argument_label(columns)
        row_labels = [
            self._argument_label(label) for label in self._labels_args((rows,))
        ]
        if column_label in row_labels:
            raise TypeError("Pivot row and column labels must differ")
        if not row_labels:
            raise ValueError("At least one pivot row column is required")
        row_columns = [self._columns[label] for label in row_labels]
        category = self._columns[column_label]
        row_first, row_order, row_offsets = buckets(row_columns)
        cell_first, _, _ = buckets([category, *row_columns])
        col_first, _, _ = buckets([category[cell_first]])
        col_first = cell_first[col_first]
        row_ids = np.empty(self._num_rows, dtype=int)
        row_ids[row_order] = np.repeat(np.arange(len(row_first)), np.diff(row_offsets))
        categories = {key(category[i]): n for n, i in enumerate(col_first)}
        cells = {}
        for i, value in enumerate(category):
            cells.setdefault((row_ids[i], categories[key(value)]), []).append(i)
        value_label = None if values is None else self._argument_label(values)
        value_column = None if values is None else self._columns[value_label]
        cell_values = {
            cell: (
                len(indices)
                if collect is None
                else ""
                if value_label in [column_label, *row_labels]
                else collected(collect, value_column[indices])
            )
            for cell, indices in cells.items()
        }
        if zero is None:
            zero = type(next(iter(cell_values.values()), 0))()
        output = {
            label: np.array(column[row_first].tolist())
            for label, column in zip(row_labels, row_columns)
        }
        for column_id, index in enumerate(col_first):
            entries = []
            for row_id in range(len(row_first)):
                entries.append(cell_values.get((row_id, column_id), zero))
            output[unique_label(str(category[index]), output)] = np.array(entries)
        result = self._from_columns(output.items())
        emit(
            "pivot",
            (self,),
            result,
            rowLabels=row_labels,
            columnLabel=column_label,
            cells=[
                {"row": row, "column": column, "indices": indices}
                for (row, column), indices in cells.items()
            ],
            rowKeys=[column[row_first] for column in row_columns],
            columnKeys=category[col_first],
        )
        return result

    def join(self, column_label, other, other_label=None):
        check_api("join")
        left_labels = list(self._labels_args((column_label,)))
        right_labels = list(
            self._labels_args((column_label if other_label is None else other_label,))
        )
        left_columns = [self._column(label) for label in left_labels]
        right_columns = [other._column(label) for label in right_labels]
        if len(left_labels) != len(right_labels):
            raise ValueError("Join keys must have the same length")
        left_indices, right_indices = join_indices(left_columns, right_columns)
        result = None
        if len(left_indices):
            if any(not isinstance(label, str) for label in left_labels + right_labels):
                raise KeyError(column_label)
            output = {
                label: self._columns[label][left_indices] for label in left_labels
            }
            output.update(
                {
                    label: column[left_indices]
                    for label, column in self._columns.items()
                    if label not in left_labels
                }
            )
            for label, column in other._columns.items():
                if label not in right_labels:
                    output[unique_label(label, output)] = column[right_indices]
            output = {
                label: np.array(column.tolist())
                if column.dtype.kind in "US"
                else column
                for label, column in output.items()
            }
            result = self._from_columns(output.items())
        left_used = np.zeros(self._num_rows, dtype=bool)
        right_used = np.zeros(other._num_rows, dtype=bool)
        left_used[left_indices] = True
        right_used[right_indices] = True
        emit(
            "join",
            (self, other),
            result,
            matchedPairs=np.column_stack(
                (left_indices[:100], right_indices[:100])
            ).tolist(),
            matchedPairCount=len(left_indices),
            leftIndices=left_indices,
            rightIndices=right_indices,
            unmatchedLeftIndices=np.flatnonzero(~left_used),
            unmatchedRightIndices=np.flatnonzero(~right_used),
            leftLabels=left_labels,
            rightLabels=right_labels,
        )
        return result

    def sample(self, k=None, with_replacement=True, weights=None):
        check_api("sample")
        k = self._num_rows if k is None else k
        indices = np.random.choice(
            self._num_rows, k, replace=with_replacement, p=weights
        )
        result = self._from_columns(
            (label, np.array(column[indices].tolist()))
            for label, column in self._columns.items()
        )
        emit(
            "sample", (self,), result, indices=indices, withReplacement=with_replacement
        )
        return result

    def barh(
        self, column_for_categories=None, select=None, overlay=True, width=None, **vargs
    ):
        check_api("barh")
        return table_charts.barh(
            self, column_for_categories, select, overlay, width, vargs
        )

    def hist(
        self,
        *columns,
        overlay=True,
        bins=None,
        bin_column=None,
        unit=None,
        counts=None,
        group=None,
        rug=False,
        side_by_side=False,
        left_end=None,
        right_end=None,
        width=None,
        height=None,
        **vargs,
    ):
        check_api("hist")
        return table_charts.histogram(
            self,
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
            vargs,
        )

    def scatter(
        self,
        column_for_x,
        select=None,
        overlay=True,
        fit_line=False,
        group=None,
        labels=None,
        sizes=None,
        width=None,
        height=None,
        s=20,
        **vargs,
    ):
        check_api("scatter")
        return table_charts.scatter(
            self,
            column_for_x,
            select,
            overlay,
            fit_line,
            group,
            labels,
            sizes,
            width,
            height,
            s,
            vargs,
        )

    def plot(
        self,
        column_for_xticks=None,
        select=None,
        overlay=True,
        width=None,
        height=None,
        **vargs,
    ):
        check_api("plot")
        return table_charts.plot(
            self, column_for_xticks, select, overlay, width, height, vargs
        )

    def show(self, max_rows=0):
        check_api("show")
        print(self.as_text(max_rows=max_rows))
        emit("show", (self,), self, maxRows=max_rows)

    def as_text(self, max_rows=0, sep=" | "):
        if max_rows and (not isinstance(max_rows, (int, np.integer)) or max_rows < 0):
            raise ValueError("max_rows must be a nonnegative integer")
        count = self._num_rows if not max_rows else min(max_rows, self._num_rows)
        labels = tuple(self._columns)
        rows = [
            [self._format(self._columns[label][i]) for label in labels]
            for i in range(count)
        ]
        widths = [
            max([4, len(label), *(len(row[i]) for row in rows)])
            for i, label in enumerate(labels)
        ]
        lines = [
            sep.join(
                label.ljust(width) for label, width in zip(labels, widths)
            ).rstrip()
        ]
        lines.extend(
            sep.join(cell.ljust(width) for cell, width in zip(row, widths)).rstrip()
            for row in rows
        )
        if count < self._num_rows:
            lines.append(f"... ({self._num_rows - count} rows omitted)")
        return "\n".join(lines)

    @staticmethod
    def _format(value):
        if isinstance(value, (float, np.floating)):
            return f"{value:g}"
        return str(value)

    def __repr__(self):
        return self.as_text()

    def _repr_html_(self):
        labels = tuple(self._columns)
        header = "".join(f"<th>{html.escape(label)}</th>" for label in labels)
        body = "".join(
            "<tr>"
            + "".join(
                f"<td>{html.escape(self._format(self._columns[label][i]))}</td>"
                for label in labels
            )
            + "</tr>"
            for i in range(min(10, self._num_rows))
        )
        omitted = (
            f"<p>... ({self._num_rows - 10} rows omitted)</p>"
            if self._num_rows > 10
            else ""
        )
        return f"<table><thead><tr>{header}</tr></thead><tbody>{body}</tbody></table>{omitted}"

    @classmethod
    def read_table(cls, filepath_or_buffer, *args, **kwargs):
        check_api("read_table")
        precision = kwargs.pop("float_precision", "round_trip")
        if args or kwargs or precision != "round_trip":
            raise TypeError("Bundled CSVs use their declared comma-separated format")
        root = Path(__file__).resolve().parent.parent / "data"
        path = (root / str(filepath_or_buffer)).resolve()
        if not path.is_relative_to(root) or path.suffix.lower() != ".csv":
            raise ValueError(
                "Choose a bundled local CSV file; network paths are not supported"
            )
        with path.open(newline="", encoding="utf-8") as source:
            reader = csv.reader(source)
            labels = next(reader)
            rows = list(reader)
        if any(len(row) != len(labels) for row in rows):
            raise ValueError(
                "CSV rows must have the same number of cells as the header"
            )
        missing = {
            "",
            "NaN",
            "nan",
            "N/A",
            "NA",
            "NULL",
            "null",
            "None",
            "<NA>",
            "#N/A",
            "#N/A N/A",
            "#NA",
            "-1.#IND",
            "-1.#QNAN",
            "-NaN",
            "-nan",
            "1.#IND",
            "1.#QNAN",
            "n/a",
        }
        boolean = {
            "True": True,
            "TRUE": True,
            "true": True,
            "False": False,
            "FALSE": False,
            "false": False,
        }
        columns = []
        for i, label in enumerate(labels):
            values = [np.nan if row[i] in missing else row[i] for row in rows]
            try:
                numeric = [int(value) for value in values]
            except ValueError:
                try:
                    numeric = [float(value) for value in values]
                except ValueError:
                    if all(
                        not isinstance(value, str) or value in boolean
                        for value in values
                    ):
                        numeric = [
                            boolean[value] if isinstance(value, str) else value
                            for value in values
                        ]
                    else:
                        numeric = values
            columns.append((label, np.array(numeric)))
        result = cls._from_columns(columns)
        emit("read_table", (), result, filename=path.name)
        return result
