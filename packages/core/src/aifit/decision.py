"""Five-outcome decision engine: Python mirror of ``@aifit/decision-core``.

Both implementations read ``packages/decision-core/rules/decision-rules.v1.json``
and are checked against ``packages/decision-core/fixtures/golden.json`` (written
by the TypeScript engine). If one changes without the other, both test suites
fail. Field names are camelCase on purpose: they are the shared JSON contract.

Deterministic and pure. Free text (``goal``) is hashed but never scored, so
prompt injection in it cannot move a decision.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ROOT = Path(__file__).resolve().parents[4]
RULES_PATH = ROOT / "packages/decision-core/rules/decision-rules.v1.json"
FIXTURE_DIR = ROOT / "packages/decision-core/fixtures"

WorkType = Literal[
    "classify", "extract", "summarize", "generate", "converse", "search", "decide",
    "act", "transfer", "calculate", "lookup", "record",
]
DataClass = Literal[
    "public", "internal", "pii", "sensitive_pii", "phi", "pci", "financial", "credentials", "trade_secret", "minors",
]
Regulation = Literal["hipaa", "pci", "gdpr", "ccpa", "sox", "ferpa", "glba", "eu_ai_act"]
Outcome = Literal["no_change", "conventional_software", "conventional_automation", "buy_ai", "build_ai"]

OUTCOMES: tuple[str, ...] = ("no_change", "conventional_software", "conventional_automation", "buy_ai", "build_ai")


@lru_cache(maxsize=1)
def rules() -> dict[str, Any]:
    return json.loads(RULES_PATH.read_text(encoding="utf-8"))


def _sorted_unique(values: list[str]) -> list[str]:
    return sorted(set(values))


class _Base(BaseModel):
    # Unknown keys are dropped, as zod does: an "outcome" key in the request is ignored, not obeyed.
    model_config = ConfigDict(extra="ignore", strict=True)


class OrgContext(_Base):
    size: Literal["solo", "small", "mid", "enterprise"] = "solo"
    engineers: int = Field(default=0, ge=0, le=100_000, strict=True)
    hasMlExperience: bool = False
    hasSecurityReview: bool = False

    @field_validator("engineers", mode="before")
    @classmethod
    def _whole(cls, v: Any) -> Any:
        if isinstance(v, float) and v.is_integer():
            return int(v)
        return v


class Constraints(_Base):
    dataClasses: list[DataClass] = Field(default_factory=lambda: ["internal"], max_length=10)
    regulated: list[Regulation] = Field(default_factory=list, max_length=8)
    dataResidency: Literal["any", "us", "eu", "on_prem"] = "any"
    localOnly: bool = False
    monthlyBudgetUsd: float | None = Field(default=None, ge=0, le=1e9)
    oneTimeBudgetUsd: float | None = Field(default=None, ge=0, le=1e9)
    timelineWeeks: float | None = Field(default=None, ge=0, le=520)
    integrations: list[str] = Field(default_factory=list, max_length=20)
    autonomy: Literal["suggest", "approve", "bounded", "full"] = "suggest"
    irreversibleActions: bool = False
    offTheShelfAcceptable: bool = True

    @field_validator("dataClasses", "regulated")
    @classmethod
    def _canon(cls, v: list[str]) -> list[str]:
        return _sorted_unique(v)

    @field_validator("integrations")
    @classmethod
    def _integrations(cls, v: list[str]) -> list[str]:
        cleaned = []
        for item in v:
            s = item.strip()
            if not 1 <= len(s) <= 80:
                raise ValueError("each integration must be 1-80 characters")
            cleaned.append(s.lower())
        return _sorted_unique(cleaned)


class RunCost(_Base):
    low: float = Field(ge=0)
    high: float = Field(ge=0)
    basis: Literal["heuristic", "benchmark", "calibrated", "measured"]
    source: str = Field(max_length=300)


class ExternalEstimates(_Base):
    runCostPerMonthUsd: RunCost | None = None


class DecisionIntake(_Base):
    schemaVersion: Literal["1"] = "1"
    surface: Literal["consumer", "teams"] = "consumer"
    goal: str = Field(default="", max_length=2000)
    workTypes: list[WorkType] = Field(min_length=1, max_length=12)
    frequencyPerMonth: float | None = Field(default=None, ge=0, le=1e9)
    minutesPerOccurrence: float | None = Field(default=None, ge=0, le=1e9)
    currentApproach: Literal["none", "manual", "spreadsheet", "existing_software", "existing_ai"] = "manual"
    currentWorksWell: bool = False
    correctness: Literal["exact", "tolerant", "subjective"] = "tolerant"
    errorImpact: Literal["low", "medium", "high", "critical"] = "medium"
    role: Literal[
        "individual", "student", "creator", "freelancer", "small_business_owner", "engineer", "manager", "executive", "other"
    ] = "individual"
    technicalAbility: Literal["none", "basic", "intermediate", "advanced"] = "basic"
    org: OrgContext = Field(default_factory=OrgContext)
    constraints: Constraints = Field(default_factory=Constraints)
    hourlyValueUsd: float | None = Field(default=None, ge=0, le=1e9)
    externalEstimates: ExternalEstimates = Field(default_factory=ExternalEstimates)

    @field_validator("workTypes")
    @classmethod
    def _canon(cls, v: list[str]) -> list[str]:
        return _sorted_unique(v)


# --- Canonical JSON (must match canonical.ts byte for byte) -----------------


def canonical_number(n: float | int) -> str:
    if isinstance(n, bool):
        raise TypeError("bool is not a number here")
    if isinstance(n, float) and not math.isfinite(n):
        raise TypeError("Non-finite numbers have no canonical form.")
    if isinstance(n, int) or float(n).is_integer():
        return str(int(n))
    rounded = math.floor(n * 1e6 + 0.5) / 1e6
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.6f}".rstrip("0").rstrip(".")


def canonical_json(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return canonical_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(v) for v in value) + "]"
    if isinstance(value, dict):
        items = sorted(value.items())
        return "{" + ",".join(f"{json.dumps(k, ensure_ascii=False)}:{canonical_json(v)}" for k, v in items) + "}"
    raise TypeError(f"Cannot canonicalise {type(value).__name__}")


def input_hash(intake: DecisionIntake) -> str:
    return hashlib.sha256(canonical_json(intake.model_dump()).encode("utf-8")).hexdigest()


# --- Helpers -----------------------------------------------------------------


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def round1(x: float) -> float:
    return round_half_up(x * 10) / 10


def fmt(x: float | int) -> str:
    """Format a number the way JavaScript's String(n) does for these magnitudes."""
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


def _band(score: float, table: list[dict[str, Any]], key: str) -> str:
    for row in table:
        if score >= row["atLeast"]:
            return row[key]
    return table[-1][key]


def _step(value: float, table: list[dict[str, Any]]) -> int:
    for row in table:
        if value >= row["atLeast"]:
            return row["score"]
    return table[-1]["score"]


def _shares(work_types: list[str]) -> dict[str, int]:
    wt = rules()["workTypes"]
    return {
        "total": len(work_types),
        "det": sum(1 for w in work_types if w in wt["deterministic"]),
        "flow": sum(1 for w in work_types if w in wt["flow"]),
        "ai": sum(1 for w in work_types if w in wt["ai"]),
    }


def hours_per_month(i: DecisionIntake) -> float | None:
    if i.frequencyPerMonth is None or i.minutesPerOccurrence is None:
        return None
    return (i.frequencyPerMonth * i.minutesPerOccurrence) / 60


# --- Entry point -----------------------------------------------------------------


def decide(payload: dict[str, Any] | DecisionIntake) -> dict[str, Any]:
    intake = payload if isinstance(payload, DecisionIntake) else DecisionIntake.model_validate(payload)
    return decide_parsed(intake)


def decide_parsed(i: DecisionIntake) -> dict[str, Any]:
    R = rules()
    s = _shares(i.workTypes)
    hours = hours_per_month(i)
    sensitive = [d for d in i.constraints.dataClasses if d in R["sensitiveDataClasses"]]
    highly_regulated = any(d in R["highlyRegulatedDataClasses"] for d in i.constraints.dataClasses)
    local_only = i.constraints.localOnly or i.constraints.dataResidency == "on_prem"

    hcs = evaluate_hard_constraints(i, s, local_only, highly_regulated)
    excluded: dict[str, list[str]] = {}
    for hc in hcs:
        if not hc["triggered"]:
            continue
        for o in hc["excludes"]:
            excluded.setdefault(o, []).append(hc["id"])

    scores = []
    for o in _score_outcomes(i, s, hours, bool(sensitive), local_only):
        o["eligible"] = o["outcome"] not in excluded
        o["excludedBy"] = excluded.get(o["outcome"], [])
        scores.append(o)

    order = R["outcomes"]["order"]
    ranked = sorted((o for o in scores if o["eligible"]), key=lambda o: (-o["score"], order.index(o["outcome"])))
    winner = ranked[0]
    runner = ranked[1] if len(ranked) > 1 else None

    contradictions = find_contradictions(i, s)
    T = R["thresholds"]
    margin = winner["score"] - runner["score"] if runner else 100
    if contradictions:
        confidence = "low"
    elif margin >= T["confidenceHighMargin"] and hours is not None:
        confidence = "high"
    elif margin >= T["confidenceMediumMargin"]:
        confidence = "medium"
    else:
        confidence = "low"

    outcome = winner["outcome"]
    is_ai = outcome in ("buy_ai", "build_ai")
    return {
        "engine": {
            "name": "aifit-decision",
            "version": R["engineVersion"],
            "rulesVersion": R["rulesVersion"],
            "inputHash": input_hash(i),
        },
        "surface": i.surface,
        "outcome": outcome,
        "runnerUp": runner["outcome"] if runner else None,
        "confidence": confidence,
        "summary": SUMMARY[outcome],
        "aiSuitability": _ai_suitability(i, s, hours, len(sensitive)),
        "outcomeScores": scores,
        "hardConstraints": hcs,
        "requiredControls": _required_controls(hcs, is_ai),
        "toolRequirements": {
            "categories": tool_categories(i.workTypes, local_only) if outcome == "buy_ai" else [],
            "localOnly": local_only,
            "freeTierOnly": i.constraints.monthlyBudgetUsd == 0,
        },
        "costs": _costs(i, outcome, hours),
        "risk": _risk(i, len(sensitive), highly_regulated),
        "feasibility": _feasibility(i, outcome, bool(sensitive)),
        "missingInputs": _missing(i),
        "contradictions": contradictions,
        "whatWouldChange": _what_would_change(runner["outcome"] if runner else None, scores),
        "assumptions": list(ASSUMPTIONS),
        "limitations": list(LIMITATIONS),
        "validation": {
            "status": "not_validated",
            "note": (
                "No validation step has run against real outcomes for this recommendation. It is a structured "
                "argument from your inputs and the published rules, not a measured prediction."
            ),
        },
    }


# --- Hard constraints ---------------------------------------------------------


def _hc(hc_id: str, triggered: bool, effect: str, excludes: list[str], detail: str) -> dict[str, Any]:
    return {
        "id": hc_id,
        "triggered": triggered,
        "effect": effect,
        "excludes": excludes,
        "detail": detail,
        "authority": "deterministic-rule",
    }


def evaluate_hard_constraints(
    i: DecisionIntake, s: dict[str, int], local_only: bool, highly_regulated: bool
) -> list[dict[str, Any]]:
    c = i.constraints
    regulated = bool(c.regulated) or highly_regulated
    return [
        _hc("HC_DETERMINISTIC_ONLY", s["ai"] == 0, "exclude_outcomes", ["buy_ai", "build_ai"],
            "None of the work is language or judgement. Every step has a computable answer or is moving data, "
            "so a model adds cost and variance for no gain."),
        _hc("HC_CREDENTIALS_IN_DATA", "credentials" in c.dataClasses, "exclude_outcomes", ["buy_ai"],
            "Credentials (keys, passwords, tokens) are in the data. They must never be pasted into a third-party "
            "AI tool; any AI path must redact or vault them before a prompt is built."),
        _hc("HC_HOSTED_TOOLS_REFUSED", not c.offTheShelfAcceptable, "exclude_outcomes", ["buy_ai"],
            "You said a third-party hosted tool is not acceptable for this work."),
        _hc("HC_NO_BUILD_CAPACITY", i.org.engineers == 0 and i.technicalAbility in ("none", "basic"),
            "exclude_outcomes", ["build_ai"],
            "Nobody available can build or maintain custom software, so building an AI system is not a realistic option."),
        _hc("HC_ZERO_BUDGET", c.monthlyBudgetUsd == 0 and not local_only, "exclude_outcomes", ["build_ai"],
            "A monthly budget of zero rules out paying for model API calls, which a hosted build needs."),
        _hc("HC_LOCAL_ONLY", local_only, "restrict_tools", [],
            "Data must stay on your own machines. Only tools the registry lists as local or self-hosted are eligible."),
        _hc("HC_FREE_TIER_ONLY", c.monthlyBudgetUsd == 0, "restrict_tools", [],
            "With no monthly budget, only tools the registry lists with a free tier are eligible. Free tiers have "
            "limits; check them."),
        _hc("HC_REGULATED_DATA", regulated, "require_control", [],
            "Regulated or highly sensitive data is in scope. Before any vendor sees it you need a signed agreement "
            "that covers it (for example a BAA or DPA) on the plan you use. AI Fit does not verify any vendor's "
            "certifications or agreements."),
        _hc("HC_IRREVERSIBLE_AUTONOMY", c.irreversibleActions and c.autonomy in ("bounded", "full"),
            "require_control", [],
            "Irreversible actions with autonomy. A person must approve each irreversible action before it runs."),
        _hc("HC_CRITICAL_EXACT", i.errorImpact == "critical" and i.correctness == "exact" and s["ai"] > 0,
            "require_control", [],
            "A wrong answer is critical and there is one exact answer. Any model output needs a deterministic check "
            "before it is used."),
    ]


def _required_controls(hcs: list[dict[str, Any]], is_ai: bool) -> list[str]:
    on = {h["id"] for h in hcs if h["triggered"]}
    out: list[str] = []
    if "HC_CREDENTIALS_IN_DATA" in on:
        out.append("Redact or vault credentials before any text reaches a model.")
    if "HC_REGULATED_DATA" in on:
        out.append("Confirm in writing that your vendor agreement covers this data class, on the plan you use.")
    if "HC_IRREVERSIBLE_AUTONOMY" in on:
        out.append("Human approval gate on every irreversible action.")
    if "HC_CRITICAL_EXACT" in on:
        out.append("Deterministic verification of every model output before it is used.")
    if is_ai:
        out.append("Keep a person reviewing outputs until you have measured the error rate on real examples.")
        out.append("Do not paste data into a tool whose data-retention terms you have not read.")
    return out


# --- Outcome scores -------------------------------------------------------------


def _share_points(points: int, count: int, total: int) -> int:
    return round_half_up((points * 10 * count) / total)


def _score_outcomes(
    i: DecisionIntake, s: dict[str, int], hours: float | None, sensitive: bool, local_only: bool
) -> list[dict[str, Any]]:
    R = rules()
    oc = R["outcomes"]
    T = R["thresholds"]
    c = i.constraints
    exact = i.correctness == "exact"
    freq = i.frequencyPerMonth
    low_tech = i.technicalAbility in ("none", "basic")
    short = c.timelineWeeks is not None and c.timelineWeeks <= T["shortTimelineWeeks"]
    n_int = len(c.integrations)

    def tenths(p: int) -> int:
        return p * 10

    def build(outcome: str, parts: list[tuple[str, int, bool]]) -> dict[str, Any]:
        on = [(f, t) for f, t, cond in parts if cond]
        total = sum(t for _, t in on)
        return {
            "outcome": outcome,
            "score": max(0, min(1000, total)) / 10,
            "contributions": [{"factor": f, "points": t / 10} for f, t in on],
        }

    nc, cs, ca, ba, bd = (oc[k] for k in OUTCOMES)
    return [
        build("no_change", [
            ("base", tenths(nc["base"]), True),
            ("negligible time involved", tenths(nc["negligibleHours"]),
             hours is not None and hours < T["negligibleHoursPerMonth"]),
            ("little time involved", tenths(nc["smallHours"]),
             hours is not None and T["negligibleHoursPerMonth"] <= hours < T["smallHoursPerMonth"]),
            ("today's approach works", tenths(nc["currentWorksWell"]), i.currentWorksWell),
            ("a lot of time involved", tenths(nc["largeHoursPenalty"]),
             hours is not None and hours >= T["largeHoursPerMonth"]),
        ]),
        build("conventional_software", [
            ("base", tenths(cs["base"]), True),
            ("share of computable work", _share_points(cs["deterministicShare"], s["det"], s["total"]), s["det"] > 0),
            ("one exact answer", tenths(cs["exactCorrectness"]), exact),
            ("done by hand or in a spreadsheet today", tenths(cs["manualToday"]),
             s["det"] > 0 and i.currentApproach in ("manual", "spreadsheet", "none")),
        ]),
        build("conventional_automation", [
            ("base", tenths(ca["base"]), True),
            ("share of data-moving or action work", _share_points(ca["flowShare"], s["flow"], s["total"]), s["flow"] > 0),
            ("share of computable work", _share_points(ca["deterministicShare"], s["det"], s["total"]), s["det"] > 0),
            ("repeats often", tenths(ca["repetitive"]), freq is not None and freq >= T["repetitiveFrequencyPerMonth"]),
            ("one exact answer", tenths(ca["exactCorrectness"]), exact),
            ("systems to connect", tenths(ca["hasIntegrations"]), n_int > 0),
        ]),
        build("buy_ai", [
            ("base", tenths(ba["base"]), True),
            ("share of language or judgement work", _share_points(ba["aiShare"], s["ai"], s["total"]), s["ai"] > 0),
            ("a range of answers is acceptable", tenths(ba["tolerantCorrectness"]), not exact),
            ("one exact answer", tenths(ba["exactCorrectnessPenalty"]), exact),
            ("little technical experience", tenths(ba["lowTechnicalAbility"]), low_tech),
            ("no engineers", tenths(ba["noEngineers"]), i.org.engineers == 0),
            ("short timeline", tenths(ba["shortTimeline"]), short),
            ("modest volume", tenths(ba["modestVolume"]), freq is not None and freq < T["buyVolumeCeilingPerMonth"]),
            ("many systems to connect", tenths(ba["manyIntegrationsPenalty"]), n_int > T["manyIntegrations"]),
            ("sensitive data", tenths(ba["sensitiveDataPenalty"]), sensitive),
        ]),
        build("build_ai", [
            ("base", tenths(bd["base"]), True),
            ("share of language or judgement work", _share_points(bd["aiShare"], s["ai"], s["total"]), s["ai"] > 0),
            ("an engineering team", tenths(bd["engineeringTeam"]), i.org.engineers >= 2),
            ("machine-learning experience", tenths(bd["mlExperience"]), i.org.hasMlExperience),
            ("high volume", tenths(bd["strongVolume"]), freq is not None and freq >= T["buildVolumeStrongPerMonth"]),
            ("some volume", tenths(bd["someVolume"]),
             freq is not None and T["buildVolumeFloorPerMonth"] <= freq < T["buildVolumeStrongPerMonth"]),
            ("several systems to connect", tenths(bd["manyIntegrations"]), n_int >= T["manyIntegrations"]),
            ("data must stay local", tenths(bd["localOrOnPrem"]), local_only),
            ("short timeline", tenths(bd["shortTimelinePenalty"]),
             c.timelineWeeks is not None and c.timelineWeeks < T["shortTimelineWeeks"]),
            ("no technical experience", tenths(bd["noTechnicalAbilityPenalty"]), i.technicalAbility == "none"),
            ("one exact answer", tenths(bd["exactCorrectnessPenalty"]), exact),
        ]),
    ]


# --- AI suitability ---------------------------------------------------------------


def _ai_suitability(i: DecisionIntake, s: dict[str, int], hours: float | None, n_sensitive: int) -> dict[str, Any]:
    S = rules()["suitability"]
    w = S["weights"]
    sc = S["scores"]
    unknown = sc["unknown"]
    freq = i.frequencyPerMonth
    mins = i.minutesPerOccurrence
    if s["ai"] == 0:
        task_reason = "None of the work is language or judgement."
    elif s["ai"] == s["total"]:
        task_reason = "All of the work is language or judgement, the shape models handle well."
    else:
        task_reason = (
            f"{s['ai']} of {s['total']} kinds of work need language or judgement; the rest has a computable answer."
        )
    if mins is None:
        value_reason = "Minutes each time were not given."
    elif hours is None:
        value_reason = f"{fmt(mins)} minutes each time."
    else:
        value_reason = f"{fmt(mins)} minutes each time, about {fmt(round1(hours))} hours a month."
    dims = [
        {"key": "taskFit", "weight": w["taskFit"], "known": True,
         "score": round_half_up((100 * s["ai"]) / s["total"]), "reasoning": task_reason},
        {"key": "correctness", "weight": w["correctness"], "known": True,
         "score": sc["correctness"][i.correctness],
         "reasoning": "One exact answer: models do not promise that." if i.correctness == "exact"
         else "A range of answers is acceptable."},
        {"key": "errorImpact", "weight": w["errorImpact"], "known": True,
         "score": sc["errorImpact"][i.errorImpact], "reasoning": f"A wrong answer has {i.errorImpact} impact."},
        {"key": "data", "weight": w["data"], "known": True,
         "score": max(0, sc["dataBase"] - sc["dataPerSensitiveClass"] * n_sensitive),
         "reasoning": "No sensitive data classes." if n_sensitive == 0
         else f"{n_sensitive} sensitive data class{'' if n_sensitive == 1 else 'es'} in scope."},
        {"key": "volume", "weight": w["volume"], "known": freq is not None,
         "score": unknown if freq is None else _step(freq, sc["volume"]),
         "reasoning": "How often this happens was not given." if freq is None else f"{fmt(freq)} times a month."},
        {"key": "value", "weight": w["value"], "known": mins is not None,
         "score": unknown if mins is None else _step(mins, sc["value"]), "reasoning": value_reason},
    ]
    weighted = sum(d["score"] * round_half_up(d["weight"] * 100) for d in dims)
    score = math.floor((weighted + 50) / 100)
    return {"score": score, "band": _band(score, S["bands"], "band"), "dimensions": dims}


# --- Costs, risk, feasibility -------------------------------------------------------


def _line(line_id: str, label: str, low: Any, high: Any, unit: str, period: str, basis: str, source: str) -> dict:
    return {"id": line_id, "label": label, "low": low, "high": high, "unit": unit, "period": period,
            "basis": basis, "source": source}


def _costs(i: DecisionIntake, outcome: str, hours: float | None) -> dict[str, Any]:
    R = rules()
    effort = R["effortHours"][i.surface][outcome]
    rate = i.hourlyValueUsd
    src = f"{R['rulesVersion']} effort ranges (rule of thumb, not a quote)"
    lines: list[dict[str, Any]] = []
    if hours is not None:
        lines.append(_line("time_today", "Time spent today", round1(hours), round1(hours), "hours", "month",
                           "user_input", "Your frequency × minutes per occurrence"))
        if rate is not None:
            lines.append(_line("time_today_value", "Value of that time", round1(hours * rate), round1(hours * rate),
                               "usd", "month", "user_input", "Your hours × your hourly value"))
    lines.append(_line("setup_effort", "Setup effort", effort["setup"][0], effort["setup"][1], "hours", "one_time",
                       "heuristic", src))
    lines.append(_line("upkeep_effort", "Upkeep effort", effort["monthly"][0], effort["monthly"][1], "hours",
                       "month", "heuristic", src))
    if rate is not None:
        lines.append(_line("setup_cost", "Setup effort at your hourly value", round1(effort["setup"][0] * rate),
                           round1(effort["setup"][1] * rate), "usd", "one_time", "heuristic",
                           f"{src} × your hourly value"))
    if outcome == "buy_ai":
        lines.append(_line("subscription", "Tool subscription", None, None, "usd", "month", "heuristic",
                           "Not recorded in the AI Fit registry. Check each vendor's current pricing page; free tiers "
                           "have usage limits."))
    if outcome == "conventional_software":
        lines.append(_line("license", "Software licence", None, None, "usd", "month", "heuristic",
                           "Depends on the product you choose; not estimated here."))
    if outcome == "build_ai":
        run = i.externalEstimates.runCostPerMonthUsd
        if run:
            lines.append(_line("run_cost", "Model run cost", run.low, run.high, "usd", "month",
                               "catalog" if run.basis == "heuristic" else run.basis, run.source))
        else:
            lines.append(_line("run_cost", "Model run cost", None, None, "usd", "month", "heuristic",
                               "Not estimated: depends on the model and volume. AI Fit Teams prices this from its "
                               "dated model catalog."))
    return {
        "lines": lines,
        "hoursSavedPerMonth": None if hours is None else round1(hours),
        "uncertainty": "high" if hours is None else "medium",
    }


def _risk(i: DecisionIntake, n_sensitive: int, highly_regulated: bool) -> dict[str, Any]:
    R = rules()["risk"]
    c = i.constraints
    factors: list[str] = []
    score = 0
    if n_sensitive > 0:
        score += R["perSensitiveClass"] * n_sensitive
        factors.append(f"{n_sensitive} sensitive data class{'' if n_sensitive == 1 else 'es'}")
    if highly_regulated:
        score += R["highlyRegulated"]
        factors.append("highly regulated data (health, card, government ID or minors)")
    if c.regulated:
        score += R["regulation"] * len(c.regulated)
        factors.append(f"regulations in scope: {', '.join(c.regulated)}")
    score += R["errorImpact"][i.errorImpact]
    if R["errorImpact"][i.errorImpact] > 0:
        factors.append(f"{i.errorImpact} impact when wrong")
    score += R["autonomy"][c.autonomy]
    if R["autonomy"][c.autonomy] > 0:
        factors.append(f"autonomy: {c.autonomy}")
    if c.irreversibleActions:
        score += R["irreversibleActions"]
        factors.append("irreversible actions")
    score = min(100, score)
    return {"level": _band(score, R["levels"], "level"), "score": score, "factors": factors}


def _feasibility(i: DecisionIntake, outcome: str, sensitive: bool) -> dict[str, Any]:
    R = rules()
    T = R["thresholds"]
    effort = R["effortHours"][i.surface][outcome]
    factors: list[tuple[str, str]] = []
    weeks = i.constraints.timelineWeeks
    if weeks is not None and effort["setup"][1] > 0:
        per_week = T["builderHoursPerWeek"] * max(1, i.org.engineers) if i.surface == "teams" else T["consumerHoursPerWeek"]
        capacity = per_week * weeks
        if effort["setup"][0] > capacity:
            factors.append(("low", f"Even the low end of the setup effort ({fmt(effort['setup'][0])} h) exceeds the time "
                                   f"available in {fmt(weeks)} weeks (about {fmt(capacity)} h)."))
        elif effort["setup"][1] > capacity:
            factors.append(("medium", f"The high end of the setup effort ({fmt(effort['setup'][1])} h) exceeds the time "
                                      f"available in {fmt(weeks)} weeks (about {fmt(capacity)} h)."))
    once = i.constraints.oneTimeBudgetUsd
    if once is not None and i.hourlyValueUsd is not None and effort["setup"][0] * i.hourlyValueUsd > once:
        factors.append(("low", "The low end of the setup effort, at your hourly value, is more than your one-time budget."))
    if outcome == "build_ai" and not i.org.hasMlExperience:
        factors.append(("medium", "Nobody on the team has shipped a model-backed system before; budget time for "
                                  "evaluation work."))
    if i.surface == "teams" and sensitive and not i.org.hasSecurityReview and outcome != "no_change":
        factors.append(("medium", "Sensitive data is in scope and there is no security review process."))
    levels = {lvl for lvl, _ in factors}
    level = "low" if "low" in levels else "medium" if "medium" in levels else "high"
    return {"level": level, "factors": [t for _, t in factors]}


# --- Inputs, contradictions, explanation ----------------------------------------------


def _missing(i: DecisionIntake) -> list[str]:
    out: list[str] = []
    if i.frequencyPerMonth is None:
        out.append("frequencyPerMonth")
    if i.minutesPerOccurrence is None:
        out.append("minutesPerOccurrence")
    if i.surface == "teams":
        if i.constraints.monthlyBudgetUsd is None:
            out.append("monthlyBudgetUsd")
        if i.constraints.timelineWeeks is None:
            out.append("timelineWeeks")
    if i.hourlyValueUsd is None:
        out.append("hourlyValueUsd")
    return out


def find_contradictions(i: DecisionIntake, s: dict[str, int]) -> list[dict[str, str]]:
    c = i.constraints
    out: list[dict[str, str]] = []
    if i.frequencyPerMonth == 0:
        out.append({"id": "zero_frequency",
                    "detail": "You said this happens zero times a month. If it never happens, there is nothing to change."})
    if i.correctness == "exact" and s["ai"] == s["total"] and any(w in ("generate", "converse") for w in i.workTypes):
        out.append({"id": "exact_generative",
                    "detail": "The work is open-ended writing or conversation, but you said there is one exact right "
                              "answer. Those rarely go together; check which is true."})
    if i.errorImpact == "critical" and c.autonomy == "full":
        out.append({"id": "critical_full_autonomy",
                    "detail": "A wrong answer is critical, yet you asked for full autonomy. Pick one: accept a review "
                              "step, or accept the risk."})
    if i.org.size == "solo" and i.org.engineers > 1:
        out.append({"id": "solo_with_engineers", "detail": "You described a one-person setup with more than one engineer."})
    if c.irreversibleActions and not any(w in ("act", "transfer") for w in i.workTypes):
        out.append({"id": "irreversible_without_action",
                    "detail": "You flagged irreversible actions, but none of the work you selected takes an action or "
                              "moves data."})
    return out


OUTCOME_LABEL = {
    "no_change": "No change",
    "conventional_software": "Conventional software",
    "conventional_automation": "Conventional automation",
    "buy_ai": "Buy an AI tool",
    "build_ai": "Build an AI system",
}

LEVERS = {
    "no_change": "If the time involved were under 30 minutes a month, or today's approach already works, leaving it "
                 "alone would win.",
    "conventional_software": "If the work had one computable right answer (records, lookups, arithmetic), ordinary "
                             "software would win.",
    "conventional_automation": "If the work were mostly moving data between systems on a schedule, rules-based "
                               "automation would win.",
    "buy_ai": "A tolerant definition of correct, a short timeline, or no engineering capacity favours buying an AI tool.",
    "build_ai": "Higher volume (1,000+ a month), two or more engineers, or several systems to connect favour building.",
}

SUMMARY = {
    "no_change": "Leave this as it is. The time involved, or how well today's approach works, does not justify a change.",
    "conventional_software": "Use ordinary software. The work has computable answers, so a database, spreadsheet or "
                             "app does it correctly every time.",
    "conventional_automation": "Automate it with rules. The work is repetitive and mostly moves data or triggers "
                               "actions, which rules handle reliably and cheaply.",
    "buy_ai": "Buy an AI tool. The work needs language or judgement, and an off-the-shelf tool is the fastest, "
              "cheapest way to find out if AI helps.",
    "build_ai": "Build an AI system. The volume, integrations or constraints justify custom engineering, provided you "
                "measure it from day one.",
}

ASSUMPTIONS = (
    "Effort ranges are rules of thumb from the published decision rules, not quotes.",
    "Hours saved assume the change removes the whole task; real savings are usually lower.",
    "Tool eligibility uses the AI Fit registry as last reviewed; vendors change plans and features.",
    "Scores combine your structured answers only. Free-text descriptions are shown back to you but never scored.",
)

LIMITATIONS = (
    "Does not verify any vendor's security, privacy or compliance claims.",
    "Does not know your existing contracts, tools or procurement rules.",
    "Scores are normalised comparisons between the five options, not probabilities of success.",
    "Not validated against measured outcomes yet.",
)


def _what_would_change(runner: str | None, scores: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    if runner:
        out.append(f"Runner-up: {OUTCOME_LABEL[runner]}. {LEVERS[runner]}")
    for o in scores:
        if not o["eligible"]:
            out.append(f"{OUTCOME_LABEL[o['outcome']]} was ruled out by {', '.join(o['excludedBy'])}.")
    return out


def tool_categories(work_types: list[str], local_only: bool) -> list[str]:
    R = rules()
    cats: set[str] = set()
    for w in work_types:
        cats.update(R["toolCategories"].get(w, []))
    if local_only:
        cats.update(R["localCategories"])
    return sorted(cats)


# --- Tool matching (mirror of tools.ts) --------------------------------------------

FRESHNESS_DAYS = 90


def match_tools(
    result: dict[str, Any],
    products: list[dict[str, Any]],
    *,
    technical_level: float = 0.4,
    as_of: date | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    R = rules()
    req = result["toolRequirements"]
    regulated = any(h["id"] == "HC_REGULATED_DATA" and h["triggered"] for h in result["hardConstraints"])
    if result["outcome"] != "buy_ai":
        return {"matches": [], "excluded": [],
                "note": "No tool is recommended because the decision is not to buy an AI tool."}
    categories = set(req["categories"])
    matches: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    for p in products:
        if p["category"] not in categories:
            continue
        checks = [{"rule": "active", "passed": p["status"] == "active", "detail": f'Registry status is "{p["status"]}".'}]
        if req["localOnly"]:
            ok = any(d in R["localDeployments"] for d in p["deployment"])
            checks.append({"rule": "local_or_self_hosted", "passed": ok, "detail": f"Deployment: {', '.join(p['deployment'])}."})
        if req["freeTierOnly"]:
            ok = p["pricing_tier"] in R["freePricingTiers"]
            checks.append({"rule": "free_tier", "passed": ok, "detail": f"Pricing tier in the registry: {p['pricing_tier']}."})
        failed = [c for c in checks if not c["passed"]]
        if failed:
            excluded.append({"id": p["id"], "name": p["name"], "reasons": [c["detail"] for c in failed]})
            continue
        age = (as_of - date.fromisoformat(p["last_evaluated_at"])).days if as_of else None
        why = [f'Category "{p["category"]}" matches the kind of work you described.']
        if req["localOnly"]:
            why.append("Runs locally or self-hosted, so your data can stay on your machines.")
        if regulated:
            why.append("Regulated data: confirm this vendor offers an agreement covering it on your plan. "
                       "AI Fit has not verified that.")
        tier = p["pricing_tier"]
        note = (
            "Listed as free in the registry." if tier == "free"
            else "Free and paid plans exist per the registry; check the vendor page for current prices and limits."
            if tier == "mixed" else "Price not recorded in the registry; check the vendor page."
        )
        matches.append({
            "id": p["id"], "name": p["name"], "provider": p["provider"], "category": p["category"],
            "homepage": p["homepage"], "why": why, "checks": checks,
            "pricing": {"tier": tier, "amount": None, "note": note},
            "evidence": p.get("evidence", []), "lastEvaluatedAt": p["last_evaluated_at"],
            "ageDays": age, "stale": age is not None and age > FRESHNESS_DAYS,
            "_tech": p.get("technical_level", 0.5),
        })
    matches.sort(key=lambda m: (abs(m["_tech"] - technical_level), m["name"].lower()))
    for m in matches:
        m.pop("_tech")
    return {
        "matches": matches[:limit],
        "excluded": excluded,
        "note": "Ranked by how closely each tool's technical level matches yours. Eligibility is rule-based; no vendor "
                "paid for placement.",
    }


def golden_projection(r: dict[str, Any]) -> dict[str, Any]:
    """Same projection as golden.ts, for the parity test."""
    return {
        "inputHash": r["engine"]["inputHash"],
        "rulesVersion": r["engine"]["rulesVersion"],
        "outcome": r["outcome"],
        "runnerUp": r["runnerUp"],
        "confidence": r["confidence"],
        "suitability": r["aiSuitability"]["score"],
        "suitabilityBand": r["aiSuitability"]["band"],
        "outcomeScores": [
            {"outcome": o["outcome"], "score": o["score"], "eligible": o["eligible"], "excludedBy": o["excludedBy"]}
            for o in r["outcomeScores"]
        ],
        "triggered": [h["id"] for h in r["hardConstraints"] if h["triggered"]],
        "risk": {"level": r["risk"]["level"], "score": r["risk"]["score"]},
        "feasibility": r["feasibility"]["level"],
        "missingInputs": r["missingInputs"],
        "contradictions": [c["id"] for c in r["contradictions"]],
        "toolCategories": r["toolRequirements"]["categories"],
        "costLines": [
            {"id": ln["id"], "low": ln["low"], "high": ln["high"], "unit": ln["unit"], "period": ln["period"],
             "basis": ln["basis"]}
            for ln in r["costs"]["lines"]
        ],
        "hoursSavedPerMonth": r["costs"]["hoursSavedPerMonth"],
    }
