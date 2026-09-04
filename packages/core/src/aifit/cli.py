from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from .engine import registry_errors, repo_root, score_session
from .exports import export_persona
from .models import AssessmentSession

app = typer.Typer(no_args_is_help=True)
console = Console()


@app.command()
def score(session_file: str):
    """Score an assessment session and print recommendations."""
    session = AssessmentSession.model_validate(json.loads(Path(session_file).read_text()))
    result = score_session(session)

    table = Table(title="Interaction Metrics")
    table.add_column("Metric")
    table.add_column("Score")
    table.add_column("Confidence")
    for metric in result["metrics"]:
        table.add_row(metric["name"], f"{metric['score']:.2f}", f"{metric['confidence']:.2f}")
    console.print(table)

    ptable = Table(title="Top Product Matches")
    ptable.add_column("Product")
    ptable.add_column("Category")
    ptable.add_column("Fit")
    for rec in result["products"][:8]:
        ptable.add_row(rec["name"], rec.get("category") or "", f"{rec['fit']:.2f}")
    console.print(ptable)

    for workload, ranked in result["models"].items():
        if ranked:
            console.print(f"[bold]{workload}[/bold]: {ranked[0]['name']} ({ranked[0]['fit']:.2f})")

    console.print("\n[bold]Persona[/bold]")
    console.print_json(data=result["persona"])


@app.command()
def export(session_file: str, target: str = "generic"):
    """Write a persona export from a scored session."""
    session = AssessmentSession.model_validate(json.loads(Path(session_file).read_text()))
    result = score_session(session)
    filename, body = export_persona(result["persona"], target)
    Path(filename).write_text(body)
    console.print(f"Wrote {filename}")


@app.command("validate-registry")
def validate_registry():
    """Validate product and model registry files."""
    errors = registry_errors()
    total = len(errors["products"]) + len(errors["models"])
    if total == 0:
        console.print("[green]Registry valid.[/green]")
        raise typer.Exit(0)
    for kind, rows in errors.items():
        for row in rows:
            console.print(f"[red]{kind}[/red] {row}")
    raise typer.Exit(1)


@app.command()
def root():
    """Print the detected repository root."""
    console.print(str(repo_root()))


if __name__ == "__main__":
    app()
