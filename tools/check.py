"""Smoke-test a browser game: load index.html in headless Chrome, save a
screenshot, and report console messages / uncaught errors.

Usage:
    python tools/check.py runs/L1/opus-careful [--wait 3000]

Writes <run_dir>/_check.png and prints a short report. Exit code 1 if any
console error or uncaught exception was seen.
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser():
    for p in CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("No Chrome/Edge found.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir")
    ap.add_argument("--wait", type=int, default=3000, help="virtual ms to run before screenshot")
    args = ap.parse_args()

    run_dir = Path(args.run_dir).resolve()
    index = run_dir / "index.html"
    if not index.exists():
        sys.exit(f"FAIL: {index} not found")

    shot = run_dir / "_check.png"
    profile = Path(os.environ.get("TEMP", ".")) / "aimg-check-profile"
    cmd = [
        find_browser(),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--allow-file-access-from-files",
        f"--user-data-dir={profile}",
        "--enable-logging=stderr",
        "--v=0",
        "--window-size=1280,720",
        f"--virtual-time-budget={args.wait}",
        f"--screenshot={shot}",
        index.as_uri(),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=60)
    log = proc.stderr

    console = [l for l in log.splitlines() if "CONSOLE" in l]
    errors = [
        l for l in console
        if re.search(r"Uncaught|Error|ERROR|Failed|is not defined|Cannot read", l)
    ]
    errors += [l for l in log.splitlines() if "net::ERR_FILE_NOT_FOUND" in l]

    print(f"Run:        {run_dir.name}")
    print(f"Screenshot: {shot if shot.exists() else 'NOT CREATED'}")
    print(f"Console:    {len(console)} message(s), {len(errors)} error(s)")
    for l in console[:20]:
        print("  ", l.split("] ", 1)[-1][:300])
    if errors:
        print("RESULT: ERRORS")
        sys.exit(1)
    print("RESULT: OK (loads, no console errors)")


if __name__ == "__main__":
    main()
