# Device capabilities (Q-TeleScope)

Normalized per-backend sheets: status, queue depth, coherence (T1/T2), gates,
coupling map. Used by Resources → Device capabilities and `/api/v1/device-capabilities`.

## Why

Operators need one exportable shape across IBM / IonQ / Rigetti / C-DAC without
vendor-specific property names in the UI.

## Status refinement

| Reported | Queue | Sheet status |
|---|---|---|
| ONLINE | 0 | IDLE |
| ONLINE | >0 | BUSY |
| OFFLINE | * | OFFLINE |
| MAINTENANCE | * | MAINTENANCE |
| CALIBRATING freshness | * | CALIBRATION |

## API

- `GET /api/v1/device-capabilities/coverage`
- `GET /api/v1/device-capabilities/devices`
- `GET /api/v1/device-capabilities/devices/{backend_id}`

## Internal notes (not product copy)

Research against open quantum stacks informed the property set (device / site /
operation / job). Product naming stays Q-TeleScope. See `vendor/` READMEs for
offline research snapshots only — nothing from those brands is shown in the UI.
