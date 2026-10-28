"""Suggest-only agents: Python mirror of ``@aifit/agents`` for the Consumer API.

Same prompts (``packages/agents/prompts``), same deterministic checks, pinned
to the TypeScript package by ``packages/agents/fixtures/intake-checks.json``.

An agent may only suggest or explain. Every reply is parsed against a schema
and then checked by plain code: an intake suggestion survives only if its
evidence quote appears in the person's own text, and an explanation is
discarded if it names an outcome the rules did not choose. Nothing here
writes to a form, a decision, or a hard constraint. Traces carry a hash of
the input, never the input.

Off unless ``AIFIT_AGENTS=1`` and ``ANTHROPIC_API_KEY`` are set.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from collections import deque
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from aifit.decision import OUTCOME_LABEL, OUTCOMES

ROOT = Path(__file__).resolve().parents[4]
PROMPT_DIR = ROOT / "packages/agents/prompts"
FIXTURE_DIR = ROOT / "packages/agents/fixtures"
DEFAULT_AGENT_MODEL = "claude-opus-5-5"

log = logging.getLogger("aifit.agents")

Effort = Literal["low", "medium", "high", "xhigh", "max"]
RunStatus = Literal["ok", "disabled", "invalid_input", "refused", "rejected", "error", "timeout", "rate_limited"]


# Text checks (mirror of packages/agents/src/text.ts) ------------------------

_SINGLE = re.compile("[‘’‚′]")
_DOUBLE = re.compile("[“”„″]")
_DASH = re.compile("[–—]")
_EDGES = re.compile(r"^[\"'\s]+|[\"'\s]+$")
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?|\.\d+")


def normalize_text(s: str) -> str:
    s = _DASH.sub("-", _DOUBLE.sub('"', _SINGLE.sub("'", s))).lower()
    return _EDGES.sub("", re.sub(r"\s+", " ", s).strip())


def quote_appears(quote: str, source: str) -> bool:
    q = normalize_text(quote)
    return len(q) >= 3 and q in normalize_text(source)


def data_block(tag: str, text: str) -> str:
    """Wrap untrusted text in tags; a closing tag inside the text cannot end the block."""
    return f"<{tag}>\n{text.replace(f'</{tag}>', f'</ {tag}>')}\n</{tag}>"


def hash_input(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()


# Intake interpreter -----------------------------------------------------------

INTAKE_FIELDS = (
    "workTypes", "frequencyPerMonth", "minutesPerOccurrence", "correctness", "errorImpact", "dataClasses", "localOnly",
    "integrations",
)
IntakeField = Literal[
    "workTypes", "frequencyPerMonth", "minutesPerOccurrence", "correctness", "errorImpact", "dataClasses", "localOnly",
    "integrations",
]
WORK_TYPES = ("classify", "extract", "summarize", "generate", "converse", "search", "decide", "act", "transfer",
              "calculate", "lookup", "record")
DATA_CLASSES = ("public", "internal", "pii", "sensitive_pii", "phi", "pci", "financial", "credentials", "trade_secret",
                "minors")
CORRECTNESS = ("exact", "tolerant", "subjective")
IMPACT = ("low", "medium", "high", "critical")


class IntakeAgentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=10, max_length=4000)
    surface: Literal["consumer", "teams"] = "consumer"


class IntakeSuggestionOut(BaseModel):
    field: IntakeField
    value: str
    evidence: str
    confidence: Literal["low", "medium", "high"]


class IntakeAgentOutput(BaseModel):
    """Flat on purpose (every value a string): the same schema as the TypeScript agent."""

    suggestions: list[IntakeSuggestionOut] = Field(max_length=16)
    questions: list[str] = Field(max_length=5)


def _list(raw: str, allowed: tuple[str, ...]) -> list[str]:
    return sorted({s.strip().lower() for s in raw.split(",") if s.strip().lower() in allowed})


def parse_value(field_name: str, raw: str) -> tuple[Any, str | None]:
    """Parse one suggestion's string value for its field: (value, None) or (None, reason)."""
    v = raw.strip()
    if field_name in ("workTypes", "dataClasses"):
        xs = _list(v, WORK_TYPES if field_name == "workTypes" else DATA_CLASSES)
        return (xs, None) if xs else (None, "no_valid_values")
    if field_name in ("frequencyPerMonth", "minutesPerOccurrence"):
        if not re.fullmatch(r"\d+(\.\d+)?", v):
            return None, "not_a_number"
        n = float(v)
        n = int(n) if n.is_integer() else n
        return (n, None) if n <= 1_000_000 else (None, "out_of_range")
    if field_name == "correctness":
        return (v.lower(), None) if v.lower() in CORRECTNESS else (None, "not_an_option")
    if field_name == "errorImpact":
        return (v.lower(), None) if v.lower() in IMPACT else (None, "not_an_option")
    if field_name == "localOnly":
        return {"true": (True, None), "false": (False, None)}.get(v.lower(), (None, "not_a_boolean"))
    if field_name == "integrations":
        xs = list(dict.fromkeys(s.strip() for s in v.split(",") if 1 <= len(s.strip()) <= 80))[:20]
        return (xs, None) if xs else (None, "no_valid_values")
    return None, "unknown_field"


def check_intake(text: str, output: IntakeAgentOutput | Mapping[str, Any]) -> dict[str, Any]:
    """The deterministic gate between the model and the form."""
    out = output if isinstance(output, IntakeAgentOutput) else IntakeAgentOutput.model_validate(output)
    seen: set[str] = set()
    suggestions: list[dict[str, Any]] = []
    dropped: list[dict[str, str]] = []
    for s in out.suggestions:
        if s.field in seen:
            dropped.append({"field": s.field, "reason": "duplicate_field"})
            continue
        if len(s.evidence) > 120 or not quote_appears(s.evidence, text):
            dropped.append({"field": s.field, "reason": "evidence_not_in_text"})
            continue
        value, reason = parse_value(s.field, s.value)
        if reason:
            dropped.append({"field": s.field, "reason": reason})
            continue
        seen.add(s.field)
        suggestions.append({"field": s.field, "value": value, "evidence": s.evidence.strip(), "confidence": s.confidence})
    questions = [q.strip() for q in out.questions if 0 < len(q.strip()) <= 200][:3]
    return {"suggestions": suggestions, "questions": questions, "dropped": dropped}


# Explainer --------------------------------------------------------------------


class ExplanationOutput(BaseModel):
    summary: str = Field(max_length=800)
    keyPoints: list[str] = Field(max_length=6)  # noqa: N815 (shared JSON contract)


def rules_explanation(d: Mapping[str, Any]) -> dict[str, Any]:
    top = next(o for o in d["outcomeScores"] if o["outcome"] == d["outcome"])
    points = [f"In favour: {c['factor']} (+{c['points']})." for c in top["contributions"]
              if c["factor"] != "base" and c["points"] > 0][:3]
    points += [h["detail"] for h in d["hardConstraints"] if h["triggered"]][:2]
    return {"source": "rules", "summary": d["summary"], "keyPoints": points}


def explain_request(d: Mapping[str, Any]) -> dict[str, Any]:
    """The structured decision the explainer sees. Never the person's free text."""
    top = next(o for o in d["outcomeScores"] if o["outcome"] == d["outcome"])
    return {
        "outcome": d["outcome"],
        "outcomeLabel": OUTCOME_LABEL[d["outcome"]],
        "runnerUp": d["runnerUp"],
        "confidence": d["confidence"],
        "summary": d["summary"],
        "requiredControls": d["requiredControls"],
        "missingInputs": d["missingInputs"],
        "whatWouldChange": d["whatWouldChange"],
        "hardConstraints": [{"id": h["id"], "detail": h["detail"]} for h in d["hardConstraints"] if h["triggered"]],
        "topFactors": [c for c in top["contributions"] if c["factor"] != "base"],
    }


def names_other_outcome(text: str, chosen: str) -> bool:
    lower = text.lower()
    return any(o != chosen and (o in lower or OUTCOME_LABEL[o].lower() in lower) for o in OUTCOMES)


# Harness ------------------------------------------------------------------------


@dataclass
class ModelResponse:
    output: BaseModel | None
    stop_reason: str | None
    model: str | None = None
    usage: dict[str, int] | None = None


class ModelClient(Protocol):
    name: str

    def complete(self, *, system: str, user: str, schema: type[BaseModel], model: str, effort: Effort, max_tokens: int,
                 timeout_s: float) -> ModelResponse: ...


class AnthropicModelClient:
    """Claude through the Anthropic API with structured outputs and server-side refusal fallbacks."""

    name = "anthropic"

    def __init__(self, api_key: str | None = None, max_retries: int = 2) -> None:
        import anthropic  # imported lazily so the package works without the SDK when agents are off

        self._client = anthropic.Anthropic(api_key=api_key, max_retries=max_retries)

    def complete(self, *, system: str, user: str, schema: type[BaseModel], model: str, effort: Effort, max_tokens: int,
                 timeout_s: float) -> ModelResponse:
        msg = self._client.beta.messages.parse(
            model=model,
            max_tokens=max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort},
            output_format=schema,
            timeout=timeout_s,
        )
        return ModelResponse(
            output=None if msg.stop_reason == "refusal" else msg.parsed_output,
            stop_reason=msg.stop_reason,
            model=msg.model,
            usage={"inputTokens": msg.usage.input_tokens, "outputTokens": msg.usage.output_tokens},
        )


class ScriptedModelClient:
    """Offline client for tests: replies come from a function, parsed against the agent's schema."""

    name = "scripted"

    def __init__(self, reply: Callable[[str], Any], stop_reason: str = "end_turn", delay_s: float = 0.0) -> None:
        self.reply = reply
        self.stop_reason = stop_reason
        self.delay_s = delay_s
        self.requests: list[dict[str, Any]] = []

    def complete(self, *, system: str, user: str, schema: type[BaseModel], model: str, effort: Effort, max_tokens: int,
                 timeout_s: float) -> ModelResponse:
        self.requests.append({"system": system, "user": user, "model": model, "effort": effort})
        if self.delay_s:
            time.sleep(self.delay_s)
        raw = self.reply(user)
        try:
            output = schema.model_validate(raw)
        except ValidationError:
            output = None
        return ModelResponse(output=output, stop_reason=self.stop_reason, model=model,
                             usage={"inputTokens": 0, "outputTokens": 0})


@dataclass
class AgentConfig:
    enabled: bool
    reason: str
    model: str
    daily_cap: int


def agent_config(env: Mapping[str, str | None]) -> AgentConfig:
    model = (env.get("AIFIT_AGENT_MODEL") or "").strip() or DEFAULT_AGENT_MODEL
    try:
        cap = max(0, int(float(env.get("AIFIT_AGENT_DAILY_CAP") or 500)))
    except ValueError:
        cap = 0
    if env.get("AIFIT_AGENTS") != "1":
        return AgentConfig(False, "AI assistance is off on this deployment (AIFIT_AGENTS is not 1).", model, cap)
    if not (env.get("ANTHROPIC_API_KEY") or "").strip():
        return AgentConfig(False, "AI assistance is off: ANTHROPIC_API_KEY is not set.", model, cap)
    return AgentConfig(True, "AI assistance is on. Suggestions are checked before they are shown, and nothing is "
                             "applied without you.", model, cap)


def load_prompt(name: str) -> str:
    return (PROMPT_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


@dataclass
class AgentRun:
    status: RunStatus
    result: Any
    problems: list[str]
    trace: dict[str, Any]


_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="aifit-agent")


@dataclass
class AgentSpec:
    name: str
    version: str
    prompt: str
    input: type[BaseModel]
    output: type[BaseModel]
    effort: Effort
    max_tokens: int
    timeout_s: float
    render: Callable[[Any], str]
    check: Callable[[Any, Any], tuple[Any, list[str]]]


def run_agent(spec: AgentSpec, raw_input: Any, client: ModelClient | None, model: str,
              on_trace: Callable[[dict[str, Any]], None] | None = None) -> AgentRun:
    started = time.monotonic()
    at = datetime.now(timezone.utc).isoformat()

    def finish(status: RunStatus, result: Any, problems: list[str], res: ModelResponse | None = None) -> AgentRun:
        trace = {
            "agent": spec.name, "version": spec.version, "status": status,
            "model": res.model if res else None, "client": client.name if client else None,
            "inputHash": hash_input(raw_input), "durationMs": round((time.monotonic() - started) * 1000),
            "usage": res.usage if res else None, "problems": problems, "at": at,
        }
        if on_trace:
            on_trace(trace)
        return AgentRun(status, result, problems, trace)

    if client is None:
        return finish("disabled", None, ["Agents are not enabled on this deployment."])
    try:
        parsed = spec.input.model_validate(raw_input)
    except ValidationError:
        return finish("invalid_input", None, ["The request did not match this agent's input schema."])

    future = _POOL.submit(client.complete, system=load_prompt(spec.prompt), user=spec.render(parsed),
                          schema=spec.output, model=model, effort=spec.effort, max_tokens=spec.max_tokens,
                          timeout_s=spec.timeout_s)
    try:
        res = future.result(timeout=spec.timeout_s)
    except FutureTimeout:
        return finish("timeout", None, ["The model did not answer in time."])
    except Exception:  # noqa: BLE001 - any SDK or network failure is reported, never raised to the page
        return finish("error", None, ["The model call failed."])
    if res.stop_reason == "refusal":
        return finish("refused", None, ["The model declined this request."], res)
    try:
        out = None if res.output is None else spec.output.model_validate(res.output.model_dump())
    except ValidationError:
        out = None
    if out is None:
        return finish("rejected", None, ["The model's reply did not match the expected format."], res)
    result, problems = spec.check(parsed, out)
    if result is None:
        return finish("rejected", None, problems or ["Nothing in the reply passed the checks."], res)
    return finish("ok", result, problems, res)


def _intake_check(i: IntakeAgentInput, o: IntakeAgentOutput) -> tuple[dict[str, Any], list[str]]:
    r = check_intake(i.text, o)
    return r, [f"Dropped {d['field']}: {d['reason']}" for d in r["dropped"]]


INTAKE_AGENT = AgentSpec(
    name="intake-interpreter", version="1.0.0", prompt="intake", input=IntakeAgentInput, output=IntakeAgentOutput,
    effort="low", max_tokens=4000, timeout_s=30.0,
    render=lambda i: f"Form surface: {i.surface}.\nThe person's description of the task:\n{data_block('description', i.text)}",
    check=_intake_check,
)


class _ExplainInput(BaseModel):
    decision: dict[str, Any]


def _explain_check(i: _ExplainInput, o: ExplanationOutput) -> tuple[dict[str, Any] | None, list[str]]:
    summary = o.summary.strip()
    points = [p.strip() for p in o.keyPoints if p.strip()]
    if not summary or any(len(p) > 300 for p in points):
        return None, ["reply did not match the schema"]
    if names_other_outcome("\n".join([summary, *points]), i.decision["outcome"]):
        return None, ["reply named a different outcome"]
    return {"source": "model", "summary": summary, "keyPoints": points}, []


EXPLAINER_AGENT = AgentSpec(
    name="decision-explainer", version="1.0.0", prompt="explainer", input=_ExplainInput, output=ExplanationOutput,
    effort="low", max_tokens=2000, timeout_s=20.0,
    render=lambda i: f"The decision, as structured data:\n<decision>\n{json.dumps(i.decision, indent=2)}\n</decision>",
    check=_explain_check,
)


def explain_decision(d: Mapping[str, Any], client: ModelClient | None, model: str,
                     on_trace: Callable[[dict[str, Any]], None] | None = None) -> tuple[dict[str, Any], AgentRun | None]:
    """Explain a rule-made decision: the model's words when they pass the checks, the rules' words otherwise."""
    fallback = rules_explanation(d)
    if client is None:
        return fallback, None
    run = run_agent(EXPLAINER_AGENT, {"decision": explain_request(d)}, client, model, on_trace)
    if run.status != "ok":
        return {**fallback, "rejected": "; ".join(run.problems) or run.status}, run
    return run.result, run


def log_trace(trace: dict[str, Any]) -> None:
    log.info(json.dumps({"kind": "agent_run", **trace}))


# Limits ---------------------------------------------------------------------------


@dataclass
class Limiter:
    """Per-process limits: a per-client sliding window under a deployment-wide daily cap.

    On serverless each instance keeps its own counters, so these are a backstop
    against runaway cost, not an exact quota.
    """

    daily_cap: int
    per_minute: int = 6
    _day: str = ""
    _count: int = 0
    _hits: dict[str, deque[float]] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def take(self, client_key: str, now: float | None = None) -> str | None:
        """None if allowed, else a reason."""
        t = time.time() if now is None else now
        day = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d")
        with self._lock:
            hits = self._hits.setdefault(client_key, deque())
            while hits and hits[0] <= t - 60:
                hits.popleft()
            if len(hits) >= self.per_minute:
                return "Too many requests. Try again in a minute."
            if day != self._day:
                self._day, self._count = day, 0
            if self._count >= self.daily_cap:
                return "Today's AI assistance limit for this site is used up. The rule-based result still works."
            hits.append(t)
            self._count += 1
            if len(self._hits) > 10_000:
                self._hits = {k: v for k, v in self._hits.items() if v}
            return None
