# Quantum observability gap report

**Date:** 2026-11-09 · Primary benchmark: **IBM Quantum Platform**

## Implemented today

| IBM theme | Q-TeleScope | Evidence |
| --- | --- | --- |
| Compute inventory | Yes | `BackendInventory`, providers table |
| QPU status / queue | Yes | Status + `QueueMonitoring` |
| Qubit properties | Yes | `QubitMonitoring`, health vector APIs |
| T1/T2 / readout | Yes | Calibration + drift pages |
| Topology | Yes | `TopologyExplorer.jsx`, `topology.py` |
| Capabilities / instructions | Partial | `DeviceCapabilities.jsx`, device-capabilities API |
| Calibration history | Partial | `CalibrationTimeline`, snapshots |
| Trends / replay | Yes | `HistoricalTrends`, `TemporalReplay` |
| Mock vs live lineage | Partial | `provenance.py`, lineage tags in UI |
| Gate-level errors | Partial | Not full instruction observability |
| CLOPS / MCPS | Not established | — |
| Benchmarking module | No | — |
| “Stale ≠ 100% error” UX | Partial | Stale labels exist; D09 FAIL |

## Critical IBM lesson to enforce

Unavailable or **stale** calibration must **not** display as a measured 100% error rate. Audit all charts/tables for implicit zero-fill.

**Files to harden:** normalizers, `CalibrationStatus`, `ResourceHealth`, dashboard KPI derivations.

## P2 quantum modules (Release D)

1. **Hardware capability registry** — versioned JSON per backend (provider-native + normalized).  
2. **Instruction-level observability** — gate duration/error per edge.  
3. **Calibration intelligence panel** — last measured vs last calibration update vs policy.  
4. **Benchmarking centre** — RB/TWIR/etc. where provider exposes; modality-gated catalog.  
5. **Suitability advisor** — read-only match of workload requirements vs capabilities (no auto-submit).  
6. **Workload–calibration reconstruction** — link job epoch to calibration revision in replay.

## Facility linkage

`EnvironmentPage` + MQTT path — extend to correlation “facility sensor degraded ≠ qubit fault” in health engine.
