#!/usr/bin/env python3
"""Generic IPS deployment-readiness gate."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.pre_coding_gate import run_gate as run_pre_coding_gate  # noqa: E402
from scripts.strict_doc_audit import audit as run_strict_doc_audit  # noqa: E402


PROTECTED_FILES = [
    "00_constitution/CONSTITUTION.md",
    "01_vision/VISION.md",
]

MARKER_RE = re.compile(r"\[(?:MISSING|UNKNOWN):[^\]]+\]")
MARKER_EXCLUDED_PARTS = {
    ".git",
    ".pytest_cache",
    ".venv",
    "node_modules",
    "__pycache__",
    "reports",
    "18_templates",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _validation_reports(root: Path, target: str | None) -> dict[str, Any]:
    reports = sorted((root / "12_validation").glob("VAL-*.md"))
    report_paths = [path.relative_to(root).as_posix() for path in reports]
    if target is None:
        return {"status": "pass" if reports else "fail", "reports": report_paths, "target": None}

    matching = [path.relative_to(root).as_posix() for path in reports if target in _read_text(path)]
    return {
        "status": "pass" if matching else "fail",
        "reports": report_paths,
        "target": target,
        "matching_reports": matching,
    }


def _missing_markers(root: Path) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*.md")):
        rel_parts = path.relative_to(root).parts
        if MARKER_EXCLUDED_PARTS.intersection(rel_parts):
            continue
        for line_number, line in enumerate(_read_text(path).splitlines(), start=1):
            for match in MARKER_RE.finditer(line):
                findings.append(
                    {
                        "path": path.relative_to(root).as_posix(),
                        "line": line_number,
                        "marker": match.group(0),
                    }
                )
    return findings


def _git_has_head(root: Path) -> bool:
    completed = subprocess.run(
        ["git", "rev-parse", "--verify", "HEAD"],
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return completed.returncode == 0


def _protected_file_changes(root: Path) -> dict[str, Any]:
    if not (root / ".git").exists():
        return {"status": "not_applicable", "reason": "not a git repository", "changed_files": []}
    if not _git_has_head(root):
        return {"status": "not_applicable", "reason": "no git HEAD baseline", "changed_files": []}

    completed = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", *PROTECTED_FILES],
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    changed = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
    status = "pass" if completed.returncode == 0 and not changed else "fail"
    return {
        "status": status,
        "changed_files": changed,
        "stderr": completed.stderr[-2000:],
    }


def run_gate(root: Path, *, target: str | None = None) -> dict[str, Any]:
    root = root.resolve()
    pre_coding = run_pre_coding_gate(root)
    strict_audit = run_strict_doc_audit(root)
    validation_reports = _validation_reports(root, target)
    missing_markers = _missing_markers(root)
    protected_changes = _protected_file_changes(root)

    failed = bool(
        pre_coding["status"] != "pass"
        or strict_audit["status"] != "PASS"
        or validation_reports["status"] != "pass"
        or protected_changes["status"] == "fail"
    )

    report: dict[str, Any] = {
        "schema_version": "1.0.0",
        "created_at": _utc_now(),
        "gate": "deployment_readiness",
        "root": str(root),
        "target": target,
        "status": "fail" if failed else "pass",
        "pre_coding_gate": {
            "status": pre_coding["status"],
            "report_path": pre_coding.get("report_path"),
        },
        "strict_doc_audit": {
            "status": strict_audit["status"],
            "score": strict_audit["score"],
            "findings_count": strict_audit["findings_count"],
        },
        "validation_reports": validation_reports,
        "unresolved_markers": missing_markers,
        "protected_files": protected_changes,
        "next_step": "ready_for_deployment_review" if not failed else "fix_deployment_readiness_findings",
    }

    output_dir = root / "reports" / "validation"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "ips-deployment-readiness-gate.json"
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    report["report_path"] = output_path.relative_to(root).as_posix()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the IPS deployment-readiness gate.")
    parser.add_argument("--root", required=True, help="Repository root.")
    parser.add_argument("--target", help="Optional target id or path expected in a validation report.")
    args = parser.parse_args()

    report = run_gate(Path(args.root), target=args.target)
    print(f"{report['status'].upper()} deployment_readiness_gate report={report['report_path']}")
    if report["status"] != "pass":
        print(
            json.dumps(
                {
                    "pre_coding_gate": report["pre_coding_gate"],
                    "strict_doc_audit": report["strict_doc_audit"],
                    "validation_reports": report["validation_reports"],
                    "unresolved_marker_count": len(report["unresolved_markers"]),
                    "protected_files": report["protected_files"],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
