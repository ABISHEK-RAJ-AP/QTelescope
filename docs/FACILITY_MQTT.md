# Facility MQTT boundary (IMP-P5)

**Status: optional (env-driven)**

When `FACILITY_MQTT_BROKER` is set, the API starts a background subscriber (`paho-mqtt` required). Without a broker, status is **DISABLED** — use REST or inbox JSON.

## Supported paths (live)

- `POST /api/v1/environment/ingest` — validated JSON records
- `POST /api/v1/environment/inbox/scan` — drop JSON files into facility inbox
- `GET /api/v1/environment/ingest/status`

## MQTT stub

- Code: `app/facility/mqtt_boundary.py` (`NotBuiltFacilityMqtt`)
- Admin probe: `GET /api/v1/admin/facility/mqtt-status`

Any call to connect/subscribe **must fail** — no synthetic MQTT samples in UI or DB.

## Future implementation checklist

1. Broker auth + topic ACL documented per site  
2. Schema version per message type (cryo, power, humidity)  
3. Dedup + DLQ for malformed payloads  
4. UI label `FACILITY_MQTT` with `stream_kind: vendor_push` only after real broker test  
