"""Optional facility MQTT subscriber — JSON payloads into facility env store."""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Dict, List, Optional

_log = logging.getLogger(__name__)

_lock = threading.Lock()
_state: Dict[str, Any] = {
    "status": "DISABLED",
    "broker": None,
    "topic": None,
    "messages_received": 0,
    "last_error": None,
    "connected": False,
}

_client = None
_thread: Optional[threading.Thread] = None


def _broker_configured() -> bool:
    return bool(os.getenv("FACILITY_MQTT_BROKER", "").strip())


def _enabled() -> bool:
    raw = os.getenv("FACILITY_MQTT_ENABLED", "").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    return _broker_configured()


def _parse_payload(raw: bytes) -> List[Dict[str, Any]]:
    data = json.loads(raw.decode("utf-8"))
    if isinstance(data, dict) and "records" in data:
        recs = data["records"]
    elif isinstance(data, list):
        recs = data
    elif isinstance(data, dict):
        recs = [data]
    else:
        raise ValueError("MQTT payload must be object, list, or {records: [...]}")
    if not isinstance(recs, list):
        raise ValueError("records must be a list")
    return recs


def _on_message(_client, _userdata, msg) -> None:
    try:
        from app.facility.ingest import append_records

        records = _parse_payload(msg.payload)
        added, errors = append_records(records, source="mqtt")
        with _lock:
            _state["messages_received"] = int(_state.get("messages_received") or 0) + added
            if errors:
                _state["last_error"] = "; ".join(errors[:3])[:500]
    except Exception as exc:
        with _lock:
            _state["last_error"] = str(exc)[:500]
        _log.warning("facility mqtt message dropped: %s", exc)


def start_mqtt_subscriber() -> None:
    global _client, _thread
    if not _enabled():
        with _lock:
            _state.update(
                {
                    "status": "DISABLED",
                    "broker": None,
                    "topic": None,
                    "connected": False,
                    "note": "Set FACILITY_MQTT_BROKER (and optionally FACILITY_MQTT_TOPIC) to enable.",
                }
            )
        return

    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        with _lock:
            _state.update(
                {
                    "status": "NEEDS_CLIENT",
                    "broker": os.getenv("FACILITY_MQTT_BROKER"),
                    "connected": False,
                    "note": "Install paho-mqtt (pip install paho-mqtt) to enable MQTT ingest.",
                }
            )
        return

    broker = os.getenv("FACILITY_MQTT_BROKER", "").strip()
    topic = os.getenv("FACILITY_MQTT_TOPIC", "qtelescope/facility/env").strip()
    port = int(os.getenv("FACILITY_MQTT_PORT", "1883"))
    user = os.getenv("FACILITY_MQTT_USERNAME", "").strip() or None
    password = os.getenv("FACILITY_MQTT_PASSWORD", "").strip() or None

    def _run() -> None:
        global _client
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        except AttributeError:
            client = mqtt.Client()
        if user:
            client.username_pw_set(user, password)

        def _on_connect(_c, _u, _f, rc, *_extra) -> None:
            code = rc if isinstance(rc, int) else getattr(rc, "value", 1)
            _set_connected(code == 0)

        def _set_connected(ok: bool) -> None:
            with _lock:
                _state["connected"] = ok
                _state["status"] = "LIVE" if ok else "ERROR"
                if not ok:
                    _state["last_error"] = "MQTT connect failed"

        client.on_connect = _on_connect
        client.on_message = _on_message

        try:
            client.connect(broker, port, keepalive=60)
        except Exception as exc:
            with _lock:
                _state.update({"status": "ERROR", "last_error": str(exc)[:500], "connected": False})
            return
        _client = client
        with _lock:
            _state.update(
                {
                    "status": "CONNECTING",
                    "broker": broker,
                    "topic": topic,
                    "connected": False,
                    "note": "Subscribes to JSON facility samples; no synthetic readings.",
                }
            )
        client.subscribe(topic)
        client.loop_forever()

    _thread = threading.Thread(target=_run, name="facility-mqtt", daemon=True)
    _thread.start()


def stop_mqtt_subscriber() -> None:
    global _client
    if _client is not None:
        try:
            _client.disconnect()
        except Exception:
            pass
        _client = None
    with _lock:
        if _state.get("status") not in ("DISABLED", "NEEDS_CLIENT"):
            _state["status"] = "STOPPED"
        _state["connected"] = False


def mqtt_runtime_status() -> Dict[str, Any]:
    with _lock:
        out = dict(_state)
    if out.get("status") == "DISABLED" and _broker_configured() and not _enabled():
        out["note"] = "Broker set but FACILITY_MQTT_ENABLED=false."
    return out
