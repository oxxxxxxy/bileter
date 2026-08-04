from __future__ import annotations

import contextlib
import logging
import os
import socket
import sys
import tempfile
import threading
import time
import traceback
import webbrowser
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageDraw

from server.app.main import app as fastapi_app


HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"
HEALTH_URL = f"{BASE_URL}/api/health"


class _LogWriter:
    def __init__(self, level: int) -> None:
        self.level = level
        self._buffer = ""

    def write(self, data: str) -> int:
        if not data:
            return 0
        text = str(data)
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.rstrip("\r")
            if line.strip():
                logging.log(self.level, line)
        return len(text)

    def flush(self) -> None:
        if self._buffer.strip():
            logging.log(self.level, self._buffer.rstrip("\r"))
        self._buffer = ""


def _app_data_dir() -> Path:
    if getattr(sys, "frozen", False):
        portable_root = Path(sys.executable).resolve().parent
        if _is_directory_writable(portable_root):
            return portable_root
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home())
        return Path(base) / "WebExeStarter"
    return Path.home() / ".webexe_starter"


def _is_directory_writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path, prefix=".webexe-write-test-", delete=True):
            pass
        return True
    except Exception:
        return False


def _log_path() -> Path:
    log_dir = _app_data_dir() / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "launcher.log"


def write_log(message: str) -> None:
    try:
        with _log_path().open("a", encoding="utf-8") as fh:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            fh.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def _install_file_logging() -> None:
    log_path = _log_path()
    logging.basicConfig(
        level=logging.DEBUG,
        format="[%(asctime)s] %(levelname)s %(threadName)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
        ],
        force=True,
    )
    sys.stdout = _LogWriter(logging.INFO)  # type: ignore[assignment]
    sys.stderr = _LogWriter(logging.ERROR)  # type: ignore[assignment]


def _log_exception(prefix: str, exc_type: type[BaseException], exc_value: BaseException, exc_tb: object) -> None:
    logging.critical("%s: %s", prefix, exc_value, exc_info=(exc_type, exc_value, exc_tb))


def _install_exception_hooks() -> None:
    def excepthook(exc_type: type[BaseException], exc_value: BaseException, exc_tb: object) -> None:
        _log_exception("Unhandled exception", exc_type, exc_value, exc_tb)

    def thread_excepthook(args: threading.ExceptHookArgs) -> None:
        _log_exception(
            f"Unhandled thread exception in {args.thread.name if args.thread else 'unknown-thread'}",
            args.exc_type,
            args.exc_value,
            args.exc_traceback,
        )

    sys.excepthook = excepthook
    threading.excepthook = thread_excepthook


def _log_startup_diagnostics() -> None:
    logging.info("Launcher diagnostics begin")
    logging.info(
        "platform=%s frozen=%s pid=%s cwd=%s",
        os.name,
        getattr(sys, "frozen", False),
        os.getpid(),
        os.getcwd(),
    )
    logging.info("python=%s", sys.version.replace("\n", " "))
    logging.info("executable=%s", sys.executable)
    logging.info("_MEIPASS=%s", getattr(sys, "_MEIPASS", ""))
    logging.info("argv=%s", sys.argv)
    logging.info("base_url=%s health_url=%s", BASE_URL, HEALTH_URL)
    logging.info("app_data_dir=%s", _app_data_dir())
    logging.info("log_path=%s", _log_path())
    logging.info("env LOCALAPPDATA=%s", os.environ.get("LOCALAPPDATA", ""))
    logging.info("env WEBEXE_URL=%s", os.environ.get("WEBEXE_URL", ""))
    logging.info("env WEBEXE_PRINTER=%s", os.environ.get("WEBEXE_PRINTER", ""))
    logging.info("env WEBEXE_DATA_DIR=%s", os.environ.get("WEBEXE_DATA_DIR", ""))


def _dump_runtime_snapshot(reason: str) -> None:
    logging.warning("Runtime snapshot: %s", reason)
    logging.warning("server_running=%s", server_is_running(timeout=0.2))
    logging.warning("port_open=%s", _port_accepting_connections(timeout=0.2))
    with contextlib.suppress(Exception):
        logging.warning("threads=%s", [thread.name for thread in threading.enumerate()])


def server_is_running(timeout: float = 0.5) -> bool:
    try:
        with urlopen(HEALTH_URL, timeout=timeout) as response:
            logging.debug("health check status=%s", getattr(response, "status", "unknown"))
            return response.status == 200
    except Exception as exc:
        logging.debug("health check failed: %r", exc)
        return False


def _port_accepting_connections(timeout: float = 0.5) -> bool:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(timeout)
        rc = sock.connect_ex((HOST, PORT))
        logging.debug("port probe host=%s port=%s rc=%s", HOST, PORT, rc)
        return rc == 0


def wait_for_server(
    timeout_seconds: float = 30.0,
    server_thread: threading.Thread | None = None,
    server: object | None = None,
) -> bool:
    deadline = time.monotonic() + timeout_seconds
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        if server_is_running():
            logging.info("Health check succeeded after %s attempts", attempt)
            return True
        if server_thread is not None and not server_thread.is_alive():
            write_log("Backend thread exited before health check succeeded")
            break
        if attempt == 1 or attempt % 8 == 0:
            logging.warning(
                "Waiting for backend health: attempt=%s thread_alive=%s port_open=%s server_started=%s should_exit=%s",
                attempt,
                server_thread.is_alive() if server_thread is not None else "n/a",
                _port_accepting_connections(timeout=0.2),
                getattr(server, "started", "n/a") if server is not None else "n/a",
                getattr(server, "should_exit", "n/a") if server is not None else "n/a",
            )
        time.sleep(0.25)
    if server is not None:
        write_log(
            "Health wait timeout diagnostics: "
            f"thread_alive={server_thread.is_alive() if server_thread is not None else 'n/a'}, "
            f"port_open={_port_accepting_connections()}, "
            f"server_started={getattr(server, 'started', 'n/a')}, "
            f"should_exit={getattr(server, 'should_exit', 'n/a')}"
        )
    _dump_runtime_snapshot("wait_for_server timeout")
    return False


def open_interface() -> None:
    logging.info("Opening interface: %s", BASE_URL)
    webbrowser.open(BASE_URL)


def show_error_dialog(message: str) -> None:
    if os.name != "nt":
        return
    try:
        import ctypes

        logging.error("Showing error dialog: %s", message.replace("\n", " | "))
        ctypes.windll.user32.MessageBoxW(None, message, "WebExeStarter", 0x10)
    except Exception:
        pass


def create_tray_icon_image() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 60, 60), radius=14, fill=(217, 154, 74, 255))
    draw.rounded_rectangle((10, 10, 54, 54), radius=10, fill=(111, 27, 33, 255))
    draw.rectangle((18, 20, 46, 24), fill=(247, 239, 230, 255))
    draw.rectangle((18, 30, 46, 34), fill=(247, 239, 230, 255))
    draw.rectangle((18, 40, 38, 44), fill=(247, 239, 230, 255))
    return image


def run_server_in_thread() -> tuple[object, threading.Thread]:
    from uvicorn import Config, Server

    write_log("Starting embedded backend server")
    server = Server(
        Config(
            fastapi_app,
            host=HOST,
            port=PORT,
            log_level="info",
            access_log=True,
            server_header=False,
            log_config=None,
            use_colors=False,
            loop="asyncio",
            http="h11",
            ws="none",
            lifespan="on",
        )
    )

    def run_server() -> None:
        try:
            write_log("Embedded backend thread entered server.run()")
            server.run()
            write_log("Embedded backend server stopped")
        except Exception as exc:
            write_log(f"Embedded backend server crashed: {exc!r}")
            write_log(traceback.format_exc())
            raise

    thread = threading.Thread(target=run_server, daemon=True, name="webexe-backend")
    thread.start()
    return server, thread


def run_windows_tray(server: object, thread: threading.Thread) -> int:
    try:
        import pystray
    except Exception:
        logging.exception("Failed to import pystray, falling back to headless wait loop")
        try:
            while thread.is_alive():
                time.sleep(0.5)
            return 0
        except KeyboardInterrupt:
            return 0

    icon_holder: dict[str, pystray.Icon] = {}

    def stop_server() -> None:
        logging.info("Requesting embedded backend shutdown")
        with contextlib.suppress(Exception):
            setattr(server, "should_exit", True)

    def on_open(icon: pystray.Icon, item: object) -> None:
        del icon
        del item
        open_interface()

    def on_exit(icon: pystray.Icon, item: object) -> None:
        del item
        stop_server()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Открыть интерфейс", on_open, default=True),
        pystray.MenuItem("Выход", on_exit),
    )
    icon = pystray.Icon("WebExeStarter", create_tray_icon_image(), "WebExeStarter", menu)
    icon_holder["icon"] = icon

    def watch_server() -> None:
        thread.join()
        logging.warning("Backend thread finished, stopping tray icon")
        if "icon" in icon_holder:
            with contextlib.suppress(Exception):
                icon_holder["icon"].stop()

    watcher = threading.Thread(target=watch_server, daemon=True, name="webexe-tray-watch")
    watcher.start()

    open_interface()
    icon.run()
    stop_server()
    logging.info("Tray loop finished")
    return 0


def run_windows_app() -> int:
    if server_is_running():
        write_log("Detected already running backend, opening interface")
        open_interface()
        return 0

    server, thread = run_server_in_thread()
    if not wait_for_server(timeout_seconds=45.0, server_thread=thread, server=server):
        log_path = _log_path()
        with contextlib.suppress(Exception):
            setattr(server, "should_exit", True)
        write_log("Backend did not become healthy within timeout")
        show_error_dialog(
            "Не удалось запустить локальный сервер WebExeStarter.\n\n"
            f"Проверь лог:\n{log_path}"
        )
        return 1

    write_log("Backend is healthy, starting tray app")
    return run_windows_tray(server, thread)


def run_dev_mode() -> int:
    if server_is_running():
        write_log("Detected already running backend in dev mode, opening interface")
        open_interface()
        return 0

    server, thread = run_server_in_thread()
    if not wait_for_server(timeout_seconds=45.0, server_thread=thread, server=server):
        write_log("Backend did not become healthy in dev mode")
        with contextlib.suppress(Exception):
            setattr(server, "should_exit", True)
        return 1

    open_interface()
    try:
        while thread.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        with contextlib.suppress(Exception):
            setattr(server, "should_exit", True)
    return 0


def main() -> int:
    os.environ["WEBEXE_URL"] = BASE_URL
    _install_file_logging()
    _install_exception_hooks()
    _log_startup_diagnostics()
    write_log(
        f"Launcher started (platform={os.name}, "
        f"frozen={getattr(sys, 'frozen', False)})"
    )

    if os.name == "nt":
        return run_windows_app()
    return run_dev_mode()


if __name__ == "__main__":
    raise SystemExit(main())
