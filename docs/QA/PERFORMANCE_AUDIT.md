# Performance audit

| Check | Result |
| --- | --- |
| Pytest wall clock full `tests/` | ~12 min (lifespan / TestClient cost) |
| Platform health after missing-table fix | No 500; empty DB OK |
| Frontend bundle | `npm run build` not re-run this cycle |
| Redis | Optional; tests `CACHE_ENABLED=false` |
| N+1 | Not profiled |
| Polling | Not measured in browser |

No fabricated Lighthouse scores.
