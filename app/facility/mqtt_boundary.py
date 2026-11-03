"""Facility MQTT ingest boundary."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable

from app.facility.mqtt_subscriber import mqtt_runtime_status, start_mqtt_subscriber


class FacilityMqttAdapter(ABC):
    """Subscribe-only facility telemetry; implementations must not fabricate readings."""

    @abstractmethod
    def connect(self, broker_url: str) -> None:
        raise NotImplementedError("Use FACILITY_MQTT_BROKER env + app lifespan subscriber")

    @abstractmethod
    def subscribe(self, topic: str, on_message: Callable[[bytes], None]) -> None:
        raise NotImplementedError("Use FACILITY_MQTT_TOPIC env + app lifespan subscriber")


class NotBuiltFacilityMqtt(FacilityMqttAdapter):
    """Legacy placeholder — prefer env-driven subscriber via start_mqtt_subscriber()."""

    def connect(self, broker_url: str) -> None:
        if not broker_url:
            raise NotImplementedError(
                "Configure FACILITY_MQTT_BROKER or use POST /environment/ingest / inbox scan."
            )
        start_mqtt_subscriber()

    def subscribe(self, topic: str, on_message: Callable[[bytes], None]) -> None:
        raise NotImplementedError(
            "MQTT uses the app subscriber; set FACILITY_MQTT_TOPIC or POST /environment/ingest."
        )


def mqtt_ingest_status() -> dict:
    rt = mqtt_runtime_status()
    status = rt.get("status") or "DISABLED"
    note = rt.get("note") or ""
    if status == "LIVE":
        note = (
            f"Connected to {rt.get('broker')} topic {rt.get('topic')}. "
            f"{rt.get('messages_received', 0)} sample(s) ingested."
        )
    elif status == "DISABLED":
        note = note or "REST + JSON inbox ingest are live; MQTT optional via FACILITY_MQTT_BROKER."
    return {
        "status": status,
        "connected": bool(rt.get("connected")),
        "broker": rt.get("broker"),
        "topic": rt.get("topic"),
        "messages_received": rt.get("messages_received", 0),
        "last_error": rt.get("last_error"),
        "note": note,
        "alternatives": ["/api/v1/environment/ingest", "/api/v1/environment/inbox/scan"],
        "env": {
            "FACILITY_MQTT_BROKER": "host or host:port",
            "FACILITY_MQTT_TOPIC": "default qtelescope/facility/env",
            "FACILITY_MQTT_ENABLED": "default on when broker set",
        },
    }
