#!/usr/bin/env python3
"""
Shared Python file-write helper for the Windows shared checkout (WF-G329).

What this file does:
1. Retries transient Windows write-open contention errors that surface in Python
   as `OSError: [Errno 22] Invalid argument` (EINVAL on open/write during a
   concurrent watcher handle), `errno.EBUSY`, or Windows sharing/lock violations
   (`winerror` 32 / 33).
2. Provides `write_files_with_retry` so multi-file Python patch scripts apply
   atomically and roll back earlier files if a subsequent file fails.
3. Supports `--selftest` so Node/CI suites can verify Python parity directly.
"""

from __future__ import annotations

import errno
import os
import pathlib
import sys
import tempfile
import time
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple, Union

PathLike = Union[str, os.PathLike]
ContentLike = Union[str, bytes]

# Windows error codes for transient sharing / lock contention during watcher reads.
WINDOWS_SHARING_WINERRORS = {32, 33}


def is_transient_write_error(error: BaseException) -> bool:
    """Return True only for transient Windows file-handle contention errors."""
    if not isinstance(error, OSError):
        return False
    winerror = getattr(error, "winerror", None)
    if winerror in WINDOWS_SHARING_WINERRORS:
        return True
    if isinstance(error, PermissionError):
        return False
    return error.errno in (errno.EINVAL, errno.EBUSY)


def _default_write(path: PathLike, data: ContentLike, encoding: str = "utf-8") -> None:
    target = pathlib.Path(path)
    if isinstance(data, bytes):
        target.write_bytes(data)
    else:
        with open(target, "w", encoding=encoding, newline="") as handle:
            handle.write(data)


def write_file_with_retry(
    path: PathLike,
    data: ContentLike,
    *,
    attempts: int = 20,
    delay_ms: int = 300,
    encoding: str = "utf-8",
    write_fn: Optional[Callable[[PathLike, ContentLike], None]] = None,
    wait_fn: Optional[Callable[[float], None]] = None,
) -> int:
    """
    Write a complete replacement for one path with bounded Windows retry.
    Returns the 1-based attempt number that succeeded.
    """
    if not isinstance(attempts, int) or isinstance(attempts, bool) or attempts < 1:
        raise ValueError("attempts must be a positive integer")
    if not isinstance(delay_ms, int) or isinstance(delay_ms, bool) or delay_ms < 0:
        raise ValueError("delay_ms must be a nonnegative integer")

    writer = write_fn or (lambda target, content: _default_write(target, content, encoding=encoding))
    waiter = wait_fn or (lambda seconds: time.sleep(seconds))

    for attempt in range(1, attempts + 1):
        try:
            writer(path, data)
            return attempt
        except BaseException as error:
            if not is_transient_write_error(error) or attempt == attempts:
                raise
            waiter(delay_ms / 1000.0)
    raise RuntimeError("unreachable")


def write_files_with_retry(
    entries: Union[Sequence[Tuple[PathLike, ContentLike]], Dict[PathLike, ContentLike]],
    *,
    attempts: int = 20,
    delay_ms: int = 300,
    encoding: str = "utf-8",
    read_fn: Optional[Callable[[PathLike], bytes]] = None,
    write_fn: Optional[Callable[[PathLike, ContentLike], None]] = None,
    remove_fn: Optional[Callable[[PathLike], None]] = None,
    wait_fn: Optional[Callable[[float], None]] = None,
) -> Dict[str, Union[int, Dict[str, int]]]:
    """
    Write multiple files sequentially with `write_file_with_retry` and roll back
    already-written files if a later file in the batch fails (WF-G329).
    """
    if isinstance(entries, dict):
        normalized: List[Tuple[PathLike, ContentLike]] = list(entries.items())
    else:
        normalized = [(item[0], item[1]) for item in entries]

    reader = read_fn or (lambda target: pathlib.Path(target).read_bytes())
    remover = remove_fn or (lambda target: pathlib.Path(target).unlink(missing_ok=True))

    snapshots: List[Tuple[PathLike, bool, Optional[bytes]]] = []
    for file_path, _ in normalized:
        try:
            prior = reader(file_path)
            snapshots.append((file_path, True, prior))
        except FileNotFoundError:
            snapshots.append((file_path, False, None))

    attempts_by_file: Dict[str, int] = {}
    total_attempts = 0
    completed: List[Tuple[PathLike, bool, Optional[bytes]]] = []

    try:
        for index, (file_path, content) in enumerate(normalized):
            used = write_file_with_retry(
                file_path,
                content,
                attempts=attempts,
                delay_ms=delay_ms,
                encoding=encoding,
                write_fn=write_fn,
                wait_fn=wait_fn,
            )
            attempts_by_file[str(file_path)] = used
            total_attempts += used
            completed.append(snapshots[index])
        return {"attemptsByFile": attempts_by_file, "totalAttempts": total_attempts}
    except BaseException:
        for file_path, existed, prior in reversed(completed):
            if existed and prior is not None:
                write_file_with_retry(
                    file_path,
                    prior,
                    attempts=attempts,
                    delay_ms=delay_ms,
                    encoding=encoding,
                    write_fn=write_fn,
                    wait_fn=wait_fn,
                )
            else:
                remover(file_path)
        raise


def _run_selftest() -> int:
    # 1. Transient Errno 22 (EINVAL) retries and succeeds on 3rd attempt.
    calls: List[Tuple[str, ContentLike]] = []
    waits: List[float] = []

    def flaky_writer(target: PathLike, content: ContentLike) -> None:
        calls.append((str(target), content))
        if len(calls) < 3:
            raise OSError(errno.EINVAL, "Invalid argument")

    used = write_file_with_retry(
        "SystemMenu.tsx",
        "patched",
        attempts=4,
        delay_ms=50,
        write_fn=flaky_writer,
        wait_fn=lambda sec: waits.append(round(sec, 3)),
    )
    assert used == 3, f"expected 3 attempts, got {used}"
    assert len(waits) == 2 and waits == [0.05, 0.05], f"unexpected waits: {waits}"

    # 2. Non-transient PermissionError fails immediately without waiting.
    perm_calls = 0

    def denied_writer(_target: PathLike, _content: ContentLike) -> None:
        nonlocal perm_calls
        perm_calls += 1
        raise PermissionError(errno.EACCES, "Permission denied")

    try:
        write_file_with_retry(
            "SystemMenu.tsx",
            "patched",
            attempts=3,
            delay_ms=10,
            write_fn=denied_writer,
            wait_fn=lambda _sec: (_ for _ in ()).throw(AssertionError("must not wait")),
        )
        raise AssertionError("expected PermissionError")
    except PermissionError:
        assert perm_calls == 1, f"expected 1 call, got {perm_calls}"

    # 3. Multi-file atomic rollback restores earlier files when a later write fails.
    with tempfile.TemporaryDirectory(prefix="py-write-retry-") as tmpdir:
        first = pathlib.Path(tmpdir) / "first.ts"
        second = pathlib.Path(tmpdir) / "second.ts"
        first.write_text("original-first\n", encoding="utf-8")

        def fail_on_second(target: PathLike, content: ContentLike) -> None:
            if str(target).endswith("second.ts"):
                raise OSError(errno.EBUSY, "Device or resource busy")
            _default_write(target, content)

        try:
            write_files_with_retry(
                [(first, "updated-first\n"), (second, "updated-second\n")],
                attempts=2,
                delay_ms=0,
                write_fn=fail_on_second,
                wait_fn=lambda _sec: None,
            )
            raise AssertionError("expected EBUSY on second.ts")
        except OSError as exc:
            assert exc.errno == errno.EBUSY
        assert first.read_text(encoding="utf-8") == "original-first\n"
        assert not second.exists()

    print("write_with_retry.py selftest passed")
    return 0


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        sys.exit(_run_selftest())
    if len(sys.argv) == 3:
        target_file = sys.argv[1]
        source_file = pathlib.Path(sys.argv[2])
        write_file_with_retry(target_file, source_file.read_bytes())
        sys.exit(0)
    print("Usage: python scripts/write_with_retry.py --selftest | <target_file> <source_content_file>", file=sys.stderr)
    sys.exit(2)
