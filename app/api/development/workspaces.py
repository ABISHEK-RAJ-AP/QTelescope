from fastapi import APIRouter

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("")
def list_workspaces():
    return {
        "workspaces": [
            {
                "id": "build",
                "display_name": "Development Studio",
                "url": "/build/",
                "description": "IDE, SDK, circuits, compilation, simulation",
            },
            {
                "id": "observe",
                "display_name": "Q-TeleScope",
                "url": "/",
                "description": "Telemetry, health, incidents, evidence",
            },
            {
                "id": "govern",
                "display_name": "Resource Governance",
                "url": "/govern/",
                "description": "Approvals, quotas, inventory",
                "status": "planned",
            },
        ]
    }
