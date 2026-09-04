"""Provider-neutral evaluation harness.

Records dated run metadata. Does not write registry updates automatically.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import typer
from rich.console import Console

from aifit.engine import repo_root, score_session
from aifit.models import AssessmentSession, FitFilters
from aifit.registry import load_models, load_products, validate_models, validate_products

app = typer.Typer(no_args_is_help=True)
console = Console()


def _evals_root() -> Path:
    return repo_root() / "evals"


@app.command("init-run")
def init_run(provider: str, target: str, workload: str, evaluator: str = "human"):
    """Create a dated evaluation run stub that still requires human review."""
    day = date.today().isoformat()
    run_dir = _evals_root() / "runs" / f"{day}-{provider}-{target}"
    run_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "provider": provider,
        "product_or_model": target,
        "workload": workload,
        "date": day,
        "settings": {},
        "evaluator": evaluator,
        "raw_outputs": [],
        "rubric_scores": {},
        "human_review": None,
        "notes": "Do not promote this run into the registry until human_review is recorded.",
        "promoted_to_registry": False,
    }
    path = run_dir / "run.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    console.print(f"Wrote {path}")


@app.command("validate-seed")
def validate_seed():
    root = repo_root()
    products = load_products(root / "data/registry/products.json")
    models = load_models(root / "data/registry/models.json")
    errors = validate_products(products) + validate_models(models)
    if errors:
        for error in errors:
            console.print(f"[red]{error}[/red]")
        raise typer.Exit(1)
    console.print(f"[green]{len(products)} products, {len(models)} models, all dated and evidenced.[/green]")


@app.command("run-cases")
def run_cases():
    """Score fixture cases. Failures are expected until a case has explicit expect blocks."""
    root = repo_root()
    products = {p.id: p for p in load_products(root / "data/registry/products.json")}
    failures: list[str] = []
    for path in sorted((_evals_root() / "cases").glob("*.json")):
        case = json.loads(path.read_text())
        session_file = case.get("session_file", "examples/sample_session.json")
        session = AssessmentSession.model_validate_json((root / session_file).read_text())
        filters = FitFilters(**case["filters"]) if case.get("filters") else None
        result = score_session(session, filters=filters)
        expect = case.get("expect") or {}
        if not expect:
            console.print(f"[yellow]skip[/yellow] {case.get('id', path.name)} (no expect block)")
            continue
        metrics = {m["name"]: m["score"] for m in result["metrics"]}
        if "min_source_demand" in expect and metrics.get("evidence_seeking", 0) < expect["min_source_demand"]:
            failures.append(f"{case['id']}: evidence_seeking too low")
        if expect.get("stack_ids_include") and not result["primary_stack"]["slots"]:
            failures.append(f"{case['id']}: missing primary stack slots")
        if expect.get("no_cloud_only_products"):
            for rec in result["products"]:
                deployment = set(products[rec["id"]].deployment)
                if not deployment & {"local", "self_hosted", "on_prem"}:
                    failures.append(f"{case['id']}: cloud product {rec['id']} survived local_only")
    if failures:
        for row in failures:
            console.print(f"[red]{row}[/red]")
        raise typer.Exit(1)
    console.print("[green]Eval cases passed.[/green]")


if __name__ == "__main__":
    app()
