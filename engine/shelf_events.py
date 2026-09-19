"""Run-local observation hooks shared by the engine and notebook runner."""

from contextvars import ContextVar
from typing import Protocol


class Observer(Protocol):
    def operation(
        self, name: str, inputs: tuple, output: object, details: dict
    ) -> None: ...

    def check_api(self, name: str) -> None: ...


observer: ContextVar[Observer | None] = ContextVar("shelf_observer", default=None)


def emit(name: str, inputs: tuple, output: object, **details) -> None:
    active = observer.get()
    if active is not None:
        active.operation(name, inputs, output, details)


def check_api(name: str) -> None:
    active = observer.get()
    if active is not None:
        active.check_api(name)
