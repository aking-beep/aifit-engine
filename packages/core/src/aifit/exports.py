from __future__ import annotations

import json

from .models import UserFitVector


def persona_to_markdown(persona: dict, heading: str = "AI Working Configuration") -> str:
    sections = [
        (heading, None),
        (None, persona.get("purpose", "")),
        ("Interaction rules", persona.get("interaction_rules", [])),
        ("Response rules", persona.get("response_rules", [])),
        ("Decision rules", persona.get("decision_rules", [])),
        ("Tool rules", persona.get("tool_rules", [])),
        ("Avoid", persona.get("avoid", [])),
    ]
    lines: list[str] = []
    for title, body in sections:
        if title and body is None:
            lines += [f"# {title}", ""]
            continue
        if isinstance(body, str):
            if body:
                lines += [body, ""]
            continue
        if not body:
            continue
        lines += [f"## {title}"]
        for item in body:
            lines.append(f"- {item}")
        lines.append("")
    lines.append(f"> {persona.get('disclaimer', '')}")
    lines.append("")
    lines.append("Edit these rules. They are a working configuration, not a psychological profile.")
    return "\n".join(lines) + "\n"


def export_persona(persona: dict, target: str) -> tuple[str, str]:
    if target == "json":
        return "ai-fit-profile.json", json.dumps(persona, indent=2)
    if target == "claude":
        return "CLAUDE.md", persona_to_markdown(persona, "Claude Working Configuration")
    if target == "agents":
        return "AGENTS.md", persona_to_markdown(persona, "Agent Working Configuration")
    if target == "cursor":
        body = persona_to_markdown(persona, "AI Fit Cursor Rule")
        return (
            ".cursor/rules/ai-fit.mdc",
            "---\ndescription: Personalized AI Fit working rules\nalwaysApply: true\n---\n\n" + body,
        )
    return "persona.md", persona_to_markdown(persona)


def export_profile(persona: dict, user: UserFitVector, target: str) -> tuple[str, str]:
    if target == "json":
        payload = {"persona": persona, "user_vector": user.model_dump()}
        return "ai-fit-profile.json", json.dumps(payload, indent=2)
    return export_persona(persona, target)
