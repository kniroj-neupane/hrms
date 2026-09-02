import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
CONTAINER_NAME = "humantryx-postgres"
IMAGE_NAME = "docker.io/postgres"
DB_PORT = 5432
APP_PORTS = [3000, 3001, 3002]


def log(message: str) -> None:
    print(message)


def is_windows() -> bool:
    return os.name == "nt"


def find_docker_binary() -> str | None:
    paths = [
        shutil.which("docker"),
        r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
    ]
    for candidate in paths:
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def docker_is_ready(docker_bin: str) -> bool:
    try:
        result = subprocess.run(
            [docker_bin, "info"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def ensure_docker_desktop_started() -> bool:
    desktop_exe = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
    if desktop_exe.exists():
        try:
            running = subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Get-Process Docker* -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            if "Docker Desktop" not in running.stdout:
                log("Starting Docker Desktop...")
                subprocess.Popen([str(desktop_exe)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                time.sleep(20)
        except Exception:
            pass
    return True


def ensure_database_container(docker_bin: str) -> None:
    log("Ensuring PostgreSQL container is running...")

    list_result = subprocess.run(
        [docker_bin, "ps", "-a", "--filter", f"name={CONTAINER_NAME}", "--format", "{{.Names}}"],
        capture_output=True,
        text=True,
        check=False,
    )

    if CONTAINER_NAME in list_result.stdout:
        status_result = subprocess.run(
            [docker_bin, "ps", "--filter", f"name={CONTAINER_NAME}", "--format", "{{.Status}}"],
            capture_output=True,
            text=True,
            check=False,
        )
        if "Up" not in status_result.stdout:
            log(f"Starting existing container: {CONTAINER_NAME}")
            subprocess.run([docker_bin, "start", CONTAINER_NAME], check=True)
    else:
        log(f"Creating container: {CONTAINER_NAME}")
        subprocess.run(
            [
                docker_bin,
                "run",
                "-d",
                "--name",
                CONTAINER_NAME,
                "-e",
                "POSTGRES_USER=postgres",
                "-e",
                "POSTGRES_PASSWORD=password123",
                "-e",
                "POSTGRES_DB=humantryx",
                "-p",
                f"{DB_PORT}:5432",
                IMAGE_NAME,
            ],
            check=True,
        )

    for _ in range(30):
        result = subprocess.run(
            [docker_bin, "ps", "--filter", f"name={CONTAINER_NAME}", "--format", "{{.Status}}"],
            capture_output=True,
            text=True,
            check=False,
        )
        if "Up" in result.stdout:
            time.sleep(2)
            return
        time.sleep(1)

    raise RuntimeError("PostgreSQL container did not become ready in time.")


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def wait_for_http(url: str, timeout_seconds: int = 60) -> bool:
    started = time.time()
    while time.time() - started < timeout_seconds:
        try:
            request = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.status < 500
        except Exception:
            time.sleep(2)
    return False


def detect_app_url() -> str:
    for port in APP_PORTS:
        candidate = f"http://localhost:{port}"
        if wait_for_http(candidate, 10):
            return candidate
    return f"http://localhost:{APP_PORTS[0]}"


def launch_app() -> str:
    log("Starting frontend/backend application...")
    cmd = ["pnpm.cmd", "dev"] if is_windows() else ["pnpm", "dev"]

    env = os.environ.copy()
    env.setdefault("BROWSER", "none")

    subprocess.Popen(
        cmd,
        cwd=str(PROJECT_ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_CONSOLE if is_windows() else 0,
    )

    app_url = detect_app_url()
    log(f"Application is ready at: {app_url}")
    return app_url


def open_browser_urls(frontend_url: str, backend_url: str) -> None:
    log(f"Opening frontend: {frontend_url}")
    log(f"Opening backend: {backend_url}")
    try:
        webbrowser.open(frontend_url)
        time.sleep(1)
        webbrowser.open(backend_url)
    except Exception as exc:
        log(f"Browser open failed: {exc}")


def main() -> int:
    log("HRMS launcher starting...")
    docker_bin = find_docker_binary()
    if not docker_bin:
        log("Docker is not installed or not found on this machine.")
        log("Please install Docker Desktop and rerun this launcher.")
        time.sleep(5)
        return 1

    if not docker_is_ready(docker_bin):
        ensure_docker_desktop_started()
        if not docker_is_ready(docker_bin):
            log("Docker is installed but not running yet. Please start Docker Desktop and try again.")
            time.sleep(5)
            return 1

    try:
        ensure_database_container(docker_bin)
    except Exception as exc:
        log(f"Database setup failed: {exc}")
        time.sleep(5)
        return 1

    app_url = launch_app()
    backend_url = app_url

    if port_is_open(3000):
        backend_url = "http://localhost:3000"
    elif port_is_open(3001):
        backend_url = "http://localhost:3001"
    elif port_is_open(3002):
        backend_url = "http://localhost:3002"

    open_browser_urls(app_url, backend_url)
    log("Launcher finished successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
