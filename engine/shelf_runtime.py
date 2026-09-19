"""Fresh, seeded notebook execution and version-one Director events."""

import ast
import builtins
import contextlib
import dis
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
from datascience import Table, are, make_array, minimize, percentile, sample_proportions

from shelf_events import observer, sampling_rng

SNAPSHOT_LIMIT = 40
TEXT_LIMIT = 500
EVENT_LIMIT = 2000
PAYLOAD_LIMIT = SNAPSHOT_LIMIT * SNAPSHOT_LIMIT


def player_frame(frame):
    filename = frame.f_code.co_filename
    return filename == "<player>" or filename.startswith("<file:")


def suspended(frame):
    return frame.f_code.co_code[frame.f_lasti] == dis.opmap["YIELD_VALUE"]


def numpy_name(function):
    if isinstance(function, types.MethodType):
        module = function.__func__.__module__ or ""
        name = function.__func__.__name__
    elif isinstance(
        function,
        (
            types.FunctionType,
            types.BuiltinFunctionType,
            types.MethodDescriptorType,
            type(np.mean),
            np.ufunc,
            type,
        ),
    ):
        name = function.__name__
        if isinstance(function, types.MethodDescriptorType):
            module = function.__objclass__.__module__
        elif isinstance(function, np.ufunc):
            module = "numpy"
        else:
            module = function.__module__ or ""
        if isinstance(function, types.BuiltinFunctionType):
            receiver = function.__self__
            if isinstance(receiver, np.ndarray):
                module = "numpy.ndarray"
            elif isinstance(receiver, np.ufunc):
                module = "numpy"
                name = f"{receiver.__name__}.{name}"
    else:
        module = type(function).__module__
        name = type(function).__name__
    if module == "numpy" or module.startswith("numpy."):
        if module.startswith("numpy.random"):
            return f"numpy.random.{name}"
        if module == "numpy.ndarray":
            return f"numpy.ndarray.{name}"
        return f"numpy.{name}"
    return None


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
        self.next_loop = 1
        self.reserved_ends = 0
        self.frames = {}
        self.next_scope = 1
        self.closed = False
        self.callbacks = {}
        self.callback_codes = set()
        self.numpy_calls = []
        self.tracer = None

    def resume_tracing(self, frame):
        if self.tracer is not None and sys.gettrace() is not self.tracer:
            sys.settrace(self.tracer)
            frame.f_trace = self.tracer

    def location(self, frame, line=None):
        self.line = frame.f_lineno if line is None else line
        self.filename = frame.f_code.co_filename

    def frame_state(self, frame):
        key = id(frame)
        if key not in self.frames:
            if frame.f_code.co_name == "<module>":
                scope = (
                    "global"
                    if frame.f_code.co_filename == "<player>"
                    else f"{frame.f_code.co_filename}:<module>"
                )
            else:
                scope = (
                    f"{frame.f_code.co_filename}:{frame.f_code.co_qualname}"
                    f":{self.next_scope}"
                )
                self.next_scope += 1
            self.frames[key] = {"scope": scope, "line": frame.f_lineno}
        return self.frames[key]

    def has_room(self, extra=0):
        return len(self.events) + self.reserved_ends + extra < EVENT_LIMIT

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

    def bounded(self, value, depth=0, budget=None, counts=None, path=""):
        if budget is None:
            budget = [PAYLOAD_LIMIT]
        if budget[0] <= 0 or depth >= 8:
            return "<nested value>"
        budget[0] -= 1
        if isinstance(value, np.ndarray):
            count = int(value.size)
            selected = value.flat[: min(SNAPSHOT_LIMIT, budget[0])]
        elif isinstance(value, (tuple, list, range)):
            count = len(value)
            selected = value[: min(SNAPSHOT_LIMIT, budget[0])]
        else:
            selected = None
        if selected is not None:
            if (
                counts is not None
                and count > len(selected)
                and len(counts) < SNAPSHOT_LIMIT
            ):
                counts[path] = count
            return [
                self.bounded(item, depth + 1, budget, counts, f"{path}.{i}")
                for i, item in enumerate(selected)
                if budget[0] > 0
            ]
        if isinstance(value, dict):
            result = {}
            if (
                counts is not None
                and len(value) > SNAPSHOT_LIMIT
                and len(counts) < SNAPSHOT_LIMIT
            ):
                counts[path] = len(value)
            for key, item in islice(value.items(), SNAPSHOT_LIMIT):
                if budget[0] <= 0:
                    break
                label = (
                    str(key)[:TEXT_LIMIT]
                    if type(key) in (str, int, float, bool, type(None))
                    else f"<{type(key).__name__}>"
                )
                result[label] = self.bounded(
                    item, depth + 1, budget, counts, f"{path}.{label}"
                )
            return result
        if isinstance(value, slice):
            return [value.start, value.stop, value.step]
        return self.snapshot(value)

    def event(self, name, inputs=(), output=None, details=None, force=False):
        if not self.enabled or self.closed:
            return False
        if not self.has_room() and not force:
            self.omitted[name] = self.omitted.get(name, 0) + 1
            return False
        details = {} if details is None else details
        budget, counts = [PAYLOAD_LIMIT], {}
        payload = {}
        for key, value in islice(details.items(), SNAPSHOT_LIMIT):
            payload[key] = self.bounded(value, budget=budget, counts=counts, path=key)
            if isinstance(value, np.ndarray):
                payload[f"{key}Count"] = int(value.size)
            elif isinstance(value, (dict, list, tuple, range)):
                payload[f"{key}Count"] = len(value)
        if counts:
            payload["truncatedCounts"] = counts
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
            payload["dtype"] = {"i": "integer", "U": "unicode", "S": "bytes"}.get(
                output.dtype.kind, str(output.dtype)
            )
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
        return True

    def operation(self, name, inputs, output, details):
        frame = sys._getframe(1)
        while frame is not None and not player_frame(frame):
            frame = frame.f_back
        if frame is not None:
            self.location(frame)
        self.event(name, inputs, output, details)

    def check_api(self, name):
        if self.allowed is None:
            return
        caller = sys._getframe(3)
        if caller.f_globals.get("__name__", "").startswith("datascience"):
            return
        while caller is not None and not player_frame(caller):
            caller = caller.f_back
        if caller is None:
            return
        candidates = {name, f"Table.{name}", f"np.{name}", f"numpy.{name}"}
        if not candidates.intersection(self.allowed):
            raise LockedAPIError(f"{name} is not unlocked in this chapter.")

    def scan(self, namespace, scope="global"):
        if not self.enabled or self.closed or not self.has_room():
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
        frame = sys._getframe(1)
        self.resume_tracing(frame)
        if not self.enabled or self.closed:
            return
        self.location(frame, line)
        key = (id(frame), loop_id)
        if phase == "start":
            state = {
                "loopId": loop_id,
                "invocationId": self.next_loop,
                "scope": self.frame_state(frame)["scope"],
                "count": 0,
                "line": line,
                "filename": self.filename,
                "recorded": self.has_room(1),
            }
            self.next_loop += 1
            self.loops[key] = state
            if state["recorded"]:
                self.reserved_ends += 1
        state = self.loops.get(key)
        if state is None:
            return
        if phase == "iteration":
            state["count"] += 1
        if phase == "end":
            self.loops.pop(key)
            if state["recorded"]:
                self.reserved_ends -= 1
        self.loop_event(phase, state)

    def loop_event(self, phase, state, reason=None):
        if not state["recorded"]:
            name = f"loop_{phase}"
            self.omitted[name] = self.omitted.get(name, 0) + 1
            return
        self.line, self.filename = state["line"], state["filename"]
        details = {
            key: state[key] for key in ("loopId", "invocationId", "scope", "count")
        }
        if reason is not None:
            details["reason"] = reason
        self.event(f"loop_{phase}", details=details, force=phase == "end")

    def check_numpy(self, canonical):
        if self.allowed is None:
            return
        short = canonical.removeprefix("numpy.")
        name = canonical.split(".")[-1]
        candidates = {canonical, short, f"np.{short}", name}
        if short.startswith("ndarray."):
            candidates.update((f"np.{name}", f"numpy.{name}"))
        if not candidates.intersection(self.allowed):
            raise LockedAPIError(f"{canonical} is not unlocked in this chapter.")

    def prepare(self, function, line, spelling):
        self.resume_tracing(sys._getframe(1))
        filename = sys._getframe(1).f_code.co_filename
        if function is builtins.map or function is builtins.filter:

            def consume(*args, **kwargs):
                if args:
                    args = (
                        self.observe_numpy(args[0], line, spelling, filename, True),
                        *args[1:],
                    )
                return function(*args, **kwargs)

            return consume
        if function is builtins.sorted:

            def order(*args, **kwargs):
                if "key" in kwargs:
                    kwargs["key"] = self.observe_numpy(
                        kwargs["key"], line, spelling, filename, True
                    )
                return function(*args, **kwargs)

            return order
        return self.observe_numpy(function, line, spelling, filename)

    def observe_numpy(self, function, line, spelling, filename, callback=False):
        canonical = numpy_name(function)
        if canonical is None:
            return function

        def invoke(*args, **kwargs):
            self.line, self.filename = line, filename
            self.check_numpy(canonical)
            inputs = (*args, *kwargs.values())
            if isinstance(function, types.BuiltinFunctionType) and isinstance(
                function.__self__, np.ndarray
            ):
                inputs = (function.__self__, *inputs)
            before = (
                [self.snapshot(item) for item in inputs[:SNAPSHOT_LIMIT]]
                if self.enabled and self.has_room()
                else []
            )
            try:
                self.numpy_calls.append(canonical)
                try:
                    result = function(*args, **kwargs)
                finally:
                    self.numpy_calls.pop()
            except BaseException as error:
                self.line, self.filename = line, filename
                self.event(
                    "numpy",
                    inputs,
                    details={
                        "function": spelling,
                        "canonical": canonical,
                        "arguments": before,
                        "keywords": kwargs,
                        "exception": type(error).__name__,
                        **({"callback": True} if callback else {}),
                    },
                )
                raise
            self.line, self.filename = line, filename
            self.event(
                "numpy",
                inputs,
                result,
                {
                    "function": spelling,
                    "canonical": canonical,
                    "arguments": before,
                    "keywords": kwargs,
                    **({"callback": True} if callback else {}),
                },
            )
            return result

        return invoke

    def argument(self, value):
        if isinstance(value, type(np.mean)):
            function = value.__wrapped__
        else:
            function = value
        if (
            isinstance(function, types.FunctionType)
            and numpy_name(function) is not None
        ):
            self.callback_codes.add(function.__code__)
        return value

    def numpy_callback(self, frame, event, result):
        key = id(frame)
        if event == "call":
            module = frame.f_globals.get("__name__", "")
            if not module.startswith("numpy.") or frame.f_code.co_name.startswith("_"):
                return False
            canonical = f"numpy.{frame.f_code.co_name}"
            if self.numpy_calls and self.numpy_calls[-1] == canonical:
                return False
            registered = frame.f_code in self.callback_codes
            caller = frame.f_back
            while caller is not None and not player_frame(caller):
                parent_module = caller.f_globals.get("__name__", "")
                if not registered and (
                    parent_module.startswith(("numpy", "datascience"))
                    or parent_module == __name__
                ):
                    return False
                caller = caller.f_back
            if caller is None:
                return False
            self.location(caller)
            self.check_numpy(canonical)
            if not self.enabled:
                return False
            inputs = tuple(frame.f_locals.values())
            self.callbacks[key] = {
                "inputs": inputs,
                "arguments": [self.snapshot(item) for item in inputs[:SNAPSHOT_LIMIT]]
                if self.has_room()
                else [],
                "line": caller.f_lineno,
                "filename": caller.f_code.co_filename,
                "canonical": canonical,
            }
            frame.f_trace_lines = False
        elif key in self.callbacks and event == "exception":
            self.callbacks[key]["exception"] = result[0].__name__
        elif key in self.callbacks and event == "return":
            state = self.callbacks.pop(key)
            self.line, self.filename = state["line"], state["filename"]
            details = {
                "function": state["canonical"],
                "canonical": state["canonical"],
                "arguments": state["arguments"],
                "callback": True,
            }
            if (
                dis.opname[frame.f_code.co_code[frame.f_lasti]]
                not in ("RETURN_VALUE", "RETURN_CONST")
                and "exception" in state
            ):
                details["exception"] = state["exception"]
            self.event("numpy", state["inputs"], result, details)
        return key in self.callbacks

    def finish(self):
        for state in reversed(tuple(self.loops.values())):
            if state["recorded"]:
                self.reserved_ends -= 1
            self.loop_event("end", state, reason="run_end")
        self.loops.clear()
        if self.omitted:
            self.event(
                "trace_summary",
                details={
                    "omittedEvents": self.omitted,
                    "omittedCount": sum(self.omitted.values()),
                },
                force=True,
            )
        self.closed = True
        self.frames.clear()
        self.callbacks.clear()
        self.numpy_calls.clear()
        self.tracer = None


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
        node.args = [
            argument
            if isinstance(argument, ast.Starred)
            else ast.copy_location(self.helper("argument", [argument]), argument)
            for argument in node.args
        ]
        for keyword in node.keywords:
            if keyword.arg is not None:
                keyword.value = ast.copy_location(
                    self.helper("argument", [keyword.value]), keyword.value
                )
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
    visit_AsyncFor = instrument_loop


def compile_player(code, filename, trace, namespace, last_expression=False):
    tree = ast.parse(code, filename=filename)
    prefix = "_shelf_"
    while prefix in code or any(name.startswith(prefix) for name in namespace):
        prefix += "_"
    namespace[prefix + "prepare"] = trace.prepare
    namespace[prefix + "argument"] = trace.argument
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
    rng_token = None
    prior_trace = sys.gettrace()
    random_state, numpy_state = random.getstate(), np.random.get_state()
    namespace = {
        "__name__": "__main__",
        "__builtins__": dict(builtins.__dict__),
        "Table": Table,
        "are": are,
        "make_array": make_array,
        "percentile": percentile,
        "minimize": minimize,
        "sample_proportions": sample_proportions,
        "np": np,
    }

    def deliver(value):
        nonlocal delivered
        delivered = value_json(value)
        trace.event("deliver", (value,), value)

    namespace["deliver"] = deliver

    def check_time(frame, event, arg):
        filename = frame.f_code.co_filename
        if time.perf_counter() - start > budget:
            raise RunTimeout("Execution exceeded the cooperative time budget")
        if filename in ("<player>", "<inputs>") or filename.startswith("<file:"):
            if event in ("line", "return", "exception"):
                state = trace.frame_state(frame)
                trace.location(frame, state["line"])
                if filename != "<inputs>":
                    scope = state["scope"]
                    global_scope = (
                        "global" if filename == "<player>" else f"{filename}:<module>"
                    )
                    trace.scan(frame.f_globals, global_scope)
                    if frame.f_locals is not frame.f_globals:
                        trace.scan(frame.f_locals, scope)
                    if (
                        event == "return"
                        and not suspended(frame)
                        and frame.f_locals is not frame.f_globals
                    ):
                        trace.scan({}, scope)
                        trace.bindings.pop(scope, None)
                if event == "line":
                    state["line"] = frame.f_lineno
                    trace.line = frame.f_lineno
                elif event == "return" and not suspended(frame):
                    trace.frames.pop(id(frame), None)
            return check_time
        if trace.numpy_callback(frame, event, arg):
            return check_time
        return None

    try:
        with contextlib.redirect_stdout(output):
            seed = request.get("seed", 0)
            random.seed(seed)
            np.random.seed(seed)
            rng_token = sampling_rng.set(np.random.default_rng(seed))
            trace.tracer = check_time
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
                    "percentile": percentile,
                    "minimize": minimize,
                    "sample_proportions": sample_proportions,
                    "np": np,
                    "deliver": deliver,
                },
            )
            for name in files.names:
                if name in sys.modules:
                    saved_modules[name] = sys.modules.pop(name)
            sys.meta_path.insert(0, files)
            token = observer.set(trace)
            trace.line, trace.filename = 0, "<player>"
            trace.scan(namespace)
            code, result_name = compile_player(
                request["code"], "<player>", trace, namespace, True
            )
            exec(code, namespace)
            trace.filename = "<player>"
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
        if rng_token is not None:
            sampling_rng.reset(rng_token)
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
