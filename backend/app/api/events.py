import asyncio
import json
import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/events", tags=["Live Telemetry Stream"])

@router.get("/stream")
async def sse_telemetry_stream():
    """
    Pushes live periodic telemetry telemetry ticks to web frontend via Server-Sent Events.
    """
    async def event_generator():
        while True:
            data = {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "event_type": "TELEMETRY_TICK",
                "status": "ONLINE",
                "message": "Live telemetry streaming active"
            }
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(5) # Push update every 5 seconds

    return StreamingResponse(event_generator(), media_type="text/event-stream")
