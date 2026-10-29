from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/core/src"))

from fastapi import Body, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

from aifit import __version__
from aifit import agents as ai_agents
from aifit.analytics import summary as analytics_summary
from aifit.analytics import track
from aifit.bundle import BundleValidationError, build_bundle, redact_secrets, validate_file
from aifit.classifier import classify_text
from aifit.decision import DecisionIntake, decide_parsed, match_tools, rules as decision_rules
from aifit.engine import normalize_free_text, score_session
from aifit.exports import export_persona
from aifit.fit import rank_models_by_workload, rank_products
from aifit.freshness import freshness_report
from aifit.models import AssessmentSession, FitFilters, InteractionEvent, UserFitVector
from aifit.persona import generate_persona
from aifit.registry import load_models, load_products
from aifit.scenarios import load_scenarios

from .store import STORE as RESULT_STORE

MAX_BODY_BYTES = 512 * 1024
MAX_SHARE_BYTES = 256 * 1024
MAX_BATCH_EVENTS = 50
MAX_SESSION_EVENTS = 1000
MAX_SCORE_EVENTS = 400
MAX_NOTES = 40
MAX_TEXT = 2000
MAX_ID = 100

app = FastAPI(title="Fit API", version=__version__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Request body too large."})
    return await call_next(request)


PRODUCTS = load_products(ROOT / "data/registry/products.json")
MODELS = load_models(ROOT / "data/registry/models.json")
PRODUCT_RECORDS = [p.model_dump(mode="json") for p in PRODUCTS]

SessionToken = Annotated[str | None, Header(alias="X-Session-Token", max_length=200)]


# Sessions ------------------------------------------------------------------
#
# A session is a small record (id, token hash) plus an append-only event list.
# The token is returned once at creation and required on every session-scoped
# call, so knowing a session id alone is not enough to read or delete it.


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _session_record(session_id: str) -> dict[str, Any] | None:
    return RESULT_STORE.get("sessions", session_id)


def _authorize(record: dict[str, Any], token: str | None) -> None:
    expected = record.get("token_hash")
    if not expected:
        return
    if not token or not hmac.compare_digest(expected, _hash_token(token)):
        raise HTTPException(status_code=403, detail="Missing or wrong session token.")


def _require_session(session_id: uuid.UUID, token: str | None) -> tuple[str, dict[str, Any]]:
    key = str(session_id)
    record = _session_record(key)
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    _authorize(record, token)
    return key, record


def _create_session_record(session_id: str, token: str | None) -> dict[str, Any]:
    record: dict[str, Any] = {"session_id": session_id}
    if token:
        record["token_hash"] = _hash_token(token)
    RESULT_STORE.put("sessions", session_id, record)
    return record


def _load_session(session_id: str, record: dict[str, Any]) -> AssessmentSession:
    # Older records kept events inline; newer ones append to a list.
    rows = list(record.get("events") or []) + RESULT_STORE.get_list("events", session_id)
    return AssessmentSession(session_id=session_id, events=[InteractionEvent.model_validate(r) for r in rows])


def _delete_session_data(session_id: str) -> None:
    for link in RESULT_STORE.get_list("session_shares", session_id):
        share_id = link.get("share_id")
        if isinstance(share_id, str):
            try:
                RESULT_STORE.delete("shares", share_id)
            except ValueError:
                pass
    for kind in ("sessions", "events", "scores", "session_shares"):
        RESULT_STORE.delete(kind, session_id)


# Request bodies ----------------------------------------------------------------


class FitRequest(BaseModel):
    values: dict[str, float]
    confidence: dict[str, float] = Field(default_factory=dict)
    filters: FitFilters | None = None


class PersonaRequest(BaseModel):
    values: dict[str, float]
    confidence: dict[str, float] = Field(default_factory=dict)


class EventBatch(BaseModel):
    events: list[InteractionEvent] = Field(default_factory=list, max_length=MAX_BATCH_EVENTS)
    free_text: str | None = Field(default=None, max_length=MAX_TEXT)
    scenario_id: str | None = Field(default=None, max_length=MAX_ID)
    turn_id: str | None = Field(default=None, max_length=MAX_ID)


class ExportRequest(BaseModel):
    persona: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None


class ClassifyRequest(BaseModel):
    text: str = Field(max_length=MAX_TEXT)
    scenario_id: str = Field(max_length=MAX_ID)
    turn_id: str | None = Field(default=None, max_length=MAX_ID)


class FeedbackRequest(BaseModel):
    session_id: str | None = Field(default=None, max_length=MAX_ID)
    share_id: str | None = Field(default=None, max_length=MAX_ID)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=MAX_TEXT)
    useful: bool | None = None


class ScoreRequest(BaseModel):
    filters: FitFilters | None = None


class Note(BaseModel):
    text: str = Field(max_length=MAX_TEXT)
    scenario_id: str = Field(max_length=MAX_ID)
    turn_id: str | None = Field(default=None, max_length=MAX_ID)


class ScoreBody(BaseModel):
    """Stateless scoring input. Nothing here is written to the store."""

    session_id: str | None = Field(default=None, max_length=MAX_ID)
    events: list[InteractionEvent] = Field(default_factory=list, max_length=MAX_SCORE_EVENTS)
    notes: list[Note] = Field(default_factory=list, max_length=MAX_NOTES)
    filters: FitFilters | None = None


class ShareBody(BaseModel):
    result: dict[str, Any]
    session_id: uuid.UUID | None = None


def _score_and_store(session: AssessmentSession, filters: FitFilters | None = None) -> dict[str, Any]:
    result = score_session(session, filters=filters, products=PRODUCTS, models=MODELS)
    RESULT_STORE.put("scores", session.session_id, result)
    track("session_scored", session_id=session.session_id)
    return result


@app.get("/health")
def health():
    return {
        "ok": True,
        "version": __version__,
        "privacy": "anonymous",
        "product": "Fit",
        "store": RESULT_STORE.backend,
        "durable": RESULT_STORE.durable,
    }


@app.get("/v1/scenarios")
def scenarios():
    return [s.model_dump() for s in load_scenarios()]


@app.post("/v1/sessions")
def create_session():
    session_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(24)
    _create_session_record(session_id, token)
    track("session_created", session_id=session_id)
    return {"session_id": session_id, "token": token, "events": []}


@app.post("/v1/sessions/demo")
def demo_session():
    raw = json.loads((ROOT / "examples/sample_session.json").read_text())
    session_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(24)
    session = AssessmentSession.model_validate({**raw, "session_id": session_id})
    _create_session_record(session_id, token)
    RESULT_STORE.append("events", session_id, [e.model_dump() for e in session.events])
    result = _score_and_store(session)
    track("demo_session", session_id=session_id)
    return {"session_id": session_id, "token": token, "session": session.model_dump(), "result": result}


@app.get("/v1/sessions/{session_id}")
def get_session(session_id: uuid.UUID, x_session_token: SessionToken = None):
    key, record = _require_session(session_id, x_session_token)
    return {
        "session": _load_session(key, record).model_dump(),
        "result": RESULT_STORE.get("scores", key),
    }


@app.post("/v1/sessions/{session_id}/events")
def add_events(session_id: uuid.UUID, batch: EventBatch, x_session_token: SessionToken = None):
    key = str(session_id)
    record = _session_record(key)
    if record is None:
        # Another serverless instance (or a client that could not reach
        # create_session) started this id. Adopt it with the caller's token.
        record = _create_session_record(key, x_session_token)
    else:
        _authorize(record, x_session_token)
    incoming = list(batch.events)
    if batch.free_text and batch.scenario_id:
        incoming.extend(normalize_free_text(batch.free_text, batch.scenario_id, batch.turn_id))
    for event in incoming:
        if not event.scenario_id and batch.scenario_id:
            event.scenario_id = batch.scenario_id
        if not event.turn_id and batch.turn_id:
            event.turn_id = batch.turn_id
    existing = len(record.get("events") or []) + RESULT_STORE.list_length("events", key)
    if existing + len(incoming) > MAX_SESSION_EVENTS:
        raise HTTPException(status_code=413, detail="This session already has the maximum number of answers.")
    if not RESULT_STORE.append("events", key, [e.model_dump() for e in incoming]):
        raise HTTPException(status_code=503, detail="Could not save answers. Try again.")
    track("events_added", session_id=key, metadata={"count": len(incoming)})
    return {"session_id": key, "event_count": existing + len(incoming)}


@app.post("/v1/sessions/{session_id}/score")
def score_stored_session(
    session_id: uuid.UUID,
    payload: ScoreRequest | None = Body(default=None),
    x_session_token: SessionToken = None,
):
    key, record = _require_session(session_id, x_session_token)
    filters = payload.filters if payload else None
    return _score_and_store(_load_session(key, record), filters)


@app.post("/v1/sessions/{session_id}/share")
def share_session(session_id: uuid.UUID, x_session_token: SessionToken = None):
    key, record = _require_session(session_id, x_session_token)
    result = RESULT_STORE.get("scores", key) or _score_and_store(_load_session(key, record))
    return _store_share(result, key)


def _list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _snapshot(result: dict[str, Any], share_id: str) -> dict[str, Any]:
    """Scores only: no per-metric evidence, raw answers, notes or user vector."""
    persona = result.get("persona")
    if not isinstance(persona, dict) or not persona:
        raise HTTPException(status_code=400, detail="Share payload needs a persona.")
    metrics = [
        {k: v for k, v in m.items() if k != "evidence"} for m in _list(result.get("metrics")) if isinstance(m, dict)
    ]
    models = {k: _list(v)[:2] for k, v in _dict(result.get("models")).items()}
    workstyle = result.get("workstyle")
    if isinstance(workstyle, dict):
        why = [{**row, "evidence": []} if isinstance(row, dict) else row for row in _list(workstyle.get("why"))]
        workstyle = {**workstyle, "why": why}
    return {
        "share_id": share_id,
        "persona": persona,
        "metrics": metrics,
        "products": _list(result.get("products"))[:8],
        "products_by_category": _dict(result.get("products_by_category")),
        "models": models,
        "primary_stack": _dict(result.get("primary_stack")) or {"name": "Primary stack", "slots": [], "rationale": []},
        "alternative_stack": _dict(result.get("alternative_stack"))
        or {"name": "Alternative stack", "slots": [], "rationale": []},
        "workstyle": workstyle,
        "operating_stack": result.get("operating_stack"),
        "model_routing": result.get("model_routing"),
        "workflow": result.get("workflow"),
        "instructions": result.get("instructions"),
        "install_guides": result.get("install_guides"),
        "share_card": result.get("share_card"),
        "disclaimer": result.get("disclaimer") or "",
        "privacy": _dict(result.get("privacy")),
    }


def _store_share(result: dict[str, Any], session_id: str | None = None) -> dict[str, Any]:
    share_id = str(uuid.uuid4())
    snapshot = _snapshot(result, share_id)
    if len(json.dumps(snapshot)) > MAX_SHARE_BYTES:
        raise HTTPException(status_code=413, detail="Share payload too large.")
    persisted = RESULT_STORE.put("shares", share_id, snapshot)
    if session_id:
        RESULT_STORE.append("session_shares", session_id, [{"share_id": share_id}])
    track("session_shared", session_id=session_id)
    return {
        "share_id": share_id,
        "path": f"/share/{share_id}",
        "durable": bool(persisted and RESULT_STORE.durable),
    }


@app.post("/v1/share")
def publish_share(payload: ShareBody, x_session_token: SessionToken = None):
    linked: str | None = None
    if payload.session_id is not None:
        # Linking lets "delete my session" also remove this share.
        linked, _record = _require_session(payload.session_id, x_session_token)
    return _store_share(payload.result, linked)


@app.get("/v1/share/{share_id}")
def get_share(share_id: uuid.UUID):
    snapshot = RESULT_STORE.get("shares", str(share_id))
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Unknown share")
    return snapshot


@app.get("/v1/sessions/{session_id}/export")
def export_session(session_id: uuid.UUID, x_session_token: SessionToken = None):
    key, record = _require_session(session_id, x_session_token)
    return {
        "session": _load_session(key, record).model_dump(),
        "result": RESULT_STORE.get("scores", key),
        "share_ids": [row.get("share_id") for row in RESULT_STORE.get_list("session_shares", key)],
        "notice": "This export is the anonymous session record. No name or employer is stored.",
    }


@app.delete("/v1/sessions/{session_id}")
def delete_session(session_id: uuid.UUID, x_session_token: SessionToken = None):
    key, _record = _require_session(session_id, x_session_token)
    _delete_session_data(key)
    track("session_deleted", session_id=key)
    return {"deleted": True, "session_id": key}


@app.post("/v1/score")
def score(payload: ScoreBody):
    events = list(payload.events)
    for note in payload.notes:
        if note.text.strip():
            events.extend(normalize_free_text(note.text, note.scenario_id, note.turn_id))
    session = AssessmentSession(session_id=payload.session_id or "stateless", events=events)
    result = score_session(session, filters=payload.filters, products=PRODUCTS, models=MODELS)
    track("stateless_scored")
    return result


@app.post("/v1/signal")
def signal(payload: ScoreBody):
    from aifit.adaptive import diagnostic_signal

    session = AssessmentSession(session_id=payload.session_id or "stateless", events=payload.events)
    return diagnostic_signal(session)


@app.post("/v1/fit")
def fit(payload: FitRequest):
    user = UserFitVector(values=payload.values, confidence=payload.confidence)
    product_recs = rank_products(user, PRODUCTS, filters=payload.filters)
    return {
        "products": [x.model_dump() for x in product_recs],
        "models": {
            w: [x.model_dump() for x in recs]
            for w, recs in rank_models_by_workload(MODELS).items()
            if recs
        },
        "persona": generate_persona(user),
    }


@app.get("/v1/registry/products")
def products():
    return [x.model_dump() for x in PRODUCTS]


@app.get("/v1/registry/models")
def models():
    return [x.model_dump() for x in MODELS]


@app.get("/v1/registry/freshness")
def registry_freshness():
    return freshness_report(PRODUCTS, MODELS)


@app.post("/v1/persona")
def persona(payload: PersonaRequest):
    user = UserFitVector(values=payload.values, confidence=payload.confidence)
    return generate_persona(user)


@app.post("/v1/classify")
def classify(payload: ClassifyRequest):
    events = classify_text(payload.text, payload.scenario_id, payload.turn_id)
    return {"events": [e.model_dump() for e in events], "note": "Classifier output is a feature source, not a recommendation."}


@app.post("/v1/export/{target}")
def export(target: str, payload: ExportRequest):
    allowed = {"generic", "claude", "agents", "cursor", "json", "chatgpt", "gemini", "profile", "routing", "pack"}
    if target not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown export target: {target}")
    result = payload.result or {"persona": payload.persona}
    if "persona" not in result:
        result = {**result, "persona": payload.persona}
    persona_payload = payload.persona or result.get("persona") or {}
    if not isinstance(result.get("persona"), dict) or not isinstance(persona_payload, dict):
        raise HTTPException(status_code=400, detail="persona must be an object.")
    try:
        if target == "pack":
            filename, blob, manifest = build_bundle(result)
            track("bundle_built", metadata={"files": len(manifest["files"]), "redacted": manifest["secretsRedacted"]})
            return {
                "filename": filename,
                "content": base64.b64encode(blob).decode("ascii"),
                "encoding": "base64",
                "manifest": manifest,
            }
        filename, body = export_persona(persona_payload, target, result)
        body, redacted = redact_secrets(body)
        failed = [c["detail"] for c in validate_file(filename, body) if not c["passed"]]
        if failed:
            raise BundleValidationError([{"path": filename, "detail": d} for d in failed])
    except BundleValidationError as exc:
        raise HTTPException(status_code=422, detail={"error": "Export failed validation.", "failures": exc.failures}) from exc
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="That result is missing fields this export needs.") from exc
    return {"filename": filename, "content": body, "encoding": "text", "secretsRedacted": redacted}


@app.post("/v1/feedback")
def feedback(payload: FeedbackRequest):
    row = payload.model_dump()
    row["id"] = str(uuid.uuid4())
    RESULT_STORE.put("feedback", row["id"], row)
    RESULT_STORE.incr("feedback")
    track("feedback", session_id=payload.session_id)
    return {"ok": True, "id": row["id"]}


# Activation ------------------------------------------------------------------
#
# Anonymous, allow-listed counters so activation can be measured across
# serverless instances (when Redis/KV is configured). No session id, IP or
# free text is stored: only that an event of a known name happened.

ACTIVATION_EVENTS = (
    "quiz_started",
    "quiz_completed",
    "results_viewed",
    "persona_copied",
    "persona_opened",
    "export_downloaded",
    "bundle_downloaded",
    "check_started",
    "check_completed",
    "history_viewed",
    "share_created",
)


class ActivationBody(BaseModel):
    event: str = Field(max_length=40)


@app.post("/v1/activation")
def activation(payload: ActivationBody):
    if payload.event not in ACTIVATION_EVENTS:
        raise HTTPException(status_code=400, detail="Unknown activation event.")
    RESULT_STORE.incr(f"activation_{payload.event}")
    track(payload.event)
    return {"ok": True}


@app.get("/v1/analytics/summary")
def analytics():
    return {
        **analytics_summary(),
        "feedback_count": RESULT_STORE.count("feedback"),
        "activation": {name: RESULT_STORE.count(f"activation_{name}") for name in ACTIVATION_EVENTS},
        "activation_durable": RESULT_STORE.durable,
    }


# Decision ------------------------------------------------------------------
#
# "Should I use AI for this at all?" Five outcomes from the shared rules in
# packages/decision-core. Stateless: nothing in the request is stored. The
# surface is forced to consumer and caller-supplied estimates are dropped, so a
# request cannot claim to be a Teams assessment or inject its own cost figures.

TECHNICAL_LEVEL = {"none": 0.15, "basic": 0.35, "intermediate": 0.6, "advanced": 0.85}


@app.get("/v1/decision/rules")
def decision_rules_published():
    """Every weight and threshold the task check uses, exactly as the engine reads them."""
    return decision_rules()


@app.post("/v1/decision")
def decision(payload: dict[str, Any] = Body(...)):
    try:
        intake = DecisionIntake.model_validate({**payload, "surface": "consumer", "externalEstimates": {}})
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_url=False, include_context=False, include_input=False),
        ) from exc
    result = decide_parsed(intake)
    tools = match_tools(
        result,
        PRODUCT_RECORDS,
        technical_level=TECHNICAL_LEVEL[intake.technicalAbility],
        as_of=datetime.now(timezone.utc).date(),
    )
    track("decision_completed", metadata={"outcome": result["outcome"]})
    return {"decision": result, "tools": tools}


# Suggest-only agents ----------------------------------------------------------
#
# Off unless AIFIT_AGENTS=1 and ANTHROPIC_API_KEY are set. They only suggest
# or explain: intake suggestions are returned for the person to apply, and the
# explanation is recomputed from the intake here, so a client cannot hand the
# explainer a decision the rules did not make. Nothing is stored; logs carry
# an input hash, never the text.

AGENT_CONFIG = ai_agents.agent_config(os.environ)
AGENT_LIMITER = ai_agents.Limiter(daily_cap=AGENT_CONFIG.daily_cap)
_AGENT_CLIENT: ai_agents.ModelClient | None = None


def _agent_client() -> ai_agents.ModelClient | None:
    global _AGENT_CLIENT
    if not AGENT_CONFIG.enabled:
        return None
    if _AGENT_CLIENT is None:
        _AGENT_CLIENT = ai_agents.AnthropicModelClient()
    return _AGENT_CLIENT


def _agent_gate(request: Request) -> None:
    key = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown")
    reason = AGENT_LIMITER.take(hashlib.sha256(key.encode()).hexdigest())
    if reason:
        raise HTTPException(status_code=429, detail=reason)


class IntakeAgentBody(BaseModel):
    text: str = Field(min_length=10, max_length=4000)


@app.get("/v1/agents")
def agents_status():
    return {
        "enabled": AGENT_CONFIG.enabled,
        "reason": AGENT_CONFIG.reason,
        "agents": [
            {"name": a.name, "version": a.version} for a in (ai_agents.INTAKE_AGENT, ai_agents.EXPLAINER_AGENT)
        ],
    }


@app.post("/v1/agents/intake")
def agents_intake(payload: IntakeAgentBody, request: Request):
    if not AGENT_CONFIG.enabled:
        return {"status": "disabled", "reason": AGENT_CONFIG.reason, "suggestions": [], "questions": []}
    _agent_gate(request)
    run = ai_agents.run_agent(ai_agents.INTAKE_AGENT, {"text": payload.text, "surface": "consumer"}, _agent_client(),
                              AGENT_CONFIG.model, ai_agents.log_trace)
    result = run.result or {"suggestions": [], "questions": [], "dropped": []}
    return {"status": run.status, "model": AGENT_CONFIG.model, "suggestions": result["suggestions"],
            "questions": result["questions"], "droppedCount": len(result["dropped"]),
            "problems": [] if run.status == "ok" else run.problems}


@app.post("/v1/agents/explain")
def agents_explain(request: Request, payload: dict[str, Any] = Body(...)):
    try:
        intake = DecisionIntake.model_validate({**payload, "surface": "consumer", "externalEstimates": {}})
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_url=False, include_context=False, include_input=False),
        ) from exc
    result = decide_parsed(intake)
    client = _agent_client()
    if client is not None:
        _agent_gate(request)
    explanation, run = ai_agents.explain_decision(result, client, AGENT_CONFIG.model, ai_agents.log_trace)
    return {
        "status": run.status if run else "disabled",
        "reason": None if run else AGENT_CONFIG.reason,
        "outcome": result["outcome"],
        "inputHash": result["engine"]["inputHash"],
        "explanation": explanation,
    }


# Consumer accounts and Pro billing -----------------------------------------
#
# Accounts are on only when the store is durable (Redis, or a local
# filesystem); on a serverless deployment without Redis a sign-up would
# vanish, so the endpoints answer 503 with the reason instead. Set
# AIFIT_ACCOUNTS=0 to switch them off anywhere.
#
# Sessions are an HttpOnly, SameSite=Lax cookie. Every state-changing account
# call also needs the X-AIFit-Request header and, when the browser sends one,
# an Origin matching this host, so another site cannot drive the account.
#
# Saved assessments are scored here from stored answers or a validated intake,
# never taken from the client, so a saved profile is what the engine said.

from fastapi import Response  # noqa: E402

from aifit import accounts as acct  # noqa: E402
from aifit import billing as bill  # noqa: E402

SESSION_COOKIE = "aifit_session"
BILLING = bill.billing_config(dict(os.environ))


def _accounts_reason() -> str | None:
    if os.environ.get("AIFIT_ACCOUNTS") == "0":
        return "Accounts are switched off on this deployment (AIFIT_ACCOUNTS=0)."
    if not RESULT_STORE.durable:
        return (
            "Accounts need a durable store. Connect Upstash Redis "
            "(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN) to turn them on."
        )
    return None


_ERROR_STATUS = {
    "invalid": 400, "unauthorized": 401, "limit": 402, "not_found": 404, "conflict": 409, "locked": 429, "unavailable": 503,
}


def _fail(exc: acct.AccountError) -> HTTPException:
    return HTTPException(status_code=_ERROR_STATUS.get(exc.code, 400), detail={"code": exc.code, "message": exc.message})


def _invalid(exc: ValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail=exc.errors(include_url=False, include_context=False, include_input=False))


def _limits(user: dict[str, Any]) -> dict[str, int | None]:
    return bill.limits_for(BILLING, bill.read_entitlements(RESULT_STORE, user["id"]))


def _require_accounts() -> None:
    reason = _accounts_reason()
    if reason:
        raise HTTPException(status_code=503, detail={"code": "unavailable", "message": reason})


def _same_origin(request: Request) -> None:
    if request.headers.get("x-aifit-request") != "1":
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Missing X-AIFit-Request header."})
    origin = request.headers.get("origin")
    if origin:
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        if origin.split("://", 1)[-1].rstrip("/") != host:
            raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Cross-site request refused."})


def _token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


def _viewer(request: Request) -> dict[str, Any]:
    _require_accounts()
    try:
        return acct.require_user(RESULT_STORE, _token(request))
    except acct.AccountError as exc:
        raise _fail(exc) from exc


def _set_session(response: Response, request: Request, token: str) -> None:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        SESSION_COOKIE, token, max_age=acct.SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=secure, path="/"
    )


def _me(user: dict[str, Any]) -> dict[str, Any]:
    ent = bill.read_entitlements(RESULT_STORE, user["id"])
    return {"user": acct.public_user(user), "account": bill.account_summary(BILLING, ent)}


@app.get("/v1/account/status")
def account_status(request: Request):
    reason = _accounts_reason()
    user = None if reason else acct.current_user(RESULT_STORE, _token(request))
    return {
        "accounts": {"enabled": reason is None, "reason": reason or "Accounts are on."},
        "billing": BILLING.public(),
        "free_limits": bill.FREE_LIMITS,
        "signed_in": user is not None,
    }


@app.post("/v1/account/signup")
def account_signup(request: Request, response: Response, payload: dict[str, Any] = Body(...)):
    _require_accounts()
    _same_origin(request)
    try:
        data = acct.SignUp.model_validate(payload)
        user, token = acct.sign_up(RESULT_STORE, data)
    except ValidationError as exc:
        raise _invalid(exc) from exc
    except acct.AccountError as exc:
        raise _fail(exc) from exc
    _set_session(response, request, token)
    track("account_created")
    return _me(user)


@app.post("/v1/account/login")
def account_login(request: Request, response: Response, payload: dict[str, Any] = Body(...)):
    _require_accounts()
    _same_origin(request)
    try:
        data = acct.Credentials.model_validate(payload)
        user, token = acct.sign_in(RESULT_STORE, data)
    except ValidationError as exc:
        raise _invalid(exc) from exc
    except acct.AccountError as exc:
        raise _fail(exc) from exc
    _set_session(response, request, token)
    return _me(user)


@app.post("/v1/account/logout")
def account_logout(request: Request, response: Response):
    _same_origin(request)
    if not _accounts_reason():
        acct.sign_out(RESULT_STORE, _token(request))
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"signed_out": True}


@app.get("/v1/account/me")
def account_me(request: Request):
    return _me(_viewer(request))


class NameBody(BaseModel):
    name: str = Field(max_length=80)


class PasswordBody(BaseModel):
    current: str = Field(min_length=1, max_length=acct.MAX_PASSWORD)
    new: str = Field(min_length=acct.MIN_PASSWORD, max_length=acct.MAX_PASSWORD)


@app.patch("/v1/account/me")
def account_rename(request: Request, payload: NameBody):
    user = _viewer(request)
    _same_origin(request)
    return _me(acct.update_name(RESULT_STORE, user, payload.name))


@app.post("/v1/account/password")
def account_password(request: Request, payload: PasswordBody):
    user = _viewer(request)
    _same_origin(request)
    try:
        acct.change_password(RESULT_STORE, user, payload.current, payload.new)
    except acct.AccountError as exc:
        raise _fail(exc) from exc
    return {"changed": True}


class SaveAssessmentBody(BaseModel):
    """Either a quiz session (scored here from its stored answers) or a task check intake (decided here)."""

    kind: str = Field(pattern="^(quiz|check)$")
    session_id: uuid.UUID | None = None
    session_token: str | None = Field(default=None, max_length=200)
    intake: dict[str, Any] | None = None
    label: str = Field(default="", max_length=160)


def _trim(result: dict[str, Any], cap: int | None) -> dict[str, Any]:
    """Free plan: the first `cap` tools. The rest are counted, not sent."""
    if cap is None or not isinstance(result.get("products"), list):
        return {**result, "locked_products": 0}
    products = result["products"]
    return {**result, "products": products[:cap], "locked_products": max(0, len(products) - cap)}


def _view_entry(entry: dict[str, Any], limits: dict[str, int | None]) -> dict[str, Any]:
    if entry.get("source") != "quiz":
        return entry
    return {**entry, "result": _trim(entry["result"], limits["recommendations"])}


@app.post("/v1/account/assessments")
def account_save_assessment(request: Request, payload: SaveAssessmentBody):
    user = _viewer(request)
    _same_origin(request)
    if payload.kind == "quiz":
        if not payload.session_id:
            raise HTTPException(status_code=400, detail="session_id is required for a quiz.")
        key, record = _require_session(payload.session_id, payload.session_token)
        result = _score_and_store(_load_session(key, record))
        label = payload.label or str((result.get("persona") or {}).get("name") or "AI profile")
    else:
        try:
            raw = {**(payload.intake or {}), "surface": "consumer", "externalEstimates": {}}
            intake = DecisionIntake.model_validate(raw)
        except ValidationError as exc:
            raise _invalid(exc) from exc
        decided = decide_parsed(intake)
        level = TECHNICAL_LEVEL[intake.technicalAbility]
        tools = match_tools(decided, PRODUCT_RECORDS, technical_level=level, as_of=datetime.now(timezone.utc).date())
        result = {"decision": decided, "tools": tools, "intake": intake.model_dump(mode="json")}
        label = payload.label or "Task check"
    entry = acct.save_assessment(RESULT_STORE, user, result, payload.kind, label)
    track("account_assessment_saved", metadata={"kind": payload.kind})
    limits = _limits(user)
    return _view_entry(entry, limits)


@app.get("/v1/account/profile")
def account_profile(request: Request):
    """The latest saved quiz result, trimmed to the plan's recommendation limit."""
    user = _viewer(request)
    limits = _limits(user)
    entry = next((e for e in acct.history(RESULT_STORE, user["id"]) if e.get("source") == "quiz"), None)
    return {"entry": _view_entry(entry, limits) if entry else None, "limits": limits}


def _when(iso: str) -> float:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


@app.get("/v1/account/history")
def account_history(request: Request):
    user = _viewer(request)
    limits = _limits(user)
    rows = acct.history(RESULT_STORE, user["id"])
    hidden = 0
    if limits["history_days"] is not None:
        cutoff = datetime.now(timezone.utc).timestamp() - limits["history_days"] * 86400
        kept = [r for r in rows if _when(r["saved_at"]) >= cutoff]
        hidden, rows = len(rows) - len(kept), kept
    return {"items": [_view_entry(r, limits) for r in rows], "hidden_older": hidden, "limits": limits}


@app.delete("/v1/account/history/{entry_id}")
def account_history_delete(request: Request, entry_id: str):
    user = _viewer(request)
    _same_origin(request)
    if not acct.delete_history_entry(RESULT_STORE, user["id"], entry_id[:64]):
        raise HTTPException(status_code=404, detail="Unknown entry.")
    return {"deleted": True}


@app.get("/v1/account/saved")
def account_saved(request: Request):
    user = _viewer(request)
    limits = _limits(user)
    return {"items": acct.saved(RESULT_STORE, user["id"]), "limit": limits["saved_items"]}


@app.post("/v1/account/saved")
def account_saved_add(request: Request, payload: dict[str, Any] = Body(...)):
    user = _viewer(request)
    _same_origin(request)
    try:
        item = acct.SavedItemInput.model_validate(payload)
        limits = _limits(user)
        return acct.add_saved(RESULT_STORE, user["id"], item, limits["saved_items"])
    except ValidationError as exc:
        raise _invalid(exc) from exc
    except acct.AccountError as exc:
        raise _fail(exc) from exc


@app.delete("/v1/account/saved/{item_id}")
def account_saved_remove(request: Request, item_id: str):
    user = _viewer(request)
    _same_origin(request)
    if not acct.remove_saved(RESULT_STORE, user["id"], item_id[:64]):
        raise HTTPException(status_code=404, detail="Unknown item.")
    return {"deleted": True}


@app.get("/v1/account/compare")
def account_compare(request: Request, ids: str):
    """Registry records side by side. Free plan: two at a time while billing is on."""
    user = _viewer(request)
    limits = _limits(user)
    wanted = [i for i in dict.fromkeys(ids.split(",")) if i][:12]
    cap = limits["compare_tools"]
    if cap is not None and len(wanted) > cap:
        message = f"The Free plan compares {cap} tools at a time. Upgrade to Pro to compare more."
        raise _fail(acct.AccountError("limit", message))
    by_id = {p["id"]: p for p in PRODUCT_RECORDS}
    return {"items": [by_id[i] for i in wanted if i in by_id], "unknown": [i for i in wanted if i not in by_id]}


@app.post("/v1/account/package")
def account_package(request: Request):
    """The full setup package for the account's current profile. Counts against the Free plan's monthly allowance."""
    user = _viewer(request)
    _same_origin(request)
    entry = next((e for e in acct.history(RESULT_STORE, user["id"]) if e.get("source") == "quiz"), None)
    if not entry:
        raise _fail(acct.AccountError("not_found", "Take the assessment and save it to your account first."))
    try:
        filename, blob, manifest = build_bundle(entry["result"])
    except BundleValidationError as exc:
        raise HTTPException(status_code=422, detail={"error": "Export failed validation.", "failures": exc.failures}) from exc
    try:
        bill.consume_package(RESULT_STORE, BILLING, user["id"])
    except acct.AccountError as exc:
        raise _fail(exc) from exc
    track("bundle_built", metadata={"files": len(manifest["files"]), "redacted": manifest["secretsRedacted"]})
    return {"filename": filename, "content": base64.b64encode(blob).decode("ascii"), "encoding": "base64", "manifest": manifest}


@app.get("/v1/account/export")
def account_export(request: Request):
    return acct.export_account(RESULT_STORE, _viewer(request))


@app.delete("/v1/account")
def account_delete(request: Request, response: Response):
    user = _viewer(request)
    _same_origin(request)
    acct.delete_account(RESULT_STORE, user, _token(request))
    response.delete_cookie(SESSION_COOKIE, path="/")
    track("account_deleted")
    return {"deleted": True}


@app.get("/v1/account/billing")
def account_billing(request: Request):
    user = _viewer(request)
    ent = bill.read_entitlements(RESULT_STORE, user["id"])
    return {**bill.account_summary(BILLING, ent), "payments": list(reversed(ent.get("payments", [])))}


@app.post("/v1/account/billing/checkout")
def account_checkout(request: Request):
    user = _viewer(request)
    _same_origin(request)
    ent = bill.read_entitlements(RESULT_STORE, user["id"])
    if BILLING.enabled and bill.subscription_state(ent) in ("active", "canceling"):
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "You already have Pro."})
    # One checkout per account per minute, so a double click does not open two sessions.
    key = f"pro-{user['id']}-{int(datetime.now(timezone.utc).timestamp() // 60)}"
    try:
        session = bill.create_checkout(BILLING, user, key)
    except acct.AccountError as exc:
        raise _fail(exc) from exc
    track("checkout_started", metadata={"product": "consumer-pro"})
    return {"url": session["url"], "id": session["id"]}


@app.get("/v1/account/billing/checkout/{session_id}")
def account_checkout_status(request: Request, session_id: str):
    user = _viewer(request)
    if not all(c.isalnum() or c == "_" for c in session_id) or len(session_id) > 64:
        raise HTTPException(status_code=400, detail="Bad session id.")
    return {"status": bill.checkout_status(RESULT_STORE, user["id"], session_id)}


@app.post("/v1/billing/webhook")
async def billing_webhook(request: Request):
    if not BILLING.enabled or not BILLING.webhook_secret:
        raise HTTPException(status_code=503, detail=BILLING.reason)
    raw = await request.body()
    try:
        event = bill.verify_signature(raw, request.headers.get("stripe-signature"), BILLING.webhook_secret)
    except acct.AccountError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    result = bill.handle_event(RESULT_STORE, event, expect_livemode=BILLING.mode == "live")
    if result["status"] == "in_progress":
        raise HTTPException(status_code=409, detail=result["detail"])
    return {"received": True, **result}
