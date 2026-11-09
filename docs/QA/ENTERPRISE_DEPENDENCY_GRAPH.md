# Enterprise implementation dependency graph

**Companion:** [ENTERPRISE_IMPLEMENTATION_BACKLOG.md](ENTERPRISE_IMPLEMENTATION_BACKLOG.md)

Build order: top → bottom (foundations first).

```mermaid
flowchart TB
  subgraph foundations [P0 Foundations]
    PROV[Data provenance labels]
    RBAC[Auth RBAC MFA]
    REQID[Request ID correlation]
    AUDIT[Audit events JSONL]
  end

  subgraph collect [Collection layer]
    COLL[Collectors scheduler]
    EXEC[Execution history JSONL]
    QUAL[Ingestion quality JSONL]
    DLQ[Collector DLQ]
    CB[Circuit breaker per provider]
  end

  subgraph identity [Resource identity]
    BACK[Backends ORM]
    CAT[Catalog owner facility tags]
    FAC[Facility scope - future]
  end

  subgraph observe [Observability UX]
    LOGS[Unified log index]
    MET[Metrics explorer]
    PAL[Command palette entity search]
    PH[Platform Health]
  end

  subgraph ops [Operations]
    ALERT[Alert rules engine]
    INC[Incidents]
    NOTIFY[Notification routing]
    COMP[Composite alerts]
  end

  subgraph intel [Quantum intelligence]
    CAL[Calibration snapshots]
    CALCMP[Revision compare]
    JOB[Job records]
    RECON[Workload-calibration link]
  end

  subgraph evidence [Evidence]
    RPT[Reports exports]
    EVZIP[Evidence packages]
  end

  RBAC --> LOGS
  RBAC --> CAT
  REQID --> LOGS
  AUDIT --> LOGS

  COLL --> EXEC
  COLL --> QUAL
  COLL --> DLQ
  COLL --> CB
  EXEC --> PH
  QUAL --> PH
  CB --> PH

  BACK --> CAT
  BACK --> MET
  BACK --> PAL
  CAT --> FAC

  PROV --> QUAL
  PROV --> CAL
  QUAL --> ALERT
  EXEC --> ALERT

  LOGS --> INC
  ALERT --> INC
  COMP --> INC
  NOTIFY --> INC

  CAL --> CALCMP
  CAL --> RECON
  JOB --> RECON

  INC --> RPT
  RECON --> RPT
  RPT --> EVZIP
```

## Dependency rules (text)

| Feature | Depends on |
| --- | --- |
| Unified Logs Explorer | Structured logging, request ID, retention policy, RBAC |
| Alert → logs | Log index by backend/time/request_id; alert timestamps |
| 30d execution API | Durable store + retention (D05); today JSONL trim only |
| Rich ingestion quality | Per-cycle counters from collectors; no fabricated expected counts |
| SLO / error budget | SLI job + historical measurements (B6) |
| Composite alerts | Stable alert IDs + evaluation window |
| Facility-scoped search | Facility on catalogue + query filters in API (not UI-only) |
| Workload–calibration | Snapshot history + job timestamps + explicit match semantics |
| Dependency map | Real FKs: provider → backend → telemetry → alert → incident |

## Parallel safe work

After Gate 0, these can proceed in parallel **if** contracts are agreed:

- EnterpriseDataTable rollout (UI-only, same APIs)
- UX terminology pass (Prompt 10)
- Vitest/Playwright for **new** links only

## Blocked edges

| Edge | Blocker |
| --- | --- |
| OTel trace UI | Exporter + collector config |
| Live provider E2E | Credentials (QT-06) |
| Backup restore proof | VM drill (D06, T12) |
| Postgres production | D01 NOT_VERIFIED |
