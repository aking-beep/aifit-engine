import os

import pytest

from services.api.limits import LIMITER


@pytest.fixture(autouse=True)
def _isolate_rate_limits(monkeypatch: pytest.MonkeyPatch):
    if "FIT_RATE_LIMIT_PER_MINUTE" not in os.environ:
        monkeypatch.setenv("FIT_RATE_LIMIT_PER_MINUTE", "10000")
    LIMITER.reset()
    yield
    LIMITER.reset()
