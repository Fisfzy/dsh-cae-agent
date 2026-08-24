# -*- coding: utf-8 -*-
"""
cae_bridge_plugin.py -- pure-kernel Abaqus socket bridge (no abaqusGui).

Why this exists:
  dsh-cae-agent wants to AUTO-LAUNCH Abaqus/CAE and auto-open a socket bridge so
  the agent can drive it. The stock abaqus_mcp_plugin.py imports abaqusGui at
  module top and dispatches model commands via sendCommand() on the GUI thread
  -- but a `startup=` script runs in the CAE *kernel* engine, where `abaqusGui`
  raises `ImportError: Module abaqusGui can only be used in Abaqus/CAE GUI`.
  So that plugin can never auto-open its bridge from a startup file.

  This variant is kernel-native: it imports only kernel-available modules
  (`from abaqus import mdb, session`, `from abaqusConstants import *`, which
  startup can use -- verified) and executes model code *in-process* via exec().
  The bridge therefore starts cleanly from a `startup=` file, giving the agent
  a fully automatic launch + bridge bootstrap.

Transport:
  Plain `socket` + `threading` (no socketserver). mcp_start() opens a listener
  and runs the accept loop on a background (non-daemon) thread, so the bridge
  keeps serving as long as the startup process lives. Each accepted client is
  handled on its own per-connection thread.

Protocol (wire-compatible with dsh-cae-agent's bridgeRequest / runKernelCode):
  request  ->  { "id": "<uuid>", "method": "ping"|"execute"|"stop", "params": {...} }
  response ->  { "id": "<same>", "ok": true, "result": <value> }
            |  { "id": "<same>", "ok": false, "error": { message, type, traceback } }
  Frames are newline-delimited JSON. Envelope shape matches the stock plugin.

Trade-offs vs the GUI plugin:
  - kernel-only: session viewport capture (printToFile) is not available here
    (needs GUI viewports). abaqus_capture_viewport will report an error rather
    than crash -- acceptable for an auto-launched head.
  - Everything else (ping, execute model code, list jobs, inspect odb) works,
    because those run against mdb/session/odbAccess in the kernel.
"""

from __future__ import print_function

import json
import os
import platform
import socket
import sys
import tempfile
import threading
import time
import traceback as _traceback
import uuid

# Kernel-available Abaqus APIs (startup CAN import these; verified).
from abaqus import mdb, session  # noqa: E402
from abaqusConstants import *  # noqa: E402,F401,F403

__version__ = "0.1.0-kernel"

HOST = os.environ.get("ABAQUS_MCP_HOST", "127.0.0.1")
PORT = int(os.environ.get("ABAQUS_MCP_PORT", "48152"))
DEFAULT_TIMEOUT = float(os.environ.get("ABAQUS_MCP_TIMEOUT", "60"))
LOG_PATH = os.environ.get(
    "ABAQUS_MCP_LOG",
    os.path.join(tempfile.gettempdir(), "cae_bridge_socket_bridge.log"),
)

_MAX_MESSAGE_BYTES = int(os.environ.get("ABAQUS_MCP_MAX_MESSAGE_BYTES", str(32 * 1024 * 1024)))

_listener = None
_accept_thread = None
_PROCESSED = 0
_START_TIME = None
_STOP = False

# A single namespace reused across execute calls so state carries between
# invocations (like a persistent kernel session).
_KERNEL_NAMESPACE = {"__name__": "__cae_bridge_main__", "__doc__": None}


def _log(message):
    try:
        with open(LOG_PATH, "a") as handle:
            handle.write("%s %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), message))
    except Exception:
        pass


def _announce(message):
    print(message)
    try:
        sys.stdout.flush()
    except Exception:
        pass


def _send(sock, payload):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sock.sendall(data + b"\n")


def _recv(sock):
    chunks = []
    total = 0
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            raise RuntimeError("socket closed before a complete message was received")
        newline = chunk.find(b"\n")
        if newline >= 0:
            chunks.append(chunk[:newline])
            break
        chunks.append(chunk)
        total += len(chunk)
        if total > _MAX_MESSAGE_BYTES:
            raise RuntimeError("message exceeded %d bytes" % _MAX_MESSAGE_BYTES)
    return json.loads(b"".join(chunks).decode("utf-8"))


def _kernel_ping():
    return {
        "python": sys.version,
        "executable": sys.executable,
        "platform": platform.platform(),
        "pid": os.getpid(),
        "cpu_count": os.cpu_count(),
        "cwd": os.getcwd(),
        "abaqus_version": getattr(session, "version", None),
        "models": list(mdb.models.keys()),
        "viewports": list(getattr(session, "viewports", {}).keys()),
    }


def _kernel_execute(code, timeout):
    """Execute `code` in-process in the shared kernel namespace.

    Mirrors the shape dsh-cae-agent's runKernelCode expects:
      { ok, return_value, stdout, stderr, error_type, core_error,
        recovery, code_excerpt, traceback_tail }
    """
    if not isinstance(code, str) or not code.strip():
        raise ValueError("params.code must be a non-empty string")

    import io
    from contextlib import redirect_stderr, redirect_stdout

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    namespace = _KERNEL_NAMESPACE

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            namespace.setdefault("mdb", mdb)
            namespace.setdefault("session", session)
            try:
                ast = __import__("ast")
                parsed = ast.parse(code, mode="exec")
                is_simple_expr = (
                    len(parsed.body) == 1
                    and isinstance(parsed.body[0], ast.Expr)
                    and isinstance(
                        parsed.body[0].value,
                        (ast.Constant, ast.Name, ast.List, ast.Dict, ast.Tuple, ast.BinOp, ast.Call, ast.Attribute),
                    )
                )
            except Exception:
                is_simple_expr = False

            if is_simple_expr:
                value = eval(code, namespace)  # noqa: S307 -- agent-supplied code
                _KERNEL_NAMESPACE["result"] = value
                returned = value
            else:
                exec(compile(code, "<cae_bridge>", "exec"), namespace)  # noqa: S102
                returned = namespace.get("result")

        return {
            "ok": True,
            "return_value": returned,
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "error_type": "None",
            "core_error": "None",
        }
    except Exception as exc:  # noqa: BLE001
        tb = _traceback.format_exc()
        return {
            "ok": False,
            "return_value": None,
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "error_type": "%s.%s" % (type(exc).__module__, type(exc).__name__),
            "core_error": str(exc),
            "recovery": None,
            "code_excerpt": None,
            "traceback_tail": tb,
        }


def _handle_conn(conn, addr):
    global _PROCESSED
    request_id = None
    try:
        message = _recv(conn)
        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") or {}
        _log("request method=%s id=%s from=%s" % (method, request_id, addr))

        if method == "ping":
            result = _kernel_ping()
            result["bridge"] = {
                "version": __version__,
                "host": HOST,
                "port": PORT,
                "transport": "socket",
                "processed": _PROCESSED,
                "uptime_seconds": int(time.time() - _START_TIME) if _START_TIME else 0,
                "gui_python": sys.version,
                "gui_platform": platform.platform(),
                "log": LOG_PATH,
            }
            _PROCESSED += 1
            _send(conn, {"id": request_id, "ok": True, "result": result})
        elif method == "execute":
            timeout = float(params.get("timeout") or DEFAULT_TIMEOUT)
            result = _kernel_execute(params.get("code"), timeout)
            _PROCESSED += 1
            _send(conn, {"id": request_id, "ok": True, "result": result})
        elif method == "stop":
            threading.Thread(target=mcp_stop, name="CaeBridgeStopper").start()
            _send(conn, {"id": request_id, "ok": True, "result": {"success": True, "message": "stop requested"}})
        else:
            raise ValueError("unknown method: %r" % method)
    except Exception as exc:  # noqa: BLE001
        _log("response error id=%s error=%s" % (request_id, exc))
        try:
            _send(
                conn,
                {
                    "id": request_id,
                    "ok": False,
                    "error": {
                        "message": str(exc),
                        "type": "%s.%s" % (type(exc).__module__, type(exc).__name__),
                        "traceback": _traceback.format_exc(),
                    },
                },
            )
        except Exception:
            pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _accept_loop():
    global _PROCESSED
    while not _STOP:
        try:
            conn, addr = _listener.accept()
        except Exception as exc:
            if _STOP:
                break
            _log("accept error: %s" % exc)
            time.sleep(0.2)
            continue
        try:
            th = threading.Thread(target=_handle_conn, args=(conn, addr), name="CaeBridgeConn")
            th.daemon = True
            th.start()
        except Exception as exc:
            _log("dispatch error: %s" % exc)
            try:
                conn.close()
            except Exception:
                pass


def mcp_start():
    """Start the kernel socket bridge on HOST:PORT. Returns a status string."""
    global _listener, _accept_thread, _START_TIME, _STOP
    if _listener is not None:
        return "cae bridge already running on %s:%s" % (HOST, PORT)
    _log("starting kernel socket bridge on %s:%s" % (HOST, PORT))
    _STOP = False
    _listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    _listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    _listener.bind((HOST, PORT))
    _listener.listen(128)
    _accept_thread = threading.Thread(target=_accept_loop, name="CaeBridgeAccept", daemon=False)
    _accept_thread.start()
    _START_TIME = time.time()
    message = "cae bridge listening on %s:%s" % (HOST, PORT)
    _announce(message)
    _log("accept thread running pid=%s" % os.getpid())
    return message


def mcp_stop():
    global _listener, _accept_thread, _STOP
    if _listener is None:
        return "cae bridge is not running."
    _STOP = True
    try:
        _listener.close()
    except Exception:
        pass
    if _accept_thread is not None:
        try:
            _accept_thread.join(timeout=2)
        except Exception:
            pass
    _listener = None
    _accept_thread = None
    _log("stopped kernel socket bridge")
    return "cae bridge stopped."


def mcp_status():
    return {
        "version": __version__,
        "transport": "socket",
        "endpoint": "%s:%s" % (HOST, PORT),
        "running": _listener is not None,
        "processed": _PROCESSED,
        "uptime_seconds": int(time.time() - _START_TIME) if _START_TIME else 0,
        "log": LOG_PATH,
    }
