from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/core/src"))

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from aifit.analytics import summary as analytics_summary
from aifit.analytics import track
from aifit.classifier import classify_text
from aifit.engine import normalize_free_text, score_session
from aifit.exports import export_persona
from aifit.fit import rank_models_by_workload, rank_products
from aifit.freshness import freshness_report
from aifit.models import AssessmentSession, FitFilters, InteractionEvent, UserFitVector
from aifit.persona import generate_persona
from aifit.registry import load_models, load_products
from aifit.scenarios import load_scenarios

app = FastAPI(title="AI Fit Engine API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PRODUCTS = load_products(ROOT / "data/registry/products.json")
MODELS = load_models(ROOT / "data/registry/models.json")
SESSIONS: dict[str, AssessmentSession] = {}
SCORES: dict[str, dict[str, Any]] = {}
SHARES: dict[str, dict[str, Any]] = {}
FEEDBACK: list[dict[str, Any]] = []


class FitRequest(BaseModel):
    values: dict[str, float]
    confidence: dict[str, float] = Field(default_factory=dict)
    filters: FitFilters | None = None


class PersonaRequest(BaseModel):
    values: dict[str, float]
    confidence: dict[str, float] = Field(default_factory=dict)


class EventBatch(BaseModel):
    events: list[InteractionEvent] = Field(default_factory=list)
    free_text: str | None = None
    scenario_id: str | None = None
    turn_id: str | None = None


class ExportRequest(BaseModel):
    persona: dict[str, Any]


class ClassifyRequest(BaseModel):
    text: str
    scenario_id: str
    turn_id: str | None = None


class FeedbackRequest(BaseModel):
    session_id: str | None = None
    share_id: str | None = None
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    useful: bool | None = None


class ScoreRequest(BaseModel):
    filters: FitFilters | None = None


def _score_and_store(session: AssessmentSession, filters: FitFilters | None = None) -> dict[str, Any]:
    result = score_session(session, filters=filters)
    SCORES[session.session_id] = result
    track("session_scored", session_id=session.session_id)
    return result


@app.get("/health")
def health():
    return {"ok": True, "version": "0.1.0", "privacy": "anonymous"}


@app.get("/v1/scenarios")
def scenarios():
    return [s.model_dump() for s in load_scenarios()]


@app.post("/v1/sessions")
def create_session():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = AssessmentSession(session_id=session_id, events=[])
    track("session_created", session_id=session_id)
    return {"session_id": session_id, "events": []}


@app.post("/v1/sessions/demo")
def demo_session():
    raw = json.loads((ROOT / "examples/sample_session.json").read_text())
    raw["session_id"] = str(uuid.uuid4())
    session = AssessmentSession.model_validate(raw)
    SESSIONS[session.session_id] = session
    result = _score_and_store(session)
    track("demo_session", session_id=session.session_id)
    return {"session_id": session.session_id, "result": result}


@app.get("/v1/sessions/{session_id}")
def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    return {
        "session": session.model_dump(),
        "result": SCORES.get(session_id),
    }


@app.post("/v1/sessions/{session_id}/events")
def add_events(session_id: str, batch: EventBatch):
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    incoming = list(batch.events)
    if batch.free_text and batch.scenario_id:
        incoming.extend(normalize_free_text(batch.free_text, batch.scenario_id, batch.turn_id))
    for event in incoming:
        if not event.scenario_id and batch.scenario_id:
            event.scenario_id = batch.scenario_id
        if not event.turn_id and batch.turn_id:
            event.turn_id = batch.turn_id
    session.events.extend(incoming)
    track("events_added", session_id=session_id, metadata={"count": len(incoming)})
    return {"session_id": session_id, "event_count": len(session.events)}


@app.post("/v1/sessions/{session_id}/score")
def score_stored_session(session_id: str, payload: ScoreRequest | None = Body(default=None)):
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    filters = payload.filters if payload else None
    return _score_and_store(session, filters)


@app.post("/v1/sessions/{session_id}/share")
def share_session(session_id: str):
    result = SCORES.get(session_id)
    if result is None:
        session = SESSIONS.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Unknown session")
        result = _score_and_store(session)
    share_id = str(uuid.uuid4())
    snapshot = {
        "share_id": share_id,
        "persona": result["persona"],
        "metrics": result["metrics"],
        "products": result["products"][:8],
        "products_by_category": result["products_by_category"],
        "models": {k: v[:2] for k, v in result["models"].items()},
        "primary_stack": result["primary_stack"],
        "alternative_stack": result["alternative_stack"],
        "user_vector": result["user_vector"],
        "disclaimer": result["disclaimer"],
        "privacy": result["privacy"],
    }
    SHARES[share_id] = snapshot
    track("session_shared", session_id=session_id)
    return {"share_id": share_id, "path": f"/share/{share_id}"}


@app.get("/v1/share/{share_id}")
def get_share(share_id: str):
    snapshot = SHARES.get(share_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Unknown share")
    return snapshot


@app.get("/v1/sessions/{session_id}/export")
def export_session(session_id: str):
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    return {
        "session": session.model_dump(),
        "result": SCORES.get(session_id),
        "notice": "This export is the anonymous session record. No name or employer is stored.",
    }


@app.delete("/v1/sessions/{session_id}")
def delete_session(session_id: str):
    if session_id not in SESSIONS and session_id not in SCORES:
        raise HTTPException(status_code=404, detail="Unknown session")
    SESSIONS.pop(session_id, None)
    SCORES.pop(session_id, None)
    track("session_deleted", session_id=session_id)
    return {"deleted": True, "session_id": session_id}


@app.post("/v1/score")
def score(session: AssessmentSession):
    SESSIONS[session.session_id] = session
    return _score_and_store(session)


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
    allowed = {"generic", "claude", "agents", "cursor", "json"}
    if target not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown export target: {target}")
    filename, body = export_persona(payload.persona, target)
    return {"filename": filename, "content": body}


@app.post("/v1/feedback")
def feedback(payload: FeedbackRequest):
    row = payload.model_dump()
    row["id"] = str(uuid.uuid4())
    FEEDBACK.append(row)
    track("feedback", session_id=payload.session_id)
    return {"ok": True, "id": row["id"]}


@app.get("/v1/analytics/summary")
def analytics():
    return {**analytics_summary(), "feedback_count": len(FEEDBACK)}
