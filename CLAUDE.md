# CLAUDE.md

Read `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, and all files in `docs/` before major implementation changes.

Use the prompts in `prompts/` sequentially.

## Engineering conventions

- Python 3.12+
- Type hints required
- Pydantic models for external schemas
- Pure functions where practical in scoring
- pytest for Python tests
- Avoid hidden scoring constants; centralize weights
- Every registry item must have evidence metadata and freshness metadata
- Prefer small composable modules
- Preserve provider neutrality

When implementing frontend code, keep scoring logic server-side or in the core package; do not duplicate recommendation logic in React.
