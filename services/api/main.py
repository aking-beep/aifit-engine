from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/core/src"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from aifit.engine import normalize_free_text, score_session
from aifit.exports import export_persona
from aifit.fit import rank_models_by_workload, rank_products
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


@app.get("/health")
def health():
    return {"ok": True, "version": "0.1.0"}


@app.get("/v1/scenarios")
def scenarios():
    return [s.model_dump() for s in load_scenarios()]


@app.post("/v1/sessions")
def create_session():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = AssessmentSession(session_id=session_id, events=[])
    return {"session_id": session_id, "events": []}


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
    return {"session_id": session_id, "event_count": len(session.events)}


@app.post("/v1/sessions/{session_id}/score")
def score_stored_session(session_id: str):
    session = SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    return score_session(session)


@app.delete("/v1/sessions/{session_id}")
def delete_session(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Unknown session")
    del SESSIONS[session_id]
    return {"deleted": True, "session_id": session_id}


@app.post("/v1/score")
def score(session: AssessmentSession):
    SESSIONS[session.session_id] = session
    return score_session(session)


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


@app.post("/v1/persona")
def persona(payload: PersonaRequest):
    user = UserFitVector(values=payload.values, confidence=payload.confidence)
    return generate_persona(user)


@app.post("/v1/export/{target}")
def export(target: str, payload: ExportRequest):
    allowed = {"generic", "claude", "agents", "cursor", "json"}
    if target not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown export target: {target}")
    filename, body = export_persona(payload.persona, target)
    return {"filename": filename, "content": body}
