#!/usr/bin/env python3
"""Generic IPS pre-coding gate.

The gate is intentionally dependency-free so it can run before any project
runtime dependencies are installed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_IMMUTABLE_FILES = [
    "00_constitution/CONSTITUTION.md",
    "01_vision/VISION.md",
]

TEXT_EXTENSIONS = {
    ".md",
    ".py",
    ".json",
    ".yaml",
    ".yml",
    ".txt",
    ".sh",
    ".toml",
    ".ini",
    ".env",
    ".example",
}

EXCLUDED_PARTS = {
    ".git",
    ".pytest_cache",
    ".venv",
    "node_modules",
    "__pycache__",
    "reports",
    "dist",
    "build",
}

SENSITIVE_PATTERNS: dict[str, re.Pattern[str]] = {
    "secret_assignment": re.compile(
        r"(?i)\b(api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key)\b\s*[:=]\s*['\"]?[A-Za-z0-9_./+=:-]{12,}"
    ),
    "authorization_header": re.compile(r"(?i)\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9_./+=:-]{12,}"),
    "raw_production_data_instruction": re.compile(
        r"(?i)\b(paste|copy|include)\s+(raw|production|live)\s+(customer|supplier|mailbox|attachment|export|record|data)"
    ),
    "private_key_block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}

HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
CODE_BLOCK_RE = re.compile(r"```(?:yaml|yml)?\s*(.*?)```", re.MULTILINE | re.DOTALL)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _normalize_heading(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _section_body(text: str, heading: str) -> str:
    matches = list(HEADING_RE.finditer(text))
    target = _normalize_heading(heading)
    for index, match in enumerate(matches):
        if _normalize_heading(match.group(1)) != target:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        return text[start:end].strip()
    return ""


def _parse_metadata(text: str) -> dict[str, str | list[str]]:
    metadata: dict[str, str | list[str]] = {}
    current_key: str | None = None
    for block in CODE_BLOCK_RE.findall(text):
        for raw_line in block.splitlines():
            line = raw_line.rstrip()
            item = re.match(r"^\s*-\s+(.+?)\s*$", line)
            if item and current_key:
                existing = metadata.get(current_key)
                if not isinstance(existing, list):
                    existing = []
                existing.append(item.group(1).strip().strip("\"'"))
                metadata[current_key] = existing
                continue
            key_value = re.match(r"^([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$", line)
            if key_value:
                current_key = key_value.group(1)
                value = key_value.group(2).strip().strip("\"'")
                metadata[current_key] = [] if value == "[]" else value
    return metadata


def _metadata_has_path(value: str | list[str] | None) -> bool:
    if isinstance(value, list):
        return any("/" in item and item.endswith(".md") for item in value)
    return isinstance(value, str) and "/" in value and value.endswith(".md")


def _is_text_file(path: Path) -> bool:
    if path.name == ".env.example":
        return True
    return path.suffix in TEXT_EXTENSIONS


def scan_sensitive_data(root: Path) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(root).parts
        if EXCLUDED_PARTS.intersection(rel_parts):
            continue
        if not _is_text_file(path):
            continue
        text = _read_text(path)
        for name, pattern in SENSITIVE_PATTERNS.items():
            match = pattern.search(text)
            if match:
                findings.append(
                    {
                        "pattern": name,
                        "path": path.relative_to(root).as_posix(),
                        "match": match.group(0)[:160],
                    }
                )
    return findings


def _task_checks(root: Path) -> dict[str, Any]:
    task_paths = sorted((root / "11_tasks").glob("TASK-*.md"))
    missing_traceability: list[str] = []
    for path in task_paths:
        text = _read_text(path)
        metadata = _parse_metadata(text)
        upstream_body = _section_body(text, "Upstream Links")
        if not _metadata_has_path(metadata.get("upstream")) and ".md" not in upstream_body:
            missing_traceability.append(path.relative_to(root).as_posix())
    return {
        "task_count": len(task_paths),
        "task_files": [path.relative_to(root).as_posix() for path in task_paths],
        "missing_upstream_traceability": missing_traceability,
    }


def _execution_plan_checks(root: Path) -> dict[str, Any]:
    plan_paths = sorted((root / "21_execution_plans").glob("EP-*.md"))
    missing_validation_plan: list[str] = []
    for path in plan_paths:
        body = _section_body(_read_text(path), "Validation Plan")
        if not body or "[MISSING:" in body or "[UNKNOWN:" in body:
            missing_validation_plan.append(path.relative_to(root).as_posix())
    return {
        "execution_plan_count": len(plan_paths),
        "execution_plan_files": [path.relative_to(root).as_posix() for path in plan_paths],
        "missing_validation_plan": missing_validation_plan,
    }


def _project_invariants_check(root: Path) -> dict[str, Any]:
    path = root / "17_governance/PROJECT_INVARIANTS.md"
    if not path.is_file():
        return {"status": "fail", "path": "17_governance/PROJECT_INVARIANTS.md", "reason": "missing"}
    text = _read_text(path)
    if re.search(r"(?i)\bnot\s+applicable\b", text):
        return {"status": "not_applicable", "path": "17_governance/PROJECT_INVARIANTS.md"}
    return {"status": "pass", "path": "17_governance/PROJECT_INVARIANTS.md"}


def _shared_principles_check(root: Path) -> dict[str, Any]:
    path = root / "17_governance/SHARED_PRINCIPLES_WITH_DOS.md"
    cross_repo_enabled = os.environ.get("IPS_CROSS_REPO_MODE", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    rel_path = "17_governance/SHARED_PRINCIPLES_WITH_DOS.md"
    if not path.is_file():
        if cross_repo_enabled:
            return {"status": "fail", "path": rel_path, "reason": "missing"}
        return {"status": "not_applicable", "path": rel_path, "reason": "cross_repo_mode_disabled"}

    text = _read_text(path)
    required_sections = ["Purpose", "Relationship", "Shared Principles", "Boundaries", "Validation"]
    missing_sections = [heading for heading in required_sections if not _section_body(text, heading)]
    mentions_reference_boundary = bool(
        re.search(r"(?is)\bDOS\b.*\breference project\b", text)
        and re.search(r"(?is)\bnot\b.*\bsource of truth\b|\bnot authoritative\b", text)
    )
    status = "pass" if not missing_sections and mentions_reference_boundary else "fail"
    return {
        "status": status,
        "path": rel_path,
        "required_sections": required_sections,
        "missing_sections": missing_sections,
        "reference_boundary_present": mentions_reference_boundary,
    }


def run_gate(root: Path) -> dict[str, Any]:
    root = root.resolve()
    missing_immutable = [rel for rel in REQUIRED_IMMUTABLE_FILES if not (root / rel).is_file()]
    task_checks = _task_checks(root)
    plan_checks = _execution_plan_checks(root)
    invariants = _project_invariants_check(root)
    shared_principles = _shared_principles_check(root)
    sensitive_findings = scan_sensitive_data(root)

    failed = bool(
        missing_immutable
        or task_checks["task_count"] == 0
        or task_checks["missing_upstream_traceability"]
        or plan_checks["execution_plan_count"] == 0
        or plan_checks["missing_validation_plan"]
        or invariants["status"] == "fail"
        or shared_principles["status"] == "fail"
        or sensitive_findings
    )

    report: dict[str, Any] = {
        "schema_version": "1.0.0",
        "created_at": _utc_now(),
        "gate": "pre_coding",
        "root": str(root),
        "status": "fail" if failed else "pass",
        "required_immutable_files": REQUIRED_IMMUTABLE_FILES,
        "missing_immutable_files": missing_immutable,
        "tasks": task_checks,
        "execution_plans": plan_checks,
        "project_invariants": invariants,
        "shared_principles_with_dos": shared_principles,
        "sensitive_data_findings": sensitive_findings,
        "next_step": "start_controlled_coding" if not failed else "fix_pre_coding_gate_findings",
    }

    output_dir = root / "reports" / "validation"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "ips-pre-coding-gate.json"
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    report["report_path"] = output_path.relative_to(root).as_posix()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the IPS pre-coding gate.")
    parser.add_argument("--root", required=True, help="Repository root.")
    args = parser.parse_args()

    report = run_gate(Path(args.root))
    print(f"{report['status'].upper()} pre_coding_gate report={report['report_path']}")
    if report["status"] != "pass":
        print(
            json.dumps(
                {
                    "missing_immutable_files": report["missing_immutable_files"],
                    "tasks": report["tasks"],
                    "execution_plans": report["execution_plans"],
                    "project_invariants": report["project_invariants"],
                    "shared_principles_with_dos": report["shared_principles_with_dos"],
                    "sensitive_data_findings": report["sensitive_data_findings"],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
