"""Downloadable configuration bundle: templates, setup guide, validation, manifest.

Every file in the bundle is (1) scanned for secrets and redacted, then (2)
validated against the format its extension declares, then (3) listed in
``manifest.json`` with its size and SHA-256. If any check fails the bundle is
not produced. The manifest records the checks that actually ran; it does not
claim anything else was validated.
"""

from __future__ import annotations

import hashlib
import json
import re
from io import BytesIO
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from . import __version__
from .exports import export_pack_files

MAX_FILE_BYTES = 256 * 1024
BUNDLE_ROOT = "ai-profile"

# Patterns for credentials people sometimes paste into notes. Conservative on
# purpose: a false positive redacts a harmless string, a false negative ships a key.
SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)")),
    ("anthropic_key", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{16,}")),
    ("openai_key", re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{20,}")),
    ("stripe_key", re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}")),
    ("stripe_webhook_secret", re.compile(r"\bwhsec_[A-Za-z0-9]{16,}")),
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github_token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}")),
    ("slack_token", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}")),
    ("google_api_key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")),
    (
        "assigned_secret",
        re.compile(r"(?i)\b(?:api[_-]?key|secret|password|passwd|token|bearer)\b\s*[:=]\s*['\"]?[A-Za-z0-9_\-\.\/+]{12,}"),
    ),
]

REDACTED = "[REDACTED]"


class BundleValidationError(ValueError):
    def __init__(self, failures: list[dict[str, Any]]):
        super().__init__("Bundle failed validation: " + "; ".join(f"{f['path']}: {f['detail']}" for f in failures))
        self.failures = failures


def find_secrets(text: str) -> list[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(text)]


def redact_secrets(text: str) -> tuple[str, int]:
    count = 0
    for _, pattern in SECRET_PATTERNS:
        text, n = pattern.subn(REDACTED, text)
        count += n
    return text, count


# --- Format validation ----------------------------------------------------------


def _check(name: str, passed: bool, detail: str) -> dict[str, Any]:
    return {"check": name, "passed": passed, "detail": detail}


def _front_matter(text: str) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    fields: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            return None
        key, _, value = line.partition(":")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_\-]*", key.strip()):
            return None
        fields[key.strip()] = value.strip()
    return fields


def declared_format(path: str) -> str:
    if path.endswith(".json"):
        return "json"
    if path.endswith(".mdc"):
        return "cursor-rule"
    if path.endswith(".md"):
        return "markdown"
    return "text"


def validate_file(path: str, content: str) -> list[dict[str, Any]]:
    fmt = declared_format(path)
    raw = content.encode("utf-8")
    checks = [
        _check("utf8", True, "Encoded as UTF-8."),
        _check("non_empty", bool(content.strip()), "File has content." if content.strip() else "File is empty."),
        _check("size", len(raw) <= MAX_FILE_BYTES, f"{len(raw)} bytes (limit {MAX_FILE_BYTES})."),
        _check("no_nul", "\x00" not in content, "No NUL bytes." if "\x00" not in content else "Contains NUL bytes."),
    ]
    leaked = find_secrets(content)
    checks.append(_check("no_secrets", not leaked, "No credential patterns found." if not leaked
                         else f"Credential patterns found: {', '.join(leaked)}."))
    if fmt == "json":
        try:
            json.loads(content)
            checks.append(_check("json_parses", True, "Parses as JSON."))
        except json.JSONDecodeError as exc:
            checks.append(_check("json_parses", False, f"Invalid JSON: {exc.msg} at line {exc.lineno}."))
    elif fmt == "cursor-rule":
        fm = _front_matter(content)
        ok = fm is not None and "description" in fm and fm.get("alwaysApply") in ("true", "false")
        checks.append(_check("cursor_front_matter", ok,
                             "Front matter has description and a boolean alwaysApply." if ok
                             else "Front matter must open the file and set description and alwaysApply: true|false."))
    elif fmt == "markdown":
        ok = content.lstrip().startswith("#")
        checks.append(_check("markdown_heading", ok, "Starts with a heading." if ok else "Does not start with a heading."))
    return checks


# --- Templates ----------------------------------------------------------------------


def _rules(persona: dict[str, Any], key: str, n: int) -> list[str]:
    return [r for r in (persona.get(key) or []) if isinstance(r, str) and r.strip()][:n]


def _style_block(persona: dict[str, Any]) -> str:
    rules = _rules(persona, "interaction_rules", 2) + _rules(persona, "response_rules", 2)
    if not rules:
        return ""
    return "How to work with me:\n" + "\n".join(f"- {r}" for r in rules) + "\n\n"


PROMPTS: list[tuple[str, str, str, str]] = [
    (
        "draft.md",
        "Draft something new",
        "Use when you need a first version of an email, post, document or plan.",
        "Draft a {{what you need}} for {{who will read it}}.\n"
        "Goal: {{what it should achieve}}.\n"
        "Must include: {{key points}}.\n"
        "Length: {{rough length}}. Tone: {{tone}}.\n"
        "Before drafting, list any assumptions you are making in one short line.",
    ),
    (
        "summarize.md",
        "Summarise something long",
        "Use for articles, reports, meeting notes or threads.",
        "Summarise the text below for {{who it is for}}.\n"
        "Give me: the main point in one sentence, then the {{3-5}} details that matter most, then anything I need to do.\n"
        "Quote the original wording for any number, date or commitment.\n\n"
        "Text:\n{{paste here}}",
    ),
    (
        "research.md",
        "Research a question with sources",
        "Use when the answer depends on facts you will act on.",
        "Research: {{question}}.\n"
        "Context: {{why I am asking}}.\n"
        "Give a short answer first, then the evidence. Cite a source for every factual claim, and say plainly when "
        "you are unsure or sources disagree. Do not invent sources.",
    ),
    (
        "review.md",
        "Review my work",
        "Use before you send or publish something.",
        "Review the {{type of work}} below for {{audience}}.\n"
        "Check: accuracy, clarity, anything missing, and anything that could be misread.\n"
        "List problems in order of importance with a suggested fix for each. Do not rewrite the whole thing unless I ask.\n\n"
        "Work:\n{{paste here}}",
    ),
    (
        "decide.md",
        "Compare options before deciding",
        "Use when you are choosing between tools, plans or approaches.",
        "Help me choose between {{option A}} and {{option B}} (and {{others}}).\n"
        "What matters most to me: {{criteria}}. Hard limits: {{budget, time, must-haves}}.\n"
        "Lay out the trade-offs in a short table, then recommend one and say what would change your recommendation.",
    ),
]


def prompt_templates(result: dict[str, Any]) -> list[tuple[str, str]]:
    persona = result.get("persona") or {}
    style = _style_block(persona)
    files = []
    for filename, title, when, body in PROMPTS:
        content = (
            f"# {title}\n\n{when}\n\nReplace each {{{{placeholder}}}} before sending.\n\n"
            f"```text\n{style}{body}\n```\n"
        )
        files.append((f"prompts/{filename}", content))
    return files


def workflow_template(result: dict[str, Any]) -> tuple[str, str]:
    steps = result.get("workflow") or []
    stack = result.get("operating_stack") or []
    lines = ["# Your AI workflow", "", "A repeatable loop built from your results. Adapt it to the task.", ""]
    if steps:
        for n, step in enumerate(steps, 1):
            label = step.get("label") or f"Step {n}"
            lines.append(f"{n}. **{label}** — {step.get('instruction', '')}".rstrip(" —"))
    else:
        lines += [
            "1. **Frame** — say what you want, who it is for and what good looks like.",
            "2. **Draft** — let the AI produce a first version.",
            "3. **Check** — verify facts, numbers and anything you will act on.",
            "4. **Refine** — ask for specific changes rather than starting over.",
        ]
    tools = [(s.get("label"), (s.get("product") or {}).get("name")) for s in stack if (s.get("product") or {}).get("name")]
    if tools:
        lines += ["", "## Which tool for which step", ""]
        lines += [f"- {label}: {name}" for label, name in tools]
    lines += ["", "Check anything an AI tells you before you rely on it for money, health, legal or safety decisions.", ""]
    return "workflows/everyday-loop.md", "\n".join(lines)


SETUP_STEPS = [
    ("CLAUDE.md", "Claude Code",
     "Put `CLAUDE.md` in the root folder of a project. Claude Code reads it when you start a session in that folder."),
    ("AGENTS.md", "Coding agents that read AGENTS.md",
     "Put `AGENTS.md` in the root of a repository. Agents that support the AGENTS.md convention read it from there."),
    (".cursor/rules/fit.mdc", "Cursor",
     "Copy `.cursor/rules/fit.mdc` into the same path inside your project. Cursor applies project rules from "
     "`.cursor/rules/`."),
    ("chatgpt-instructions.md", "ChatGPT",
     "Open ChatGPT's settings, find the personalisation or custom-instructions section, and paste the rules from "
     "`chatgpt-instructions.md`. Menu names change; search the settings for “instructions” if you cannot find it."),
    ("gemini-instructions.md", "Gemini",
     "Create a Gem (a saved custom assistant) and paste `gemini-instructions.md` as its instructions."),
    ("prompts/", "Any chat assistant",
     "Open a file in `prompts/`, fill in the {{placeholders}}, and paste it into any assistant."),
]


def setup_readme(result: dict[str, Any], paths: list[str]) -> str:
    label = (result.get("workstyle") or {}).get("label") or (result.get("persona") or {}).get("label") or "your"
    lines = [
        f"# Your AI setup — {label}",
        "",
        "Generated by Fit from your quiz answers. Every file is plain text you can read and edit before using it.",
        "",
        "## Set it up",
        "",
    ]
    for target, tool, how in SETUP_STEPS:
        if any(p == target or p.startswith(target) for p in paths):
            lines += [f"### {tool}", "", how, ""]
    lines += [
        "## What is in this folder",
        "",
        *[f"- `{p}`" for p in paths],
        "- `manifest.json` — every file with its size, SHA-256 and the format checks that ran on it",
        "",
        "## Notes",
        "",
        "- No passwords, API keys or account details are included. Anything that looked like one in your notes was "
        "replaced with [REDACTED].",
        "- These are working preferences, not a psychological profile. Change anything that does not fit.",
        "",
    ]
    return "\n".join(lines)


# --- Bundle ------------------------------------------------------------------------


def bundle_files(result: dict[str, Any]) -> list[tuple[str, str]]:
    files = [(name, body) for name, body in export_pack_files(result)]
    files = [(".cursor/rules/fit.mdc", body) if name == "cursor-rules.md" else (name, body) for name, body in files]
    files += prompt_templates(result)
    files.append(workflow_template(result))
    files.append(("README.md", setup_readme(result, [name for name, _ in files])))
    return files


def build_bundle(result: dict[str, Any]) -> tuple[str, bytes, dict[str, Any]]:
    """Return (filename, zip bytes, manifest). Raises BundleValidationError on any failed check."""
    redactions = 0
    checked: list[tuple[str, str, list[dict[str, Any]]]] = []
    for path, body in bundle_files(result):
        clean, n = redact_secrets(body)
        redactions += n
        checked.append((path, clean, validate_file(path, clean)))

    failures = [{"path": p, "detail": c["detail"]} for p, _, checks in checked for c in checks if not c["passed"]]
    if failures:
        raise BundleValidationError(failures)

    manifest = {
        "bundle": BUNDLE_ROOT,
        "generator": f"aifit {__version__}",
        "files": [
            {
                "path": path,
                "format": declared_format(path),
                "bytes": len(body.encode("utf-8")),
                "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
                "checks": [c["check"] for c in checks],
            }
            for path, body, checks in checked
        ],
        "validation": {
            "status": "format_checks_passed",
            "scope": "Each file was checked for UTF-8, size, NUL bytes, credential patterns, and its declared format "
                     "(JSON parses; Cursor rule front matter; Markdown heading). Nothing beyond these checks was validated.",
        },
        "secretsRedacted": redactions,
    }
    manifest_text = json.dumps(manifest, indent=2) + "\n"
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for path, body, _ in checked:
            archive.writestr(f"{BUNDLE_ROOT}/{path}", body)
        archive.writestr(f"{BUNDLE_ROOT}/manifest.json", manifest_text)
    return f"{BUNDLE_ROOT}.zip", buffer.getvalue(), manifest
