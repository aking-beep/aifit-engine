"""AI operating profile: workstyle, stack roles, model router, workflow, maturity."""

from __future__ import annotations

from .models import Recommendation, UserFitVector

WORKSTYLE_DIMENSIONS = (
    ("evidence_seeking", "Evidence"),
    ("assumption_challenge", "Verification"),
    ("comparison_preference", "Comparison"),
    ("iteration_preference", "Iteration"),
    ("autonomy_preference", "Autonomy"),
    ("code_comfort", "Coding"),
    ("automation_appetite", "Automation"),
    ("integration_appetite", "Tool use"),
    ("local_control_preference", "Local control"),
)

STACK_ROLES = (
    ("primary_assistant", "Primary assistant", ("general_assistant",)),
    ("research", "Research", ("research", "knowledge")),
    ("coding", "Coding", ("coding_agent", "ide")),
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


def workstyle_label(values: dict[str, float]) -> str:
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("code_comfort", 0) >= 0.6:
        return "Evidence-Driven Builder"
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("comparison_preference", 0) >= 0.65:
        return "Critical Systems Partner"
    if values.get("automation_appetite", 0) >= 0.7:
        return "Workflow Operator"
    if values.get("multimodal_preference", 0) >= 0.7:
        return "Creative Iterator"
    if values.get("autonomy_preference", 0) <= 0.35:
        return "Confirm-First Collaborator"
    return "Adaptive Working Partner"


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
        "note": "Maturity is observed interaction coverage and confidence, not intelligence. Retest after your stack or habits change.",
    }


def build_workstyle(user: UserFitVector) -> dict:
    values = user.values
    dimensions = []
    for key, label in WORKSTYLE_DIMENSIONS:
        if key not in values:
            continue
        dimensions.append(
            {
                "id": key,
                "label": label,
                "score": round(values[key], 4),
                "confidence": round(user.confidence.get(key, 0.0), 4),
            }
        )
    return {
        "label": workstyle_label(values),
        "summary": workstyle_summary(values),
        "dimensions": dimensions,
        "maturity": maturity(user),
        "disclaimer": "This is an interaction workstyle, not a personality type.",
    }


def build_operating_stack(recs: list[Recommendation]) -> list[dict]:
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
                "model": top.model_dump() if top else None,
            }
        )
    return rows


def build_workflow(values: dict[str, float]) -> list[dict]:
    steps = [
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
    return steps


def default_instructions(persona: dict) -> str:
    lines = [
        f"You are operating as {persona.get('label', 'an Adaptive Working Partner')}.",
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
