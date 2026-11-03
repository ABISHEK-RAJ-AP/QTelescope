import json

from app.facility.mqtt_subscriber import _parse_payload


def test_mqtt_payload_records_wrapper():
    raw = json.dumps({"records": [{"backend_id": "b1", "channel": "cryo_temp_mK", "value": 12.0}]}).encode()
    recs = _parse_payload(raw)
    assert len(recs) == 1
    assert recs[0]["backend_id"] == "b1"


def test_mqtt_payload_single_object():
    raw = json.dumps({"backend_id": "b1", "channel": "vacuum_mbar", "value": 1e-9}).encode()
    recs = _parse_payload(raw)
    assert recs[0]["channel"] == "vacuum_mbar"
