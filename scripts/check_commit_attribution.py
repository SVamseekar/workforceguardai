#!/usr/bin/env python3
"""Reject agent/tool co-authorship in commit messages and PR text.

Solo-maintainer policy: git history is one author. Do not add
Co-authored-by / Co-committed-by trailers (Cursor, Claude, Copilot,
Codex, Grok, or anyone else).
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path

TRAILER_RE = re.compile(
    r"^[ \t]*(Co-authored-by|Co-committed-by)[ \t]*:",
    re.IGNORECASE | re.MULTILINE,
)

AGENT_EMAIL_RE = re.compile(
    r"("
    r"cursoragent@cursor\.com|"
    r"noreply@anthropic\.com|"
    r"copilot@github\.com|"
    r"copilot-swe-agent|"
    r"noreply@openai\.com|"
    r"codex@openai\.com|"
    r"gemini-code-assist@google\.com|"
    r"noreply@x\.ai"
    r")",
    re.IGNORECASE,
)


def find_forbidden_lines(text: str) -> list[str]:
    hits: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if TRAILER_RE.match(raw) or AGENT_EMAIL_RE.search(raw):
            hits.append(raw.rstrip())
    return hits


def _git_log(from_ref: str, to_ref: str) -> str:
    result = subprocess.run(
        [
            "git",
            "log",
            f"{from_ref}..{to_ref}",
            "--format=%H%n%an <%ae>%n%cn <%ce>%n%B%x1e",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def iter_commit_records(log_text: str) -> Iterable[tuple[str, str]]:
    for chunk in log_text.split("\x1e"):
        chunk = chunk.strip()
        if not chunk:
            continue
        first_nl = chunk.find("\n")
        sha = chunk[:first_nl] if first_nl != -1 else chunk
        body = chunk[first_nl + 1 :] if first_nl != -1 else ""
        yield sha, body


def check_text(label: str, text: str) -> list[str]:
    hits = find_forbidden_lines(text)
    if not hits:
        return []
    detail = "; ".join(hits)
    return [f"{label}: forbidden attribution: {detail}"]


def check_range(from_ref: str, to_ref: str) -> list[str]:
    errors: list[str] = []
    for sha, body in iter_commit_records(_git_log(from_ref, to_ref)):
        short = sha[:12]
        errors.extend(check_text(f"commit {short}", body))
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "message_file",
        nargs="?",
        help="Commit message file (pre-commit commit-msg hook)",
    )
    parser.add_argument("--from-ref", dest="from_ref")
    parser.add_argument("--to-ref", dest="to_ref")
    args = parser.parse_args(argv)

    errors: list[str] = []
    if args.message_file:
        errors.extend(check_text("commit message", Path(args.message_file).read_text(encoding="utf-8")))
    if args.from_ref and args.to_ref:
        errors.extend(check_range(args.from_ref, args.to_ref))
    extra = os.environ.get("COMMIT_ATTRIBUTION_EXTRA", "")
    if extra.strip():
        errors.extend(check_text("PR body", extra))

    if errors:
        print("Authorship is the maintainer only. Do not add agent co-authors.", file=sys.stderr)
        for err in errors:
            print(err, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
