"""Test-only oracle transport; Pyodide asks an isolated host CPython process."""

import importlib
import json
import os
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path


class OracleBridge:
    def __init__(self):
        self.stdin = self
        self.stdout = self
        self.request = ""
        self.response = ""

    def write(self, value):
        self.request += value

    def flush(self):
        bridge = importlib.import_module("shelf_test_bridge")
        request = json.loads(self.request)
        request["portableDtypes"] = True
        self.response = bridge.oracle(json.dumps(request) + "\n")
        self.request = ""

    def readline(self):
        return self.response


@contextmanager
def oracle_process():
    if sys.platform == "emscripten":
        yield OracleBridge()
        return
    environment = dict(os.environ)
    environment.pop("PYTHONPATH", None)
    process = subprocess.Popen(
        [sys.executable, "-I", str(Path(__file__).with_name("oracle.py"))],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        env=environment,
    )
    try:
        yield process
    finally:
        process.stdin.close()
        process.wait(timeout=20)
        assert process.returncode == 0
