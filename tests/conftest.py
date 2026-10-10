from __future__ import annotations

import os
import tempfile

# Point the API's result store at a throwaway folder before services.api is
# imported, so tests never read or write the shared /tmp/aifit-store.
os.environ.setdefault("AIFIT_STORE", tempfile.mkdtemp(prefix="aifit-test-store-"))
for name in ("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"):
    os.environ.pop(name, None)
