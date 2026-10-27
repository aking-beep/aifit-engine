from __future__ import annotations

import base64
import hashlib
import hmac
import json
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
from aifit.analytics import summary as analytics_summary
from aifit.analytics import track
from aifit.classifier import classify_text
from aifit.decision import DecisionIntake, decide_parsed, match_tools
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
    from aifit.exports import export_pack_zip

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
            filename, blob = export_pack_zip(result)
            return {"filename": filename, "content": base64.b64encode(blob).decode("ascii"), "encoding": "base64"}
        filename, body = export_persona(persona_payload, target, result)
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="That result is missing fields this export needs.") from exc
    return {"filename": filename, "content": body, "encoding": "text"}


@app.post("/v1/feedback")
def feedback(payload: FeedbackRequest):
    row = payload.model_dump()
    row["id"] = str(uuid.uuid4())
    RESULT_STORE.put("feedback", row["id"], row)
    RESULT_STORE.incr("feedback")
    track("feedback", session_id=payload.session_id)
    return {"ok": True, "id": row["id"]}


@app.get("/v1/analytics/summary")
def analytics():
    return {**analytics_summary(), "feedback_count": RESULT_STORE.count("feedback")}


# Decision ------------------------------------------------------------------
#
# "Should I use AI for this at all?" Five outcomes from the shared rules in
# packages/decision-core. Stateless: nothing in the request is stored. The
# surface is forced to consumer and caller-supplied estimates are dropped, so a
# request cannot claim to be a Teams assessment or inject its own cost figures.

TECHNICAL_LEVEL = {"none": 0.15, "basic": 0.35, "intermediate": 0.6, "advanced": 0.85}


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
