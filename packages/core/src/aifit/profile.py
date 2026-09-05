"""AI workstyle, stack roles, model router, workflow, install guides."""

from __future__ import annotations

from .models import MetricResult, Recommendation, UserFitVector

INTERACTION_PROFILE = (
    ("autonomy", "Autonomy", ("autonomy_preference",)),
    ("verification", "Verification", ("assumption_challenge", "evidence_seeking")),
    ("iteration", "Iteration", ("iteration_preference",)),
    ("context_depth", "Context depth", ("depth_preference", "structure_preference")),
    ("tool_delegation", "Tool delegation", ("automation_appetite", "integration_appetite")),
    ("source_dependency", "Source dependency", ("evidence_seeking",)),
    ("exploration", "Exploration", ("comparison_preference", "alternative_seeking")),
)

STACK_ROLES = (
    ("primary_assistant", "Primary reasoning", ("general_assistant",)),
    ("research", "Research", ("research", "knowledge")),
    ("coding", "Development", ("coding_agent",)),
    ("ide", "IDE", ("ide",)),
    ("automation", "Automation", ("automation",)),
    ("creative", "Creative", ("writing", "image", "design", "presentation", "video")),
    ("local_private", "Local / private", ("local_open_source",)),
)

ROUTER_WORKLOADS = (
    ("strategy", "Strategy", "deep_reasoning"),
    ("research", "Research", "research"),
    ("coding", "Coding", "coding"),
    ("multimodal", "Images / multimodal", "multimodal"),
    ("fast", "Fast answers", "fast_reasoning"),
    ("agents", "Agents / automation", "agentic_execution"),
    ("local", "Local control", "local_control"),
)

MATURITY_KEYS = (
    "evidence_seeking",
    "comparison_preference",
    "iteration_preference",
    "assumption_challenge",
    "code_comfort",
    "automation_appetite",
    "integration_appetite",
)

INSTALL_GUIDES = (
    {
        "id": "chatgpt",
        "label": "ChatGPT",
        "export_target": "chatgpt",
        "filename": "chatgpt-instructions.md",
        "where": "ChatGPT → Personalization → Custom instructions",
        "steps": [
            "Open ChatGPT settings and choose Personalization.",
            "Paste into “How would you like ChatGPT to respond?”",
            "Save. Edit any line that does not match how you work.",
        ],
    },
    {
        "id": "claude",
        "label": "Claude",
        "export_target": "claude",
        "filename": "CLAUDE.md",
        "where": "Claude Project instructions, or CLAUDE.md in a repo",
        "steps": [
            "On Claude.ai: open a Project → Instructions → paste.",
            "In Claude Code: save as CLAUDE.md at the project root.",
            "Keep the file editable. This is a working config.",
        ],
    },
    {
        "id": "cursor",
        "label": "Cursor",
        "export_target": "cursor",
        "filename": ".cursor/rules/workprint.mdc",
        "where": ".cursor/rules/workprint.mdc",
        "steps": [
            "Create .cursor/rules/workprint.mdc in the project.",
            "Paste the downloaded rule. alwaysApply is already set.",
            "Reload the window so Cursor picks it up.",
        ],
    },
    {
        "id": "gemini",
        "label": "Gemini",
        "export_target": "gemini",
        "filename": "gemini-instructions.md",
        "where": "Gemini Gems → Instructions",
        "steps": [
            "Create or edit a Gem.",
            "Paste the instructions into the Gem instructions field.",
            "Use that Gem for work that should match this profile.",
        ],
    },
    {
        "id": "agents",
        "label": "Agent system prompt",
        "export_target": "agents",
        "filename": "AGENTS.md",
        "where": "AGENTS.md or your agent runner’s system prompt",
        "steps": [
            "Save as AGENTS.md at the repo root, or paste into the agent system prompt.",
            "Point coding agents at the file so they inherit the same working rules.",
        ],
    },
)

_BEHAVIOR = {
    "autonomy": "you let AI take intermediate steps instead of confirming every move",
    "verification": "you ask the system to challenge claims and show its working",
    "iteration": "you refine outputs instead of accepting the first draft",
    "context_depth": "you prefer underlying structure over a thin first answer",
    "tool_delegation": "you push work into tools, agents, and automations",
    "source_dependency": "you demand sources before treating a claim as settled",
    "exploration": "you compare options and ask for alternatives before committing",
}


def _mean(values: dict[str, float], keys: tuple[str, ...]) -> float | None:
    present = [values[key] for key in keys if key in values]
    if not present:
        return None
    return sum(present) / len(present)


def workstyle_label(values: dict[str, float]) -> str:
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("autonomy_preference", 0) >= 0.6:
        return "Evidence-Driven Operator"
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("code_comfort", 0) >= 0.6:
        return "Evidence-Driven Builder"
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("comparison_preference", 0) >= 0.65:
        return "Critical Systems Operator"
    if values.get("autonomy_preference", 0) >= 0.7 and values.get("assumption_challenge", 0) < 0.45:
        return "Fast-Cycle Operator"
    if values.get("automation_appetite", 0) >= 0.7:
        return "Workflow Operator"
    if values.get("multimodal_preference", 0) >= 0.7:
        return "Creative Iterator"
    if values.get("autonomy_preference", 0) <= 0.35:
        return "Confirm-First Collaborator"
    return "Adaptive Operator"


def workstyle_narrative(values: dict[str, float]) -> str:
    autonomy = values.get("autonomy_preference", 0.5)
    verification = max(values.get("assumption_challenge", 0), values.get("evidence_seeking", 0) * 0.85)
    iteration = values.get("iteration_preference", 0.5)
    tools = max(values.get("automation_appetite", 0), values.get("integration_appetite", 0))
    if autonomy >= 0.6 and verification >= 0.65:
        return (
            "You work best with AI when it can operate independently but expose reasoning, "
            "sources, and checkpoints before consequential actions."
        )
    if autonomy >= 0.7 and verification < 0.5:
        return "You work best with AI that moves quickly, takes intermediate steps, and does not pause for extra confirmation."
    if autonomy <= 0.35 and verification >= 0.6:
        return "You work best with AI that stays inspectable, asks before material changes, and shows the evidence behind recommendations."
    if tools >= 0.65 and iteration >= 0.6:
        return "You work best with AI that turns repeating work into tools and automations, then iterates on the result."
    if values.get("multimodal_preference", 0) >= 0.65:
        return "You work best with AI that can draft, visualize, and revise in the same loop rather than staying in plain text."
    return "You work best with AI that matches the depth you ask for, stays inspectable, and gives you a concrete next step."


def workstyle_summary(values: dict[str, float]) -> str:
    bits: list[str] = []
    if values.get("evidence_seeking", 0) >= 0.6:
        bits.append("evidence-driven")
    if values.get("iteration_preference", 0) >= 0.6:
        bits.append("iterative")
    if values.get("automation_appetite", 0) >= 0.55 or values.get("integration_appetite", 0) >= 0.55:
        bits.append("tool-oriented")
    if values.get("autonomy_preference", 0) >= 0.65:
        bits.append("high autonomy")
    elif values.get("autonomy_preference", 0) <= 0.35:
        bits.append("confirm-first")
    if values.get("assumption_challenge", 0) >= 0.55 or values.get("evidence_seeking", 0) >= 0.7:
        bits.append("high verification")
    if not bits:
        bits = ["adaptive", "inspectable"]
    return ", ".join(bits)


def maturity(user: UserFitVector) -> dict:
    scores: list[float] = []
    confs: list[float] = []
    for key in MATURITY_KEYS:
        if key in user.values:
            scores.append(user.values[key])
            confs.append(user.confidence.get(key, 0.4))
    coverage = len(scores) / len(MATURITY_KEYS)
    mean_score = sum(scores) / len(scores) if scores else 0.0
    mean_conf = sum(confs) / len(confs) if confs else 0.0
    value = round(100 * ((mean_score * 0.45) + (mean_conf * 0.35) + (coverage * 0.20)))
    if value < 45:
        band = "emerging"
    elif value < 70:
        band = "practiced"
    else:
        band = "advanced"
    return {
        "score": value,
        "band": band,
        "coverage": round(coverage, 4),
        "note": "This score tracks observed coverage and confidence. Retest after your stack or habits change.",
    }


def interaction_profile(user: UserFitVector) -> list[dict]:
    rows: list[dict] = []
    for dim_id, label, keys in INTERACTION_PROFILE:
        score = _mean(user.values, keys)
        if score is None:
            continue
        conf = _mean(user.confidence, keys) or 0.0
        rows.append(
            {
                "id": dim_id,
                "label": label,
                "score": round(score, 4),
                "display": round(score * 100),
                "confidence": round(conf, 4),
            }
        )
    return rows


def workstyle_why(user: UserFitVector, metrics: list[MetricResult] | None = None) -> list[dict]:
    profile = interaction_profile(user)
    quotes = {metric.name: metric.evidence for metric in metrics or []}
    reasons: list[dict] = []
    ranked = sorted(profile, key=lambda row: row["score"], reverse=True)
    for row in ranked:
        if row["score"] < 0.58 and len(reasons) >= 2:
            continue
        behavior = _BEHAVIOR.get(row["id"], f"you show a strong {row['label'].lower()} preference")
        evidence: list[str] = []
        for key in next(keys for dim, _label, keys in INTERACTION_PROFILE if dim == row["id"]):
            evidence.extend(quotes.get(key, [])[:2])
        reasons.append(
            {
                "dimension": row["label"],
                "score": row["display"],
                "text": f"You score {row['display']} on {row['label'].lower()} because {behavior}.",
                "evidence": list(dict.fromkeys(evidence))[:2],
            }
        )
        if len(reasons) >= 4:
            break
    if not reasons:
        reasons.append(
            {
                "dimension": "Coverage",
                "score": 0,
                "text": "The diagnostic did not yet see a dominant pattern, so this profile stays conservative.",
                "evidence": [],
            }
        )
    return reasons


def _slot_handle(role_id: str, values: dict[str, float]) -> str:
    if role_id == "primary_assistant":
        if values.get("evidence_seeking", 0) >= 0.65:
            return "Primary reasoning partner. Use it for strategy, writing, and decisions that need sources and checkpoints."
        return "Primary reasoning partner for planning, writing, and day-to-day decisions."
    if role_id == "research":
        return "Source-backed research and current-web lookup before you commit to a claim."
    if role_id == "coding":
        return "Implementation agent: scaffolding, diffs, tests, and multi-file changes."
    if role_id == "ide":
        return "In-editor pair programmer. Keep project rules here so the IDE matches this workstyle."
    if role_id == "automation":
        return "Turn repeating workflows into durable automations instead of one-off prompts."
    if role_id == "creative":
        return "Drafts, visuals, and campaign artifacts when the work is not only text."
    if role_id == "local_private":
        return "Local or self-hosted option when the work should not leave your machine."
    return "Use this product for the workload named above."


def build_workstyle(user: UserFitVector, metrics: list[MetricResult] | None = None) -> dict:
    values = user.values
    profile = interaction_profile(user)
    return {
        "label": workstyle_label(values),
        "summary": workstyle_summary(values),
        "narrative": workstyle_narrative(values),
        "why": workstyle_why(user, metrics),
        "dimensions": profile,
        "maturity": maturity(user),
        "disclaimer": "This is an interaction workstyle, not a personality type.",
    }


def build_operating_stack(recs: list[Recommendation], values: dict[str, float] | None = None) -> list[dict]:
    values = values or {}
    used: set[str] = set()
    slots: list[dict] = []
    for role_id, label, categories in STACK_ROLES:
        pick = None
        for category in categories:
            for rec in recs:
                if rec.category == category and rec.id not in used:
                    pick = rec
                    break
            if pick:
                break
        slots.append(
            {
                "role": role_id,
                "label": label,
                "handles": _slot_handle(role_id, values),
                "product": pick.model_dump() if pick else None,
            }
        )
        if pick:
            used.add(pick.id)
    return slots


def build_model_router(model_recs: dict[str, list[Recommendation]]) -> list[dict]:
    rows: list[dict] = []
    for route_id, label, workload in ROUTER_WORKLOADS:
        ranked = model_recs.get(workload) or []
        top = ranked[0] if ranked else None
        rows.append(
            {
                "id": route_id,
                "work": label,
                "workload": workload,
                "handles": f"Route {label.lower()} work here.",
                "model": top.model_dump() if top else None,
            }
        )
    return rows


def build_workflow(values: dict[str, float]) -> list[dict]:
    return [
        {
            "id": "research",
            "label": "Research",
            "emphasis": values.get("evidence_seeking", 0) >= 0.55,
            "instruction": "Gather sources and separate fact from inference before recommending.",
        },
        {
            "id": "synthesize",
            "label": "Synthesize",
            "emphasis": values.get("structure_preference", 0) >= 0.55 or values.get("comparison_preference", 0) >= 0.55,
            "instruction": "Compress options into a comparable structure with explicit tradeoffs.",
        },
        {
            "id": "challenge",
            "label": "Challenge",
            "emphasis": values.get("assumption_challenge", 0) >= 0.5,
            "instruction": "Stress-test the leading option. Surface what would change the call.",
        },
        {
            "id": "execute",
            "label": "Execute",
            "emphasis": values.get("action_orientation", 0) >= 0.55 or values.get("code_comfort", 0) >= 0.55,
            "instruction": "Produce a working artifact: draft, plan, code, or automation.",
        },
        {
            "id": "verify",
            "label": "Verify",
            "emphasis": values.get("evidence_seeking", 0) >= 0.6 or values.get("iteration_preference", 0) >= 0.6,
            "instruction": "Check claims, diffs, or outputs against the original constraint.",
        },
    ]


def default_instructions(persona: dict) -> str:
    lines = [
        f"You are operating as {persona.get('label', 'an Adaptive Operator')}.",
        persona.get("purpose", ""),
        "",
        "Interaction:",
        *[f"- {item}" for item in persona.get("interaction_rules", [])],
        "",
        "Responses:",
        *[f"- {item}" for item in persona.get("response_rules", [])],
        "",
        "Decisions:",
        *[f"- {item}" for item in persona.get("decision_rules", [])],
        "",
        "Tools:",
        *[f"- {item}" for item in persona.get("tool_rules", [])],
    ]
    avoid = persona.get("avoid") or []
    if avoid:
        lines += ["", "Avoid:", *[f"- {item}" for item in avoid]]
    lines += ["", persona.get("disclaimer", "")]
    return "\n".join(line for line in lines if line is not None).strip() + "\n"


def share_card_text(result: dict) -> str:
    workstyle = result.get("workstyle") or {}
    persona = result.get("persona") or {}
    dims = workstyle.get("dimensions") or []
    dim_line = " · ".join(f"{row['label']} {row.get('display', round(row.get('score', 0) * 100))}" for row in dims)
    stack = []
    for slot in result.get("operating_stack") or []:
        product = slot.get("product") or {}
        if product.get("name"):
            stack.append(product["name"])
    lines = [
        "WORKPRINT",
        workstyle.get("label") or persona.get("label") or "AI Workstyle",
        "",
        workstyle.get("narrative") or workstyle.get("summary") or "",
        "",
        dim_line,
        "",
        f"Stack: {' · '.join(stack[:5]) or 'n/a'}",
        f"Persona: {persona.get('label') or 'n/a'}",
    ]
    return "\n".join(lines).strip() + "\n"


def install_guides() -> list[dict]:
    return [dict(item) for item in INSTALL_GUIDES]
