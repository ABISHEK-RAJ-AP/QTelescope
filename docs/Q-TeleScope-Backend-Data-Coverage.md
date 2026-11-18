# Q-TeleScope backend data coverage (honesty matrix)

What each **live** adapter can collect vs what the UI may still show (advisory math, demo paths, or partial public APIs). Demo mode (`ENABLE_MOCK_DATA`, `data/collector_health.json`) is intentional synthetic data for lab/VM runs — labels should say **Demo catalog** or **Live ingest**, not ambiguous **Unknown**.

**VM hybrid demo** (`HYBRID_DEMO_ENABLED=true`, `DEMO_LIVE_PROVIDERS=rigetti_quantum`, `COLLECTION_SCHEDULER_ENABLED=true`): IBM / IonQ / C-DAC use **simulated** catalog only; **Rigetti** polls the public QCS ISA every `RIGETTI_ISA_CACHE_SECONDS` (default 45s on VM scripts). “Realtime” here means **scheduled ingest**, not sub-second vendor queue streaming.

| Provider | Adapter | Typical lineage (demo VM) | Collected today | Not from vendor (UI must not imply) |
|----------|---------|---------------------------|-----------------|-------------------------------------|
| **IBM Quantum** | `ibm_adapter` | `simulated` in demo | Backend list, queue hints when token present, calibration-shaped metrics in mock path | Per-qubit live stream without token; mock queue depth is not IBM ops truth |
| **Rigetti QCS** | `rigetti_adapter` | `live` (public ISA) | Processor id, qubit count, coupling graph, partial T1/T2 / readout from published ISA benchmarks | Real-time queue, job logs, per-shot calibration — QCS OpenAPI does not expose full ops telemetry without deeper integration |
| **IonQ** | `ionq_adapter` | `simulated` in demo | Backend metadata via API when keyed; degraded mock when not | Guaranteed live queue unless API key configured |
| **C-DAC / on-prem** | `onprem_adapter` | `simulated` | Lab file ingest contract (`data/onprem/`) | Cloud vendor SLA fields |

## Rigetti Cepheus-1-108Q (example)

- **Qubit count** (~107–108) comes from public ISA topology — plausible and consistent with product name.
- **Many qubits “Unknown” in routing bar** is expected when ISA lists couplings but not every qubit has T1/T2 in the snapshot. Health router marks missing T1 as **UNKNOWN** (never GREEN) — not “broken qubits.”
- **Routing RED** on workspace is **advisory** (rule engine on stored metrics), not Rigetti’s operational health page.
- **“Source pending”** on lineage = collector platform-health has no row for that `provider_id` yet — not “fake backend.”

## Adapter verification

Run contract tests (mock-friendly):

```bash
ENABLE_MOCK_DATA=true pytest tests/test_adapter_contract.py -q
pytest tests/test_rigetti_isa.py -q   # if present
```

Live harness (optional, needs credentials):

```bash
python -m app.providers.live_harness --provider rigetti_quantum
```

## Production showcase — what to buy (honest economics)

You do not buy a QPU for a monitoring demo; you buy **cloud access + API keys**. Ranked for Q-TeleScope “show everything” (queue, jobs, calibration-shaped telemetry):

| Option | Typical cost | What goes live in Q-TeleScope | Gaps |
|--------|----------------|------------------------------|------|
| **Rigetti QCS public ISA** | **$0** | Topology, partial T1/T2, coupling (hybrid VM default) | No queue/jobs on public OpenAPI; some qubits lack T1/T2 → UI **Unknown** |
| **IBM Quantum (Open / free tier)** | **$0–low** with token | Backend list, runtime jobs, calibration jobs when token valid | Rate limits; not your hardware |
| **IonQ Cloud API** | **Paid plans** from ~hundreds/mo | Backend metadata, jobs when keyed | Needs `IONQ_API_KEY`; no on-prem box |
| **AWS Braket** | **Pay per task** | Multi-vendor jobs + metadata via AWS | AWS account + IAM; adapter wiring beyond demo stubs |
| **On-prem simulator (C-DAC PARAM)** | **Lab cost** | File/MQTT ingest you control | Not vendor cloud “realtime” unless you drive the feed |

**Recommended ladder for C-DAC demo → production story:**

1. **Today:** hybrid demo — **Rigetti live ISA** + simulated IBM/IonQ/C-DAC (no spend).
2. **Next step for queues/jobs:** add **IBM Quantum token** (`IBM_QUANTUM_TOKEN`) and set `DEMO_LIVE_PROVIDERS=rigetti_quantum,ibm_quantum` (IBM still hits cloud; others mock).
3. **Paid “full vendor console” feel:** IonQ or Braket key + adapter completion — budget cloud quota, not capital hardware.

## UI copy rules

1. **Routing** — advisory router state (RED/YELLOW/GREEN/UNKNOWN).
2. **Operational status** — catalog/last poll (`ONLINE` / `OFFLINE` / etc.).
3. **Demo catalog / Live ingest** — collector lineage from `GET /operations/platform-health`.
4. Prefer “Not reported” over invented queue/calibration numbers when adapter returns null.