from __future__ import annotations

from .models import UserFitVector


def persona_label(values: dict[str, float]) -> str:
    """How the assistant should behave — distinct from the user's workstyle label."""
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("code_comfort", 0) >= 0.6:
        return "Critical Technical Partner"
    if values.get("evidence_seeking", 0) >= 0.7 and values.get("comparison_preference", 0) >= 0.65:
        return "Critical Systems Partner"
    if values.get("autonomy_preference", 0) >= 0.7 and (
        values.get("automation_appetite", 0) >= 0.55 or values.get("integration_appetite", 0) >= 0.55
    ):
        return "Autonomous Operator"
    if values.get("autonomy_preference", 0) <= 0.35:
        return "Confirm-First Analyst"
    if values.get("conciseness_preference", 0) >= 0.65:
        return "Concise Working Partner"
    if values.get("multimodal_preference", 0) >= 0.7:
        return "Creative Production Partner"
    if values.get("structure_preference", 0) >= 0.65 and values.get("evidence_seeking", 0) >= 0.55:
        return "Structured Research Partner"
    return "Adaptive Working Partner"


def persona_purpose(values: dict[str, float]) -> str:
    if values.get("evidence_seeking", 0) >= 0.65 and values.get("code_comfort", 0) >= 0.6:
        return "Act as a critical technical partner: evidence first, architectures when useful, and working artifacts over commentary."
    if values.get("evidence_seeking", 0) >= 0.65:
        return "Help this user make evidence-backed decisions, surface uncertainty, and execute without hiding assumptions."
    if values.get("autonomy_preference", 0) >= 0.7:
        return "Move work forward: take reasonable intermediate steps, then show what changed."
    if values.get("autonomy_preference", 0) <= 0.35:
        return "Stay inspectable. Ask before material multi-step changes, and keep recommendations reversible."
    return "Help this user make evidence-backed decisions and execute in a way that matches observed AI interaction preferences."


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
    if v.get("integration_appetite", 0) >= 0.65:
        tools += ["Prefer tools that connect to the user's existing stack instead of isolated one-offs."]
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

    traits: list[str] = []
    if v.get("evidence_seeking", 0) >= 0.65:
        traits += ["evidence-first", "distinguishes fact from inference", "surfaces risks"]
    if v.get("assumption_challenge", 0) >= 0.55:
        traits += ["challenges assumptions"]
    if v.get("conciseness_preference", 0) >= 0.6 or (v.get("speed_preference", 0) >= 0.65 and v.get("depth_preference", 0) < 0.5):
        traits += ["concise", "doesn't over-explain"]
    if v.get("structure_preference", 0) >= 0.6:
        traits += ["uses structured outputs"]
    if v.get("code_comfort", 0) >= 0.65:
        traits += ["proposes architectures"]
    if v.get("autonomy_preference", 0) <= 0.35:
        traits += ["asks for clarification only when necessary"]
    elif v.get("autonomy_preference", 0) >= 0.7:
        traits += ["executes intermediate steps without extra confirmation"]
    if not traits:
        traits = ["inspectable", "matches requested depth"]

    return {
        "label": persona_label(v),
        "purpose": persona_purpose(v),
        "traits": list(dict.fromkeys(traits)),
        "interaction_rules": interaction,
        "response_rules": response,
        "decision_rules": decision,
        "tool_rules": tools,
        "avoid": avoid,
        "disclaimer": "This configuration reflects observed workflow preferences, not psychological traits.",
    }
