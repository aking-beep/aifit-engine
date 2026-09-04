from __future__ import annotations

from .models import UserFitVector


def _label(values: dict[str, float]) -> str:
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("comparison_preference", 0) >= 0.65:
        return "Critical Systems Partner"
    if values.get("code_comfort", 0) >= 0.7 and values.get("iteration_preference", 0) >= 0.7:
        return "Build-and-Refine Partner"
    if values.get("automation_appetite", 0) >= 0.7:
        return "Workflow Operator"
    if values.get("autonomy_preference", 0) <= 0.35:
        return "Confirm-First Collaborator"
    return "Adaptive Working Partner"


def generate_persona(user: UserFitVector) -> dict:
    v = user.values
    interaction: list[str] = []
    response: list[str] = []
    decision: list[str] = []
    tools: list[str] = []
    avoid: list[str] = []

    if v.get("evidence_seeking", 0) >= 0.65:
        interaction += [
            "Separate established facts from inference.",
            "Use sources when research or current claims are involved.",
            "Surface material uncertainty instead of hiding it.",
        ]
    if v.get("comparison_preference", 0) >= 0.65:
        decision += [
            "Compare viable alternatives before making a recommendation.",
            "Make tradeoffs explicit.",
        ]
    if v.get("iteration_preference", 0) >= 0.65:
        response += [
            "Expect progressive refinement and preserve prior constraints.",
            "Prefer a strong working version over a long generic preamble.",
        ]
    if v.get("recommendation_preference", 0) >= 0.65 or v.get("action_orientation", 0) >= 0.65:
        decision += ["Give a concrete recommended action after presenting the relevant evidence."]
    if v.get("structure_preference", 0) >= 0.65:
        response += ["Use clear structure for complex work."]
    if v.get("autonomy_preference", 0) >= 0.70:
        tools += ["Execute reasonable intermediate steps without unnecessary confirmation."]
    elif v.get("autonomy_preference", 0) <= 0.35:
        tools += ["Ask before making material multi-step changes or commitments."]
    if v.get("budget_sensitivity", 0) >= 0.65:
        decision += ["Call out meaningful cost differences and lower-cost alternatives."]
    if v.get("local_control_preference", 0) >= 0.65:
        tools += ["Prefer local or self-hosted options when capability is otherwise comparable."]
    if v.get("code_comfort", 0) >= 0.65:
        tools += ["Default to working code and inspectable diffs when the task is implementation."]
    if v.get("automation_appetite", 0) >= 0.65:
        tools += ["Propose durable workflow automation instead of one-off instructions when the work repeats."]
    if v.get("conciseness_preference", 0) >= 0.65:
        avoid += ["Long introductions", "Repeating the user's request"]
    if v.get("speed_preference", 0) >= 0.7 and v.get("depth_preference", 0) < 0.5:
        avoid += ["Unnecessary deep dives before a usable first answer"]

    if not interaction:
        interaction = ["Match the user's requested depth and stay inspectable."]
    if not response:
        response = ["Lead with the useful answer, then supporting detail."]
    if not decision:
        decision = ["State a recommendation only after the relevant options are visible."]
    if not tools:
        tools = ["Use tools when they materially improve accuracy or speed."]

    return {
        "label": _label(v),
        "purpose": "Help this user make evidence-backed decisions and execute in a way that matches observed AI interaction preferences.",
        "interaction_rules": interaction,
        "response_rules": response,
        "decision_rules": decision,
        "tool_rules": tools,
        "avoid": avoid,
        "disclaimer": "This configuration reflects observed workflow preferences, not psychological traits.",
    }
