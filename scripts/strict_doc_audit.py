#!/usr/bin/env python3
"""Strict local documentation audit for the Intent Preservation System.

The audit is intentionally dependency-free so it can run in lightweight CI
images and in AI-agent sandboxes before implementation work starts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TypedDict


DEFAULT_ROOT = Path(__file__).resolve().parents[1]

Severity = Literal["critical", "high"]
Status = Literal["PASS", "FAIL"]
DocType = Literal[
    "SYSTEM",
    "SUBSYSTEM",
    "ADR",
    "FEATURE",
    "TASK",
    "EXECUTION_PLAN",
    "GOAL_IMPACT",
    "CONTEXT_PACKAGE",
    "CODING_PROMPT",
    "VALIDATION_REPORT",
    "SEMANTIC_COMPRESSION",
]


class Finding(TypedDict):
    severity: Severity
    type: str
    path: str
    section: str | None
    message: str
    recommendation: str
    draft_source: str | None


class FileAuditResult(TypedDict):
    path: str
    type: DocType
    missing_sections: list[str]
    empty_or_placeholder_sections: list[str]
    ok: bool
    findings: list[Finding]


class DraftRecommendation(TypedDict):
    path: str
    template: str
    reason: str


class RemediationAction(TypedDict):
    action: str
    path: str
    section: str | None
    template: str
    reason: str
    writes_file: bool


class AuditReport(TypedDict):
    root: str
    status: Status
    score: int
    files_checked: int
    files_with_issues: int
    findings_count: int
    critical_count: int
    high_count: int
    findings: list[Finding]
    results: list[FileAuditResult]
    draft_recommendations: list[DraftRecommendation]


@dataclass
class Section:
    heading: str
    normalized: str
    body: str


@dataclass
class DocumentInfo:
    path: Path
    rel: str
    doc_type: DocType
    text: str
    metadata: dict[str, str | list[str]]
    sections: dict[str, Section]


@dataclass
class Graph:
    node_ids: set[str]
    node_paths: dict[str, str]
    node_types: dict[str, str]
    edges: set[tuple[str, str, str]]


REQUIRED_PATHS: list[str] = [
    "00_constitution/CONSTITUTION.md",
    "01_vision/VISION.md",
    "01_vision/VISION_EVOLUTION.md",
    "02_business_case/BUSINESS_CASE.md",
    "03_domain_model/GLOSSARY.md",
    "03_domain_model/CORE_ENTITIES.md",
    "06_architecture/ARCHITECTURE_OVERVIEW.md",
    "08_roadmap/ROADMAP.md",
    "12_validation/VALIDATION_PYRAMID.md",
    "15_audits/AUDIT_CHECKLIST.md",
    "23_documentation_contracts/DOCUMENTATION_COMPLETENESS_STANDARD.md",
]

REQUIRED_GROUPS: list[tuple[str, str, str]] = [
    ("04_systems", "SYS-*.md", "system documents"),
    ("05_subsystems", "SUB-*.md", "subsystem documents"),
    ("07_decisions", "ADR-*.md", "architecture decision records"),
    ("09_milestones", "MS-*.md", "milestone documents"),
    ("10_features", "FEAT-*.md", "feature documents"),
    ("11_tasks", "TASK-*.md", "task documents"),
    ("21_execution_plans", "EP-TASK-*.md", "execution plans"),
    ("22_goal_impact", "GOAL-IMPACT-*.md", "goal impact records"),
]

REQUIRED_SECTIONS: dict[DocType, list[str]] = {
    "SYSTEM": [
        "Purpose",
        "Responsibilities",
        "Validation",
    ],
    "SUBSYSTEM": [
        "Purpose",
        "Responsibilities",
        "Inputs",
        "Outputs",
        "Validation",
    ],
    "ADR": [
        "Context",
        "Decision",
        "Consequences",
        "Validation",
    ],
    "FEATURE": [
        "Goal",
        "Acceptance criteria",
        "Traceability",
        "Validation",
    ],
    "TASK": [
        "Objective",
        "Upstream Links",
        "Goal Impact",
        "Scope",
        "Non-Goals",
        "Acceptance Criteria",
        "Required Context",
        "Validation Task",
        "Execution Plan Requirement",
    ],
    "EXECUTION_PLAN": [
        "Metadata",
        "Upstream Traceability",
        "Goal Impact",
        "Scope",
        "Non-Goals",
        "Files to Inspect",
        "Files to Create",
        "Files to Modify",
        "Files That Must Not Be Modified",
        "Implementation Steps",
        "Test Plan",
        "Validation Plan",
        "Documentation Updates",
        "Rollback Plan",
        "Agent Handoff Prompt",
        "Completion Checklist",
    ],
    "GOAL_IMPACT": ["Explanation", "Evidence", "Validation"],
    "CONTEXT_PACKAGE": [
        "Target task",
        "Upstream traceability",
        "Included documents",
        "Excluded documents",
        "Constraints",
        "Agent prompt",
        "Validation instructions",
    ],
    "CODING_PROMPT": [
        "Role",
        "Task",
        "Context",
        "Constraints",
        "Acceptance criteria",
        "Validation",
    ],
    "VALIDATION_REPORT": [
        "Summary",
        "Upstream goal",
        "Criteria checked",
        "Issues found",
        "Recommendation",
        "Traceability confirmation",
    ],
    "SEMANTIC_COMPRESSION": [],
}

REQUIRED_TASK_METADATA: list[str] = [
    "id",
    "status",
    "upstream",
    "goal_impact",
    "execution_plan",
]
REQUIRED_EXECUTION_PLAN_METADATA: list[str] = ["id", "status", "source_task"]
REQUIRED_GOAL_IMPACT_METADATA: list[str] = [
    "id",
    "artifact_type",
    "artifact_id",
    "artifact_path",
    "primary_goal",
    "impact_level",
    "status",
]
REQUIRED_COMPRESSION_METADATA: list[str] = [
    "source_document",
    "compression_level",
    "last_updated",
    "compression_owner",
    "fidelity_status",
    "must_read_full_document_when",
]

REQUIRED_EXECUTION_PLAN_TRACEABILITY_METADATA: list[str] = [
    "vision",
    "constitution",
    "feature",
    "goal_impact",
]

MAX_COMPRESSION_RATIO: dict[str, float] = {
    "summary": 0.25,
    "ultra": 0.08,
}

TEMPLATE_FOR_DOC_TYPE: dict[DocType, str] = {
    "SYSTEM": "18_templates/SYSTEM_TEMPLATE.md",
    "SUBSYSTEM": "18_templates/SUBSYSTEM_TEMPLATE.md",
    "ADR": "18_templates/ADR_TEMPLATE.md",
    "FEATURE": "18_templates/FEATURE_TEMPLATE.md",
    "TASK": "18_templates/TASK_TEMPLATE.md",
    "EXECUTION_PLAN": "18_templates/EXECUTION_PLAN_TEMPLATE.md",
    "GOAL_IMPACT": "18_templates/GOAL_IMPACT_TEMPLATE.md",
    "CONTEXT_PACKAGE": "18_templates/CONTEXT_PACKAGE_TEMPLATE.md",
    "CODING_PROMPT": "18_templates/CODING_PROMPT_TEMPLATE.md",
    "VALIDATION_REPORT": "18_templates/VALIDATION_REPORT_TEMPLATE.md",
    "SEMANTIC_COMPRESSION": "18_templates/SEMANTIC_COMPRESSION_TEMPLATE.md",
}

TEMPLATE_FOR_GROUP: dict[str, str] = {
    "system documents": TEMPLATE_FOR_DOC_TYPE["SYSTEM"],
    "subsystem documents": TEMPLATE_FOR_DOC_TYPE["SUBSYSTEM"],
    "architecture decision records": TEMPLATE_FOR_DOC_TYPE["ADR"],
    "feature documents": TEMPLATE_FOR_DOC_TYPE["FEATURE"],
    "task documents": TEMPLATE_FOR_DOC_TYPE["TASK"],
    "execution plans": TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"],
    "goal impact records": TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"],
}

IMMUTABLE_PATHS = {
    "00_constitution/CONSTITUTION.md",
    "01_vision/VISION.md",
}

VALID_IMPLEMENTATION_STATUSES = {"approved", "reviewed", "implemented", "validated", "closed"}
REFERENCE_RE = re.compile(r"`((?:\.\./|[A-Za-z0-9_./-]+/)[A-Za-z0-9_./#*-]+)`")
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
FRONT_MATTER_RE = re.compile(r"^---\s*.*?^---\s*", re.MULTILINE | re.DOTALL)
CODE_BLOCK_RE = re.compile(r"```(?:yaml|yml)?\s*(.*?)```", re.MULTILINE | re.DOTALL)


def normalize_heading(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def sections(text: str) -> dict[str, Section]:
    matches = list(HEADING_RE.finditer(text))
    result: dict[str, Section] = {}
    for index, match in enumerate(matches):
        raw_heading = match.group(2).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        normalized = normalize_heading(raw_heading)
        result[normalized] = Section(raw_heading, normalized, text[start:end].strip())
    return result


def classify(path: Path, root: Path) -> DocType | None:
    rel_text = path.relative_to(root).as_posix()
    name = path.name

    if rel_text.startswith("04_systems/") and name.startswith("SYS-"):
        return "SYSTEM"
    if rel_text.startswith("05_subsystems/") and name.startswith("SUB-"):
        return "SUBSYSTEM"
    if rel_text.startswith("07_decisions/") and name.startswith("ADR-"):
        return "ADR"
    if rel_text.startswith("10_features/") and name.startswith("FEAT-"):
        return "FEATURE"
    if rel_text.startswith("11_tasks/") and name.startswith("TASK-"):
        return "TASK"
    if rel_text.startswith("12_validation/") and name.startswith("VAL-"):
        return "VALIDATION_REPORT"
    if rel_text.startswith("13_context_packages/") and name.startswith("CP-"):
        return "CONTEXT_PACKAGE"
    if rel_text.startswith("14_prompts/") and name.startswith("PROMPT-"):
        return "CODING_PROMPT"
    if rel_text.startswith("21_execution_plans/") and name.startswith("EP-TASK-"):
        return "EXECUTION_PLAN"
    if rel_text.startswith("22_goal_impact/") and name.startswith("GOAL-IMPACT-"):
        return "GOAL_IMPACT"
    if rel_text.startswith("20_semantic_compression/summaries/") and name.endswith(
        ".summary.md"
    ):
        return "SEMANTIC_COMPRESSION"
    if rel_text.startswith("20_semantic_compression/ultra/") and name.endswith(
        ".ultra.md"
    ):
        return "SEMANTIC_COMPRESSION"
    return None


def make_finding(
    severity: Severity,
    finding_type: str,
    path: str,
    message: str,
    recommendation: str,
    section: str | None = None,
    draft_source: str | None = None,
) -> Finding:
    return {
        "severity": severity,
        "type": finding_type,
        "path": path,
        "section": section,
        "message": message,
        "recommendation": recommendation,
        "draft_source": draft_source,
    }


def is_empty_or_placeholder(value: str) -> bool:
    stripped = value.strip()
    lowered = stripped.lower()
    if not stripped:
        return True
    placeholders = {"tbd", "n/a", "placeholder", "to be filled"}
    if lowered in placeholders:
        return True
    if "[missing:" in lowered or "[unknown:" in lowered:
        return True
    if re.fullmatch(r"[-*]\s*\[\s\]\s*", stripped):
        return True
    return False


def parse_metadata(text: str) -> dict[str, str | list[str]]:
    candidates: list[str] = []
    front_matter = re.search(r"^---\s*(.*?)^---\s*", text, flags=re.MULTILINE | re.DOTALL)
    if front_matter:
        candidates.append(front_matter.group(1))
    candidates.extend(CODE_BLOCK_RE.findall(text))

    metadata: dict[str, str | list[str]] = {}
    for block in candidates:
        current_key: str | None = None
        for raw_line in block.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue
            list_item = re.match(r"^\s*-\s+(.+?)\s*$", line)
            if list_item and current_key:
                existing = metadata.get(current_key)
                if not isinstance(existing, list):
                    existing = []
                existing.append(clean_scalar(list_item.group(1)))
                metadata[current_key] = existing
                continue
            item = re.match(r"^([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$", line)
            if item:
                key = item.group(1)
                value = item.group(2).strip()
                current_key = key
                if value in {"", "[]"}:
                    metadata[key] = [] if value == "[]" else ""
                else:
                    metadata[key] = clean_scalar(value)
    return metadata


def clean_scalar(value: str) -> str:
    return value.strip().strip("\"'")


def metadata_text(value: str | list[str] | None) -> str:
    if isinstance(value, list):
        return "\n".join(value)
    if value is None:
        return ""
    return value


def metadata_list(value: str | list[str] | None) -> list[str]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value:
        return [value]
    return []


def has_path_reference(value: str | list[str] | None) -> bool:
    return bool(extract_references_from_metadata(value or []))


def section_body(doc: DocumentInfo, heading: str) -> str:
    section = doc.sections.get(normalize_heading(heading))
    if section is None:
        return ""
    return section.body


def strip_fragment(path_text: str) -> str:
    return path_text.split("#", 1)[0]


def resolve_reference(base_path: Path, ref: str) -> Path | None:
    if ref.startswith(("http://", "https://", "mailto:", "#")):
        return None
    if "*" in ref:
        return None
    clean = strip_fragment(ref)
    if not clean or clean.startswith("$"):
        return None
    return (base_path.parent / clean).resolve()


def path_exists(root: Path, base_path: Path, ref: str) -> bool:
    resolved = resolve_reference(base_path, ref)
    if resolved is None:
        return True
    root_relative = (root / strip_fragment(ref)).resolve()
    if root_relative.exists():
        return True
    try:
        resolved.relative_to(root.resolve())
    except ValueError:
        return False
    return resolved.exists()


def extract_references(text: str) -> set[str]:
    refs: set[str] = set()
    for match in REFERENCE_RE.finditer(text):
        refs.add(match.group(1))
    for match in MARKDOWN_LINK_RE.finditer(text):
        refs.add(match.group(1))
    return refs


def audit_required_paths(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for rel in REQUIRED_PATHS:
        if not (root / rel).exists():
            findings.append(
                make_finding(
                    "critical",
                    "missing_document",
                    rel,
                    f"Required document is missing: {rel}",
                    "Create the document using the matching template or approved project source.",
                )
            )
    for folder, pattern, label in REQUIRED_GROUPS:
        folder_path = root / folder
        if not folder_path.exists() or not list(folder_path.glob(pattern)):
            findings.append(
                make_finding(
                    "critical",
                    "missing_document_group",
                    folder,
                    f"No {label} found in {folder}/.",
                    f"Create at least one {label} document.",
                    draft_source=TEMPLATE_FOR_GROUP.get(label),
                )
            )
    return findings


def load_documents(root: Path) -> list[DocumentInfo]:
    docs: list[DocumentInfo] = []
    for path in sorted(root.rglob("*.md")):
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        doc_type = classify(path, root)
        if not doc_type:
            continue
        text = path.read_text(encoding="utf-8")
        docs.append(
            DocumentInfo(
                path=path,
                rel=path.relative_to(root).as_posix(),
                doc_type=doc_type,
                text=text,
                metadata=parse_metadata(text),
                sections=sections(text),
            )
        )
    return docs


def audit_document_sections(doc: DocumentInfo) -> tuple[list[str], list[str], list[Finding]]:
    missing: list[str] = []
    empty: list[str] = []
    findings: list[Finding] = []
    for heading in REQUIRED_SECTIONS[doc.doc_type]:
        normalized = normalize_heading(heading)
        if normalized not in doc.sections:
            missing.append(heading)
        elif is_empty_or_placeholder(doc.sections[normalized].body):
            empty.append(heading)
    for heading in missing:
        findings.append(
            make_finding(
                "high",
                "missing_section",
                doc.rel,
                f"{doc.rel} is missing required section: {heading}",
                f"Add section '{heading}' using the relevant template and upstream documents.",
                section=heading,
                draft_source=TEMPLATE_FOR_DOC_TYPE[doc.doc_type],
            )
        )
    for heading in empty:
        findings.append(
            make_finding(
                "high",
                "empty_or_placeholder_section",
                doc.rel,
                f"{doc.rel} has an empty or placeholder section: {heading}",
                f"Fill section '{heading}' from approved upstream context.",
                section=heading,
                draft_source=TEMPLATE_FOR_DOC_TYPE[doc.doc_type],
            )
        )
    return missing, empty, findings


def audit_metadata(doc: DocumentInfo) -> list[Finding]:
    required: list[str] = []
    if doc.doc_type == "TASK":
        required = REQUIRED_TASK_METADATA
    elif doc.doc_type == "EXECUTION_PLAN":
        required = REQUIRED_EXECUTION_PLAN_METADATA
    elif doc.doc_type == "GOAL_IMPACT":
        required = REQUIRED_GOAL_IMPACT_METADATA
    elif doc.doc_type == "SEMANTIC_COMPRESSION":
        required = REQUIRED_COMPRESSION_METADATA

    findings: list[Finding] = []
    for key in required:
        value = doc.metadata.get(key)
        if value is None or value == "" or value == []:
            findings.append(
                make_finding(
                    "high",
                    "missing_metadata",
                    doc.rel,
                    f"{doc.rel} is missing required metadata: {key}",
                    f"Add metadata field '{key}' using the relevant template.",
                    section=key,
                    draft_source=TEMPLATE_FOR_DOC_TYPE[doc.doc_type],
                )
            )
    return findings


def audit_traceability_fields(doc: DocumentInfo) -> list[Finding]:
    if doc.doc_type not in {
        "TASK",
        "EXECUTION_PLAN",
        "GOAL_IMPACT",
        "CONTEXT_PACKAGE",
    }:
        return []

    findings: list[Finding] = []
    if doc.doc_type == "TASK":
        findings.extend(audit_task_traceability_fields(doc))
    elif doc.doc_type == "EXECUTION_PLAN":
        findings.extend(audit_execution_plan_traceability_fields(doc))
    elif doc.doc_type == "GOAL_IMPACT":
        findings.extend(audit_goal_impact_traceability_fields(doc))
    elif doc.doc_type == "CONTEXT_PACKAGE":
        findings.extend(audit_context_package_traceability_fields(doc))
    return findings


def audit_task_traceability_fields(doc: DocumentInfo) -> list[Finding]:
    findings: list[Finding] = []
    for key, template in [
        ("upstream", TEMPLATE_FOR_DOC_TYPE["TASK"]),
        ("goal_impact", TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"]),
        ("execution_plan", TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"]),
    ]:
        if key in doc.metadata and not has_path_reference(doc.metadata.get(key)):
            findings.append(
                make_finding(
                    "high",
                    "missing_traceability_link",
                    doc.rel,
                    f"{doc.rel} metadata field {key} does not contain a local artifact path.",
                    f"Set {key} to one or more repository-relative Markdown paths.",
                    section=key,
                    draft_source=template,
                )
            )

    upstream_links = section_body(doc, "Upstream Links")
    if upstream_links and not extract_references(upstream_links):
        findings.append(
            make_finding(
                "high",
                "missing_upstream_traceability",
                doc.rel,
                f"{doc.rel} Upstream Links section does not contain path-level references.",
                "Add explicit links to the approved feature, system, goal, or vision documents.",
                section="Upstream Links",
                draft_source=TEMPLATE_FOR_DOC_TYPE["TASK"],
            )
        )
    return findings


def audit_execution_plan_traceability_fields(doc: DocumentInfo) -> list[Finding]:
    findings: list[Finding] = []
    source_task = doc.metadata.get("source_task")
    if source_task is not None and not has_path_reference(source_task):
        findings.append(
            make_finding(
                "high",
                "missing_traceability_link",
                doc.rel,
                f"{doc.rel} source_task does not contain a local task path.",
                "Set source_task to the task document path.",
                section="source_task",
                draft_source=TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"],
            )
        )

    for key in REQUIRED_EXECUTION_PLAN_TRACEABILITY_METADATA:
        value = doc.metadata.get(key)
        if value is None or value == "" or value == []:
            findings.append(
                make_finding(
                    "high",
                    "missing_traceability_field",
                    doc.rel,
                    f"{doc.rel} is missing upstream traceability metadata: {key}",
                    f"Add {key} under the Upstream Traceability metadata block.",
                    section=key,
                    draft_source=TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"],
                )
            )
        elif not has_path_reference(value):
            findings.append(
                make_finding(
                    "high",
                    "missing_traceability_link",
                    doc.rel,
                    f"{doc.rel} upstream traceability field {key} does not contain a local artifact path.",
                    f"Set {key} to a repository-relative Markdown path.",
                    section=key,
                    draft_source=TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"],
                )
            )
    return findings


def audit_goal_impact_traceability_fields(doc: DocumentInfo) -> list[Finding]:
    findings: list[Finding] = []
    artifact_path = doc.metadata.get("artifact_path")
    if artifact_path is not None and not has_path_reference(artifact_path):
        findings.append(
            make_finding(
                "high",
                "missing_traceability_link",
                doc.rel,
                f"{doc.rel} artifact_path does not contain a local artifact path.",
                "Set artifact_path to the artifact being evaluated.",
                section="artifact_path",
                draft_source=TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"],
            )
        )

    upstream_links = doc.metadata.get("upstream_links")
    if upstream_links is None or upstream_links == "" or upstream_links == []:
        findings.append(
            make_finding(
                "high",
                "missing_traceability_field",
                doc.rel,
                f"{doc.rel} is missing upstream_links metadata.",
                "Add upstream_links to the goal impact record so the goal claim is auditable.",
                section="upstream_links",
                draft_source=TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"],
            )
        )
    elif not has_path_reference(upstream_links):
        findings.append(
            make_finding(
                "high",
                "missing_traceability_link",
                doc.rel,
                f"{doc.rel} upstream_links metadata does not contain local artifact paths.",
                "Set upstream_links to approved upstream document paths.",
                section="upstream_links",
                draft_source=TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"],
            )
        )
    return findings


def audit_context_package_traceability_fields(doc: DocumentInfo) -> list[Finding]:
    findings: list[Finding] = []
    target_task = section_body(doc, "Target task")
    included_documents = section_body(doc, "Included documents")
    upstream_traceability = section_body(doc, "Upstream traceability")

    task_ids = set(re.findall(r"\bTASK-\d+\b", target_task))
    if not task_ids:
        findings.append(
            make_finding(
                "high",
                "missing_traceability_field",
                doc.rel,
                f"{doc.rel} Target task section does not identify a TASK id.",
                "Name the target task id and link its task document.",
                section="Target task",
                draft_source=TEMPLATE_FOR_DOC_TYPE["CONTEXT_PACKAGE"],
            )
        )
    if not any(ref.startswith(("11_tasks/", "../11_tasks/")) for ref in extract_references(target_task)):
        findings.append(
            make_finding(
                "high",
                "missing_traceability_link",
                doc.rel,
                f"{doc.rel} Target task section does not link to the target task document.",
                "Add the target task document path to Target task.",
                section="Target task",
                draft_source=TEMPLATE_FOR_DOC_TYPE["CONTEXT_PACKAGE"],
            )
        )

    upstream_refs = extract_references(upstream_traceability) | extract_references(included_documents)
    if not upstream_refs:
        findings.append(
            make_finding(
                "high",
                "missing_upstream_traceability",
                doc.rel,
                f"{doc.rel} does not include path-level upstream traceability.",
                "List the approved upstream documents included in the package.",
                section="Upstream traceability",
                draft_source=TEMPLATE_FOR_DOC_TYPE["CONTEXT_PACKAGE"],
            )
        )
    return findings


def audit_link_reality(root: Path, docs: list[DocumentInfo]) -> list[Finding]:
    findings: list[Finding] = []
    for doc in docs:
        for ref in sorted(extract_references(doc.text)):
            if not path_exists(root, doc.path, ref):
                findings.append(
                    make_finding(
                        "high",
                        "broken_reference",
                        doc.rel,
                        f"{doc.rel} references missing path: {ref}",
                        "Fix the path or create the referenced artifact.",
                        section=ref,
                    )
                )
        for value in doc.metadata.values():
            for ref in extract_references_from_metadata(value):
                if not path_exists(root, doc.path, ref):
                    findings.append(
                        make_finding(
                            "high",
                            "broken_reference",
                            doc.rel,
                            f"{doc.rel} metadata references missing path: {ref}",
                            "Fix the path or create the referenced artifact.",
                            section=ref,
                        )
                    )
    return dedupe_findings(findings)


def extract_references_from_metadata(value: str | list[str]) -> set[str]:
    values = value if isinstance(value, list) else [value]
    refs: set[str] = set()
    for item in values:
        if "/" in item and not item.startswith(("http://", "https://")):
            refs.add(item)
    return refs


def audit_semantic_compression(doc: DocumentInfo) -> list[Finding]:
    findings: list[Finding] = []
    body = FRONT_MATTER_RE.sub("", doc.text).strip()
    body_without_title = "\n".join(
        line for line in body.splitlines() if not line.lstrip().startswith("#")
    ).strip()
    body_lines = [line for line in body.splitlines() if line.strip()]
    if len(body_lines) < 3 or is_empty_or_placeholder(body):
        findings.append(
            make_finding(
                "high",
                "empty_or_placeholder_section",
                doc.rel,
                f"{doc.rel} does not contain enough compressed content.",
                "Add compact, source-faithful compressed content.",
                section="compressed_content",
                draft_source=TEMPLATE_FOR_DOC_TYPE["SEMANTIC_COMPRESSION"],
            )
        )

    source_document = metadata_text(doc.metadata.get("source_document"))
    compression_level = metadata_text(doc.metadata.get("compression_level"))
    if source_document and compression_level in MAX_COMPRESSION_RATIO:
        source_path = (doc.path.parent / source_document).resolve()
        if source_path.exists():
            source_words = word_count(strip_front_matter(source_path.read_text(encoding="utf-8")))
            compressed_words = word_count(body_without_title)
            max_words = max(1, int(source_words * MAX_COMPRESSION_RATIO[compression_level]))
            if compressed_words > max_words:
                findings.append(
                    make_finding(
                        "high",
                        "compression_ratio_exceeded",
                        doc.rel,
                        f"{doc.rel} has {compressed_words} compressed words; maximum for {compression_level} is {max_words}.",
                        "Reduce the compressed document while preserving critical constraints.",
                        section="compressed_content",
                        draft_source=TEMPLATE_FOR_DOC_TYPE["SEMANTIC_COMPRESSION"],
                    )
                )
        else:
            findings.append(
                make_finding(
                    "high",
                    "missing_source_document",
                    doc.rel,
                    f"{doc.rel} points to missing source document: {source_document}",
                    "Fix source_document so the audit can verify compression size.",
                    section="source_document",
                    draft_source=TEMPLATE_FOR_DOC_TYPE["SEMANTIC_COMPRESSION"],
                )
            )
    return findings


def strip_front_matter(text: str) -> str:
    return FRONT_MATTER_RE.sub("", text).strip()


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?", text))


def parse_graph(root: Path) -> Graph | None:
    graph_path = root / "graph/project_graph.example.yaml"
    if not graph_path.exists():
        return None
    node_ids: set[str] = set()
    node_paths: dict[str, str] = {}
    node_types: dict[str, str] = {}
    edges: set[tuple[str, str, str]] = set()
    mode: str | None = None
    current_node: str | None = None
    current_edge: dict[str, str] | None = None

    for raw_line in graph_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if stripped == "nodes:":
            mode = "nodes"
            continue
        if stripped == "edges:":
            mode = "edges"
            current_node = None
            continue
        if mode == "nodes":
            item = re.match(r"^-\s+id:\s+(.+?)\s*$", stripped)
            if item:
                node_id = item.group(1)
                current_node = node_id
                node_ids.add(node_id)
                continue
            if current_node:
                type_item = re.match(r"^type:\s+(.+?)\s*$", stripped)
                path_item = re.match(r"^path:\s+(.+?)\s*$", stripped)
                if type_item:
                    node_types[current_node] = type_item.group(1)
                if path_item:
                    node_paths[current_node] = path_item.group(1)
        elif mode == "edges":
            from_item = re.match(r"^-\s+from:\s+(.+?)\s*$", stripped)
            type_item = re.match(r"^type:\s+(.+?)\s*$", stripped)
            to_item = re.match(r"^to:\s+(.+?)\s*$", stripped)
            if from_item:
                current_edge = {"from": from_item.group(1)}
                continue
            if current_edge is None:
                continue
            if type_item:
                current_edge["type"] = type_item.group(1)
            if to_item:
                current_edge["to"] = to_item.group(1)
                if {"from", "type", "to"} <= set(current_edge):
                    edges.add(
                        (
                            current_edge["from"],
                            current_edge["type"],
                            current_edge["to"],
                        )
                    )
                current_edge = None
    return Graph(node_ids, node_paths, node_types, edges)


def audit_graph(root: Path, docs: list[DocumentInfo]) -> list[Finding]:
    graph = parse_graph(root)
    if graph is None:
        return [
            make_finding(
                "critical",
                "missing_graph",
                "graph/project_graph.example.yaml",
                "Project graph is missing.",
                "Create graph/project_graph.example.yaml from graph/GRAPH_SCHEMA.md.",
            )
        ]
    findings: list[Finding] = []
    graph_rel = "graph/project_graph.example.yaml"
    for node_id, node_path in graph.node_paths.items():
        if not path_exists(root, root / "graph/project_graph.example.yaml", node_path):
            findings.append(
                make_finding(
                    "high",
                    "broken_graph_path",
                    graph_rel,
                    f"Graph node {node_id} points to missing path: {node_path}",
                    "Fix the graph node path or create the referenced artifact.",
                    section=node_id,
                )
            )
    for from_id, edge_type, to_id in graph.edges:
        if from_id not in graph.node_ids or to_id not in graph.node_ids:
            findings.append(
                make_finding(
                    "high",
                    "broken_graph_edge",
                    graph_rel,
                    f"Graph edge {from_id} --{edge_type}--> {to_id} references an unknown node.",
                    "Add the missing node or correct the edge endpoint.",
                    section=f"{from_id}:{edge_type}:{to_id}",
                )
            )

    task_docs = [doc for doc in docs if doc.doc_type == "TASK"]
    plan_docs = [doc for doc in docs if doc.doc_type == "EXECUTION_PLAN"]
    prompt_docs = [doc for doc in docs if doc.doc_type == "CODING_PROMPT"]
    validation_docs = [doc for doc in docs if doc.doc_type == "VALIDATION_REPORT"]

    for doc in task_docs:
        task_id = metadata_text(doc.metadata.get("id")) or doc.path.stem.split("-", 2)[0]
        if not has_edge(graph, task_id, "impacts_goal"):
            findings.append(missing_graph_edge(graph_rel, task_id, "impacts_goal", "Goal"))
        if not has_edge(graph, task_id, "implements"):
            findings.append(missing_graph_edge(graph_rel, task_id, "implements", "Feature or Milestone"))
        if not has_reverse_edge(graph, task_id, "derives_from", "ExecutionPlan"):
            findings.append(missing_graph_edge(graph_rel, task_id, "decomposes_into", "ExecutionPlan"))

    for doc in plan_docs:
        plan_id = metadata_text(doc.metadata.get("id")) or doc.path.stem
        plan_status = metadata_text(doc.metadata.get("status")).lower()
        if not has_edge(graph, plan_id, "derives_from"):
            findings.append(missing_graph_edge(graph_rel, plan_id, "derives_from", "Task"))
        if plan_status in VALID_IMPLEMENTATION_STATUSES and not has_edge(graph, plan_id, "generates"):
            findings.append(missing_graph_edge(graph_rel, plan_id, "generates", "CodingPrompt"))
        if not has_edge(graph, plan_id, "constrained_by"):
            findings.append(missing_graph_edge(graph_rel, plan_id, "constrained_by", "ADR or ArchitectureDocument"))

    for doc in prompt_docs:
        prompt_id = doc.path.stem
        if not has_reverse_edge(graph, prompt_id, "generates", "ExecutionPlan") and not has_edge(
            graph, prompt_id, "derives_from"
        ):
            findings.append(missing_graph_edge(graph_rel, prompt_id, "derives_from", "ExecutionPlan"))
        if not has_edge(graph, prompt_id, "included_in_context"):
            findings.append(missing_graph_edge(graph_rel, prompt_id, "included_in_context", "ContextPackage"))

    for doc in validation_docs:
        validation_id = doc.path.stem
        if not has_edge(graph, validation_id, "validates"):
            findings.append(missing_graph_edge(graph_rel, validation_id, "validates", "Task or ExecutionPlan or Feature"))

    return findings


def has_edge(graph: Graph, from_id: str, edge_type: str) -> bool:
    return any(edge[0] == from_id and edge[1] == edge_type for edge in graph.edges)


def has_reverse_edge(graph: Graph, to_id: str, edge_type: str, _source_type: str) -> bool:
    return any(edge[1] == edge_type and edge[2] == to_id for edge in graph.edges)


def missing_graph_edge(path: str, node_id: str, edge_type: str, target: str) -> Finding:
    return make_finding(
        "high",
        "missing_graph_edge",
        path,
        f"Graph node {node_id} is missing required {edge_type} edge to {target}.",
        "Add the required edge from graph/GRAPH_SCHEMA.md.",
        section=f"{node_id}:{edge_type}",
    )


def audit_cross_artifact_consistency(root: Path, docs: list[DocumentInfo]) -> list[Finding]:
    findings: list[Finding] = []
    by_rel = {doc.rel: doc for doc in docs}
    tasks = [doc for doc in docs if doc.doc_type == "TASK"]
    goal_impacts = [doc for doc in docs if doc.doc_type == "GOAL_IMPACT"]
    plans = [doc for doc in docs if doc.doc_type == "EXECUTION_PLAN"]
    prompts = [doc for doc in docs if doc.doc_type == "CODING_PROMPT"]
    validation_reports = [doc for doc in docs if doc.doc_type == "VALIDATION_REPORT"]

    goal_by_artifact = {
        metadata_text(doc.metadata.get("artifact_id")): doc
        for doc in goal_impacts
        if metadata_text(doc.metadata.get("artifact_id"))
    }
    plan_by_source = {
        normalize_rel(root, doc.path, metadata_text(doc.metadata.get("source_task"))): doc
        for doc in plans
        if metadata_text(doc.metadata.get("source_task"))
    }

    for task in tasks:
        task_id = metadata_text(task.metadata.get("id")) or task.path.stem.split("-", 2)[0]
        task_status = metadata_text(task.metadata.get("status")).lower()
        goal_links = metadata_list(task.metadata.get("goal_impact"))
        plan_links = metadata_list(task.metadata.get("execution_plan"))

        if not goal_links:
            findings.append(
                make_finding(
                    "high",
                    "missing_goal_impact_link",
                    task.rel,
                    f"{task.rel} has no goal_impact metadata links.",
                    "Create a goal impact record or explicitly block the task from implementation.",
                    section="goal_impact",
                    draft_source=TEMPLATE_FOR_DOC_TYPE["GOAL_IMPACT"],
                )
            )
        if not plan_links:
            findings.append(
                make_finding(
                    "high",
                    "missing_execution_plan_link",
                    task.rel,
                    f"{task.rel} has no execution_plan metadata links.",
                    "Create an execution plan or explicitly block the task from implementation.",
                    section="execution_plan",
                    draft_source=TEMPLATE_FOR_DOC_TYPE["EXECUTION_PLAN"],
                )
            )

        linked_goal = goal_by_artifact.get(task_id)
        if linked_goal:
            artifact_path = normalize_rel(root, linked_goal.path, metadata_text(linked_goal.metadata.get("artifact_path")))
            if artifact_path != task.rel:
                findings.append(
                    make_finding(
                        "high",
                        "goal_impact_mismatch",
                        linked_goal.rel,
                        f"{linked_goal.rel} artifact_path does not match {task.rel}.",
                        "Update artifact_path so the goal impact record validates the task it names.",
                        section="artifact_path",
                    )
                )
        elif goal_links:
            findings.append(
                make_finding(
                    "high",
                    "goal_impact_mismatch",
                    task.rel,
                    f"{task.rel} has no goal impact record with artifact_id {task_id}.",
                    "Align the goal impact record artifact_id with the task id.",
                    section="goal_impact",
                )
            )

        if task.rel not in plan_by_source and plan_links:
            findings.append(
                make_finding(
                    "high",
                    "execution_plan_mismatch",
                    task.rel,
                    f"{task.rel} has no execution plan whose source_task matches this task.",
                    "Set source_task in the execution plan to this task path.",
                    section="execution_plan",
                )
            )

        if task_status in {"completed", "implemented", "validated"} and not validates(validation_reports, task_id):
            findings.append(
                make_finding(
                    "high",
                    "missing_validation_report",
                    task.rel,
                    f"{task.rel} is {task_status} but has no validation report.",
                    "Create a validation report and connect it in the graph.",
                    section="validation",
                    draft_source=TEMPLATE_FOR_DOC_TYPE["VALIDATION_REPORT"],
                )
            )

    for prompt in prompts:
        task_ids = sorted(set(re.findall(r"\bTASK-\d+\b", prompt.text)))
        for task_id in task_ids:
            task_doc = next(
                (doc for doc in tasks if metadata_text(doc.metadata.get("id")) == task_id),
                None,
            )
            if not task_doc:
                continue
            linked_plans = [
                by_rel.get(normalize_rel(root, task_doc.path, ref))
                for ref in metadata_list(task_doc.metadata.get("execution_plan"))
            ]
            for plan in linked_plans:
                if plan is None:
                    continue
                plan_status = metadata_text(plan.metadata.get("status")).lower()
                if plan_status not in VALID_IMPLEMENTATION_STATUSES:
                    findings.append(
                        make_finding(
                            "high",
                            "prompt_from_unapproved_plan",
                            prompt.rel,
                            f"{prompt.rel} exists for {task_id}, but {plan.rel} is status {plan_status or 'missing'}.",
                            "Review and approve the execution plan before using the coding prompt.",
                            section=plan.rel,
                        )
                    )
    return findings


def normalize_rel(root: Path, base_path: Path, ref: str) -> str:
    resolved = resolve_reference(base_path, ref)
    if resolved is None:
        return ref
    try:
        return resolved.relative_to(root.resolve()).as_posix()
    except ValueError:
        return ref


def validates(validation_reports: list[DocumentInfo], artifact_id: str) -> bool:
    return any(artifact_id in doc.text for doc in validation_reports)


def audit_file(doc: DocumentInfo) -> FileAuditResult:
    missing, empty, findings = audit_document_sections(doc)
    findings.extend(audit_metadata(doc))
    findings.extend(audit_traceability_fields(doc))
    if doc.doc_type == "SEMANTIC_COMPRESSION":
        findings.extend(audit_semantic_compression(doc))
    return {
        "path": doc.rel,
        "type": doc.doc_type,
        "missing_sections": missing,
        "empty_or_placeholder_sections": empty,
        "ok": not findings,
        "findings": findings,
    }


def dedupe_findings(findings: list[Finding]) -> list[Finding]:
    seen: set[tuple[str, str, str, str | None]] = set()
    result: list[Finding] = []
    for finding in findings:
        key = (finding["type"], finding["path"], finding["message"], finding["section"])
        if key in seen:
            continue
        seen.add(key)
        result.append(finding)
    return result


def score_from_findings(findings: list[Finding]) -> int:
    score = 100
    for finding in findings:
        if finding["severity"] == "critical":
            score -= 20
        elif finding["severity"] == "high":
            score -= 10
    return max(score, 0)


def draft_recommendations_for(findings: list[Finding]) -> list[DraftRecommendation]:
    recommendations: list[DraftRecommendation] = []
    for finding in findings:
        template = finding["draft_source"]
        if template is None:
            continue
        recommendations.append(
            {
                "path": finding["path"],
                "template": template,
                "reason": finding["message"],
            }
        )
    return recommendations


def remediation_plan_for(report: AuditReport) -> list[RemediationAction]:
    actions: list[RemediationAction] = []
    for finding in report["findings"]:
        template = finding["draft_source"]
        if template is None:
            continue
        if finding["path"] in IMMUTABLE_PATHS:
            actions.append(
                {
                    "action": "manual_review_required",
                    "path": finding["path"],
                    "section": finding["section"],
                    "template": template,
                    "reason": "Immutable source-of-truth documents require human amendment review.",
                    "writes_file": False,
                }
            )
            continue
        if finding["type"] in {"missing_section", "empty_or_placeholder_section"}:
            actions.append(
                {
                    "action": "append_missing_section",
                    "path": finding["path"],
                    "section": finding["section"],
                    "template": template,
                    "reason": finding["message"],
                    "writes_file": True,
                }
            )
        elif finding["type"] == "missing_document" and finding["path"].endswith(".md"):
            actions.append(
                {
                    "action": "create_document_from_template",
                    "path": finding["path"],
                    "section": None,
                    "template": template,
                    "reason": finding["message"],
                    "writes_file": True,
                }
            )
        else:
            actions.append(
                {
                    "action": "proposal_only",
                    "path": finding["path"],
                    "section": finding["section"],
                    "template": template,
                    "reason": finding["message"],
                    "writes_file": False,
                }
            )
    return dedupe_remediation_actions(actions)


def dedupe_remediation_actions(actions: list[RemediationAction]) -> list[RemediationAction]:
    seen: set[tuple[str, str, str | None]] = set()
    result: list[RemediationAction] = []
    for action in actions:
        key = (action["action"], action["path"], action["section"])
        if key in seen:
            continue
        seen.add(key)
        result.append(action)
    return result


def render_remediation_plan(actions: list[RemediationAction]) -> str:
    lines = ["# Documentation Remediation Plan", ""]
    if not actions:
        lines.append("No remediation actions are proposed.")
        return "\n".join(lines)

    for action in actions:
        section = f" section `{action['section']}`" if action["section"] else ""
        write_note = "writes file" if action["writes_file"] else "proposal only"
        lines.append(f"- {action['action']}: `{action['path']}`{section} ({write_note})")
        lines.append(f"  Template: `{action['template']}`")
        lines.append(f"  Reason: {action['reason']}")
    lines.extend(
        [
            "",
            "No files are written unless remediation is run with explicit approval.",
        ]
    )
    return "\n".join(lines)


def apply_remediation_plan(root: Path, actions: list[RemediationAction]) -> list[str]:
    changed: list[str] = []
    for action in actions:
        if not action["writes_file"]:
            continue
        target = (root / action["path"]).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError as exc:
            raise ValueError(f"Refusing to write outside root: {action['path']}") from exc
        if action["path"] in IMMUTABLE_PATHS:
            raise ValueError(f"Refusing to modify immutable document: {action['path']}")

        template_path = root / action["template"]
        if not template_path.exists():
            raise FileNotFoundError(f"Missing remediation template: {action['template']}")

        if action["action"] == "create_document_from_template":
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(template_path.read_text(encoding="utf-8"), encoding="utf-8")
            changed.append(action["path"])
        elif action["action"] == "append_missing_section":
            if action["section"] is None or not target.exists():
                continue
            text = target.read_text(encoding="utf-8")
            if normalize_heading(action["section"]) in sections(text):
                continue
            body = template_section_body(template_path, action["section"])
            addition = f"\n\n## {action['section']}\n\n{body}\n"
            target.write_text(text.rstrip() + addition, encoding="utf-8")
            changed.append(action["path"])
    return changed


def template_section_body(template_path: Path, heading: str) -> str:
    template_sections = sections(template_path.read_text(encoding="utf-8"))
    section = template_sections.get(normalize_heading(heading))
    if section is not None and section.body.strip():
        return section.body.strip()
    return f"[MISSING: fill {heading} from approved upstream documents]"


def audit(root: Path) -> AuditReport:
    root = root.resolve()
    checked_files: list[FileAuditResult] = []
    docs = load_documents(root)
    findings = audit_required_paths(root)

    for doc in docs:
        result = audit_file(doc)
        checked_files.append(result)
        findings.extend(result["findings"])

    findings.extend(audit_link_reality(root, docs))
    findings.extend(audit_graph(root, docs))
    findings.extend(audit_cross_artifact_consistency(root, docs))
    findings = dedupe_findings(findings)

    status: Status = "FAIL" if findings else "PASS"
    return {
        "root": str(root),
        "status": status,
        "score": score_from_findings(findings),
        "files_checked": len(checked_files),
        "files_with_issues": sum(1 for item in checked_files if not item["ok"]),
        "findings_count": len(findings),
        "critical_count": sum(1 for item in findings if item["severity"] == "critical"),
        "high_count": sum(1 for item in findings if item["severity"] == "high"),
        "findings": findings,
        "results": checked_files,
        "draft_recommendations": draft_recommendations_for(findings),
    }


def render_markdown(report: AuditReport) -> str:
    lines = [
        "# Documentation Audit Report",
        "",
        f"Status: {report['status']}",
        f"Score: {report['score']}/100",
        f"Files checked: {report['files_checked']}",
        f"Files with issues: {report['files_with_issues']}",
        f"Findings: {report['findings_count']}",
        "",
        "## Management Summary",
        "",
    ]

    if report["status"] == "PASS":
        lines.append(
            "The repository documentation satisfies the strict local audit rules."
        )
    else:
        lines.append(
            "The repository documentation is not ready for controlled AI-assisted "
            "implementation. Resolve critical and high-severity findings before "
            "generating or using coding prompts."
        )

    if report["findings"]:
        lines.extend(["", "## Findings", ""])
        for finding in report["findings"]:
            lines.append(f"- [{finding['severity'].upper()}] {finding['message']}")
            lines.append(f"  Recommendation: {finding['recommendation']}")

    if report["draft_recommendations"]:
        lines.extend(["", "## Draft Generation Recommendations", ""])
        for item in report["draft_recommendations"]:
            lines.append(f"- Target: `{item['path']}`")
            lines.append(f"  Template: `{item['template']}`")
            lines.append(f"  Reason: {item['reason']}")

    lines.extend(
        [
            "",
            "## Next Actions",
            "",
            "- Use mapped templates for missing documents or sections.",
            "- Fill draft content only from approved upstream documents.",
            "- Keep immutable vision and constitution changes under human review.",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit local Intent Preservation System documentation."
    )
    parser.add_argument(
        "--root",
        default=str(DEFAULT_ROOT),
        help="Repository root to audit.",
    )
    parser.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="json",
        help="Output format.",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="Exit non-zero when findings exist.",
    )
    parser.add_argument(
        "--remediation-plan",
        action="store_true",
        help="Print an approval-gated remediation plan for audit findings.",
    )
    parser.add_argument(
        "--apply-remediation",
        action="store_true",
        help="Apply approved template-based remediation actions.",
    )
    parser.add_argument(
        "--approve-remediation",
        action="store_true",
        help="Required with --apply-remediation to confirm file writes.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    report = audit(root)
    remediation_actions = remediation_plan_for(report)

    if args.apply_remediation:
        if not args.approve_remediation:
            print(
                "Refusing to write files without --approve-remediation.",
                file=sys.stderr,
            )
            print(render_remediation_plan(remediation_actions))
            return 2
        changed = apply_remediation_plan(root, remediation_actions)
        print(json.dumps({"changed": changed}, indent=2, ensure_ascii=False))
    elif args.remediation_plan:
        if args.format == "json":
            print(json.dumps(remediation_actions, indent=2, ensure_ascii=False))
        else:
            print(render_remediation_plan(remediation_actions))
    elif args.format == "markdown":
        print(render_markdown(report))
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))

    if args.fail_on_issues and report["findings"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
