Import("env")

"""Pre-upload: shell tiny-engineer park --transport serial (fail-open)."""

import os
import shutil
import subprocess
from pathlib import Path


def _warn(msg):
    print("park_servos_before_upload: %s" % msg)


def _cli_argv(project_dir, upload_port):
    """Prefer PATH tiny-engineer; else node repo CLI entry."""
    on_path = shutil.which("tiny-engineer")
    if on_path:
        argv = [on_path, "park", "--transport", "serial"]
    else:
        entry = project_dir / "packages" / "tiny-engineer-cli" / "bin" / "tiny-engineer.js"
        if not entry.is_file():
            return None
        node = shutil.which("node")
        if not node:
            return None
        argv = [node, str(entry), "park", "--transport", "serial"]

    if upload_port:
        argv.extend(["--port", upload_port])
    return argv


def park_servos(source, target, env):
    project_dir = Path(env.subst("$PROJECT_DIR"))
    upload_port = env.subst("$UPLOAD_PORT").strip()

    argv = _cli_argv(project_dir, upload_port)
    if argv is None:
        _warn("CLI not found; skip park (upload continues)")
        return

    print("park_servos_before_upload: %s" % " ".join(argv))
    try:
        completed = subprocess.run(
            argv,
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=45,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        _warn("park timed out; upload continues")
        return
    except OSError as exc:
        _warn("park failed to start (%s); upload continues" % exc)
        return

    if completed.returncode == 0:
        print("park_servos_before_upload: parked")
        return

    detail = (completed.stderr or completed.stdout or "").strip()
    if detail:
        _warn("park failed (%s); upload continues" % detail.splitlines()[-1])
    else:
        _warn("park exit %s; upload continues" % completed.returncode)


env.AddPreAction("upload", park_servos)
