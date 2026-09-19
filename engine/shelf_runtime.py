"""Fresh, seeded notebook execution and version-one Director events."""

import ast
import builtins
import contextlib
import importlib.abc
import importlib.util
import io
import json
import math
import random
import sys
import time
import types
import weakref
from itertools import islice
from pathlib import PurePosixPath

import numpy as np
from datascience import Table, are, make_array

from shelf_events import observer

SNAPSHOT_LIMIT = 40
TEXT_LIMIT = 500
EVENT_LIMIT = 2000


class LockedAPIError(Exception):
    pass


class RunTimeout(BaseException):
    pass


def scalar(value, text_limit=None):
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, str) and text_limit is not None:
        return value[:text_limit]
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    raise TypeError(
        f"{type(value).__name__} cannot be delivered. Use a number, text, array or Table."
    )


def value_json(value, limit=None, object_id=None):
    text_limit = TEXT_LIMIT if limit is not None else None
    if isinstance(value, Table):
        count = value._num_rows if limit is None else min(value._num_rows, limit)
        columns = list(
            value._columns.items()
            if limit is None
            else islice(value._columns.items(), limit)
        )
        result = {
            "kind": "table",
            "labels": [scalar(label, text_limit) for label, _ in columns],
            "rows": [
                [scalar(column[i], text_limit) for _, column in columns]
                for i in range(count)
            ],
            "totalRows": value._num_rows,
        }
    elif isinstance(value, (np.ndarray, tuple, list, range)):
        if isinstance(value, np.ndarray):
            selected = value.flat if limit is None else value.flat[:limit]
        else:
            selected = value if limit is None else value[:limit]
        result = {
            "kind": "array",
            "values": [scalar(item, text_limit) for item in selected],
        }
    else:
        return scalar(value, text_limit)
    if object_id is not None:
        result["id"] = object_id
    return result


def from_json(value):
    if not isinstance(value, dict):
        return value
    if value.get("kind") == "array":
        return np.array(value["values"])
    if value.get("kind") == "table":
        labels, rows = value["labels"], value["rows"]
        if len(set(labels)) != len(labels) or not all(
            isinstance(label, str) for label in labels
        ):
            raise ValueError("Input table labels must be unique strings")
        if any(len(row) != len(labels) for row in rows):
            raise ValueError("Input table rows must match the labels")
        if value.get("totalRows", len(rows)) != len(rows):
            raise ValueError("Input tables must contain every row")
        return Table._from_columns(
            (label, np.array([row[i] for row in rows]))
            for i, label in enumerate(labels)
        )
    raise TypeError("Inputs must be scalar values or tagged arrays/tables")


class Trace:
    def __init__(self, enabled, allowed):
        self.enabled = enabled
        self.allowed = None if allowed is None else set(allowed)
        self.events = []
        self.objects = {}
        self.next_id = 1
        self.bindings = {}
        self.line = 0
        self.filename = "<player>"
        self.omitted = {}
        self.loops = {}

    def object_id(self, value):
        if not isinstance(value, (Table, np.ndarray)):
            return None
        key = id(value)
        if key not in self.objects:
            self.objects[key] = (
                weakref.ref(value, lambda reference: self.objects.pop(key, None)),
                f"object-{self.next_id}",
            )
            self.next_id += 1
        return self.objects[key][1]

    def snapshot(self, value):
        try:
            return value_json(value, SNAPSHOT_LIMIT, self.object_id(value))
        except (TypeError, ValueError):
            return f"<{type(value).__name__}>"

    def bounded(self, value, depth=0):
        if depth >= 8:
            return "<nested value>"
        if isinstance(value, np.ndarray):
            value = value.flat[:SNAPSHOT_LIMIT].tolist()
        if isinstance(value, (tuple, list)):
            return [self.bounded(item, depth + 1) for item in value[:SNAPSHOT_LIMIT]]
        if isinstance(value, dict):
            return {
                str(key): self.bounded(item, depth + 1)
                for key, item in islice(value.items(), SNAPSHOT_LIMIT)
            }
        if isinstance(value, slice):
            return [value.start, value.stop, value.step]
        return self.snapshot(value)

    def event(self, name, inputs=(), output=None, details=None, force=False):
        if not self.enabled:
            return
        if len(self.events) >= EVENT_LIMIT and not force:
            self.omitted[name] = self.omitted.get(name, 0) + 1
            return
        details = {} if details is None else details
        payload = {key: self.bounded(value) for key, value in details.items()}
        for key, value in details.items():
            if isinstance(value, (np.ndarray, list, tuple)):
                payload[f"{key}Count"] = len(value)
        payload["value"] = self.snapshot(output)
        payload["inputValues"] = [
            self.snapshot(item) for item in inputs[:SNAPSHOT_LIMIT]
        ]
        payload["inputCount"] = len(inputs)
        payload["filename"] = self.filename
        if isinstance(output, Table):
            payload["totalColumns"] = len(output._columns)
        if isinstance(output, str):
            payload["totalCharacters"] = len(output)
        if isinstance(output, np.ndarray):
            payload["totalValues"] = int(output.size)
            payload["shape"] = list(output.shape)
            payload["dtype"] = str(output.dtype)
        self.events.append(
            {
                "version": 1,
                "seq": len(self.events),
                "type": name,
                "line": self.line,
                "inputs": [
                    key
                    for item in inputs[:SNAPSHOT_LIMIT]
                    if (key := self.object_id(item)) is not None
                ],
                "output": self.object_id(output),
                "payload": payload,
            }
        )

    def operation(self, name, inputs, output, details):
        self.event(name, inputs, output, details)

    def check_api(self, name):
        if self.allowed is None:
            return
        caller = sys._getframe(3)
        if caller.f_code.co_filename not in ("<player>",) and not (
            caller.f_code.co_filename.startswith("<file:")
        ):
            return
        candidates = {name, f"Table.{name}", f"np.{name}", f"numpy.{name}"}
        if not candidates.intersection(self.allowed):
            raise LockedAPIError(f"{name} is not unlocked in this chapter.")

    def scan(self, namespace, scope="global"):
        if not self.enabled or len(self.events) >= EVENT_LIMIT:
            return
        current = {
            name: (id(value), self.object_id(value))
            for name, value in namespace.items()
            if not name.startswith(("_shelf_", "__"))
            and isinstance(
                value,
                (
                    Table,
                    np.ndarray,
                    np.generic,
                    str,
                    int,
                    float,
                    bool,
                    list,
                    tuple,
                    range,
                    type(None),
                ),
            )
        }
        previous = self.bindings.get(scope, {})
        for name, key in previous.items():
            if current.get(name) != key:
                self.event(
                    "unbind", details={"name": name, "objectId": key[1], "scope": scope}
                )
        for name, key in current.items():
            if previous.get(name) != key:
                self.event(
                    "bind",
                    output=namespace[name],
                    details={"name": name, "scope": scope},
                )
        self.bindings[scope] = current

    def loop(self, phase, loop_id, line):
        self.line = line
        if phase == "start":
            self.loops.setdefault(loop_id, []).append(0)
        stack = self.loops[loop_id]
        if phase == "iteration":
            stack[-1] += 1
        self.event(f"loop_{phase}", details={"loopId": loop_id, "count": stack[-1]})
        if phase == "end":
            stack.pop()

    def prepare(self, function, line, spelling):
        is_numpy = type(function).__module__.startswith("numpy")
        if isinstance(function, (types.FunctionType, types.BuiltinFunctionType, type)):
            is_numpy = is_numpy or (function.__module__ or "").startswith("numpy")
        if isinstance(function, types.BuiltinFunctionType):
            is_numpy = is_numpy or isinstance(function.__self__, np.ndarray)
        if not is_numpy:
            return function

        def invoke(*args, **kwargs):
            self.line = line
            if self.allowed is not None:
                name = spelling
                if not (
                    {name, name.removeprefix("numpy."), name.split(".")[-1]}
                    & self.allowed
                ):
                    raise LockedAPIError(f"{name} is not unlocked in this chapter.")
            inputs = args
            if isinstance(function, types.BuiltinFunctionType) and isinstance(
                function.__self__, np.ndarray
            ):
                inputs = (function.__self__, *args)
            before = (
                [self.snapshot(item) for item in inputs[:SNAPSHOT_LIMIT]]
                if self.enabled
                else []
            )
            result = function(*args, **kwargs)
            self.event(
                "numpy",
                inputs,
                result,
                {"function": spelling, "arguments": before, "keywords": kwargs},
            )
            return result

        return invoke

    def finish(self):
        if self.omitted:
            self.event(
                "trace_summary",
                details={
                    "omittedEvents": self.omitted,
                    "omittedCount": sum(self.omitted.values()),
                },
                force=True,
            )


class Instrument(ast.NodeTransformer):
    def __init__(self, prefix, filename):
        self.prefix = prefix
        self.filename = filename

    def helper(self, suffix, arguments):
        return ast.Call(
            func=ast.Name(id=self.prefix + suffix, ctx=ast.Load()),
            args=arguments,
            keywords=[],
        )

    def visit_Call(self, node):
        spelling = ast.unparse(node.func)
        self.generic_visit(node)
        node.func = ast.copy_location(
            self.helper(
                "prepare",
                [node.func, ast.Constant(node.lineno), ast.Constant(spelling)],
            ),
            node.func,
        )
        return node

    def instrument_loop(self, node):
        self.generic_visit(node)
        loop_id = f"{self.filename}:{node.lineno}:{node.col_offset}"

        def event(phase):
            return ast.copy_location(
                ast.Expr(
                    value=self.helper(
                        "loop",
                        [
                            ast.Constant(phase),
                            ast.Constant(loop_id),
                            ast.Constant(node.lineno),
                        ],
                    )
                ),
                node,
            )

        node.body.insert(0, event("iteration"))
        return [
            event("start"),
            ast.copy_location(
                ast.Try(body=[node], handlers=[], orelse=[], finalbody=[event("end")]),
                node,
            ),
        ]

    visit_For = instrument_loop
    visit_While = instrument_loop


def compile_player(code, filename, trace, namespace, last_expression=False):
    tree = ast.parse(code, filename=filename)
    prefix = "_shelf_"
    while prefix in code or any(name.startswith(prefix) for name in namespace):
        prefix += "_"
    namespace[prefix + "prepare"] = trace.prepare
    namespace[prefix + "loop"] = trace.loop
    tree = Instrument(prefix, filename).visit(tree)
    result_name = prefix + "result"
    if last_expression and tree.body and isinstance(tree.body[-1], ast.Expr):
        previous = tree.body[-1]
        tree.body[-1] = ast.copy_location(
            ast.Assign(
                targets=[ast.Name(id=result_name, ctx=ast.Store())],
                value=previous.value,
            ),
            previous,
        )
    return compile(ast.fix_missing_locations(tree), filename, "exec"), result_name


class PlayerFiles(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def __init__(self, files, trace, base):
        self.sources = {}
        self.packages = set()
        self.trace = trace
        self.base = base
        for filename, source in files.items():
            path = PurePosixPath(filename)
            if path.is_absolute() or ".." in path.parts or path.suffix != ".py":
                raise ValueError("Player files must be relative Python script names")
            parts = list(path.with_suffix("").parts)
            if parts[-1] == "__init__":
                parts.pop()
                self.packages.add(".".join(parts))
            if not parts or any(not part.isidentifier() for part in parts):
                raise ValueError("Use valid Python identifiers for script filenames")
            name = ".".join(parts)
            self.sources[name] = source
            self.packages.update(".".join(parts[:i]) for i in range(1, len(parts)))
        self.names = set(self.sources) | self.packages

    def find_spec(self, fullname, path=None, target=None):
        if fullname in self.names:
            return importlib.util.spec_from_loader(
                fullname, self, is_package=fullname in self.packages
            )
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        module.__dict__.update(self.base)
        module.__dict__["__builtins__"] = dict(builtins.__dict__)
        module.__dict__["__name__"] = module.__spec__.name
        source = self.sources.get(module.__name__, "")
        code, _ = compile_player(
            source, f"<file:{module.__name__}>", self.trace, module.__dict__
        )
        exec(code, module.__dict__)


def friendly(error):
    message = str(error)
    if isinstance(error, RunTimeout):
        return "Shelby is walking in circles. Check your loop, then try again."
    if isinstance(error, LockedAPIError):
        return "That tool is still on a locked shelf. Try a tool you have learned."
    if isinstance(error, SyntaxError):
        return "Python could not read this line. Check punctuation, indentation and brackets."
    if isinstance(error, NameError):
        return (
            "This name has no label yet. Check its spelling or assign it a value first."
        )
    if isinstance(error, IndexError):
        return "That position is off the shelf. Counting starts at zero; check the array or table size."
    if "column" in message.lower() and "not in" in message.lower():
        return "That column is not on this cart. Check the table's labels and their spelling."
    if "length" in message.lower() or "broadcast" in message.lower():
        return (
            "These columns or arrays have different lengths. Line up one value per row."
        )
    if "sample" in message.lower() and (
        "population" in message.lower() or "replace" in message.lower()
    ):
        return "There are not enough rows for that draw without replacement. Ask for fewer rows."
    if isinstance(error, TypeError):
        return "These kinds of values do not fit this operation. Check for text mixed with numbers."
    return "Shelby could not finish this step. Read the Python message and check this line."


def run(request: dict) -> dict:
    start = time.perf_counter()
    budget = min(5000, max(1, request.get("budgetMs", 5000))) / 1000
    trace = Trace(request.get("instrument", True), request.get("allowedApi"))
    output = io.StringIO()
    result = {
        "stdout": "",
        "value": None,
        "delivered": None,
        "error": None,
        "trace": trace.events,
        "elapsedMs": 0,
        "inputs": {},
    }
    delivered = None
    files = None
    saved_modules = {}
    token = None
    prior_trace = sys.gettrace()
    random_state, numpy_state = random.getstate(), np.random.get_state()
    namespace = {
        "__name__": "__main__",
        "__builtins__": dict(builtins.__dict__),
        "Table": Table,
        "are": are,
        "make_array": make_array,
        "np": np,
    }

    def deliver(value):
        nonlocal delivered
        delivered = value_json(value)
        trace.event("deliver", (value,), value)

    namespace["deliver"] = deliver
    previous_line = {}

    def check_time(frame, event, arg):
        filename = frame.f_code.co_filename
        if time.perf_counter() - start > budget:
            raise RunTimeout("Execution exceeded the cooperative time budget")
        if filename in ("<player>", "<inputs>") or filename.startswith("<file:"):
            if event in ("line", "return", "exception"):
                trace.line = previous_line.get(id(frame), frame.f_lineno)
                trace.filename = filename
                if filename != "<inputs>":
                    scope = (
                        "global"
                        if frame.f_locals is namespace
                        else f"{filename}:{frame.f_code.co_qualname}"
                    )
                    trace.scan(frame.f_locals, scope)
                    if event == "return" and frame.f_locals is not namespace:
                        trace.scan({}, scope)
                        trace.bindings.pop(scope, None)
                if event == "line":
                    previous_line[id(frame)] = frame.f_lineno
                    trace.line = frame.f_lineno
                elif event == "return":
                    previous_line.pop(id(frame), None)
            return check_time
        return None

    try:
        with contextlib.redirect_stdout(output):
            seed = request.get("seed", 0)
            random.seed(seed)
            np.random.seed(seed)
            sys.settrace(check_time)
            baseline = set(namespace)
            exec(compile(request.get("inputCode", ""), "<inputs>", "exec"), namespace)
            namespace.update(
                {
                    name: from_json(value)
                    for name, value in request.get("inputs", {}).items()
                }
            )
            input_names = (set(namespace) - baseline) | set(request.get("inputs", {}))
            for name in sorted(input_names):
                value = namespace[name]
                if (
                    isinstance(
                        value, (Table, np.ndarray, str, int, float, bool, list, tuple)
                    )
                    or value is None
                ):
                    result["inputs"][name] = value_json(
                        value, object_id=trace.object_id(value)
                    )
            files = PlayerFiles(
                request.get("files", {}),
                trace,
                {
                    "Table": Table,
                    "are": are,
                    "make_array": make_array,
                    "np": np,
                    "deliver": deliver,
                },
            )
            for name in files.names:
                if name in sys.modules:
                    saved_modules[name] = sys.modules.pop(name)
            sys.meta_path.insert(0, files)
            token = observer.set(trace)
            trace.scan(namespace)
            code, result_name = compile_player(
                request["code"], "<player>", trace, namespace, True
            )
            exec(code, namespace)
            trace.scan(namespace)
            last_value = namespace.get(result_name)
            try:
                result["value"] = value_json(last_value)
            except TypeError:
                result["value"] = repr(last_value)
    except (Exception, RunTimeout) as error:
        line = error.lineno if isinstance(error, SyntaxError) else trace.line
        tb = error.__traceback__
        while tb is not None:
            filename = tb.tb_frame.f_code.co_filename
            if filename in ("<player>", "<inputs>") or filename.startswith("<file:"):
                line = tb.tb_lineno
                trace.filename = filename
            tb = tb.tb_next
        if isinstance(error, SyntaxError):
            line = error.lineno
            trace.filename = error.filename
        result["error"] = {
            "type": "TimeoutError"
            if isinstance(error, RunTimeout)
            else type(error).__name__,
            "message": str(error),
            "friendly": friendly(error),
            "line": line or 1,
        }
        trace.line = line or 1
        trace.event("error", details=result["error"], force=True)
    finally:
        sys.settrace(prior_trace)
        if token is not None:
            observer.reset(token)
        if files is not None:
            if files in sys.meta_path:
                sys.meta_path.remove(files)
            for name in files.names:
                sys.modules.pop(name, None)
            sys.modules.update(saved_modules)
        random.setstate(random_state)
        np.random.set_state(numpy_state)
    trace.finish()
    result.update(
        stdout=output.getvalue(),
        delivered=delivered,
        elapsedMs=(time.perf_counter() - start) * 1000,
    )
    return result


def main():
    request = json.load(sys.stdin)
    print(json.dumps(run(request), allow_nan=False))


if __name__ == "__main__":
    main()
