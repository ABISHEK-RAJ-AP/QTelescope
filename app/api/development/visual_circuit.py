from typing import Any, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.development._auth import require_dev_permission
from app.core.rbac import get_current_role
from app.services.oqasm3_compat import downgrade_oqasm3_to_qasm2
from app.services.simple_qasm import qasm_to_visual, visual_to_qasm
from app.studio.platform_config import get_studio_platform_config

router = APIRouter(prefix="/visual-circuit", tags=["visual-circuit"])


class VisualCircuitBody(BaseModel):
    num_qubits: int = Field(ge=1, le=32)
    columns: list = Field(default_factory=list)


class QasmParseBody(BaseModel):
    source_text: str = ""


@router.get("/gate-palette")
def gate_palette(role: str = Depends(get_current_role)) -> Dict[str, Any]:
    require_dev_permission(role, "studio:read")
    cfg = get_studio_platform_config()
    return {"gates": cfg.get("gate_palette", [])}


@router.post("/to-qasm")
def visual_to_qasm_route(body: VisualCircuitBody, role: str = Depends(get_current_role)):
    require_dev_permission(role, "circuits:update")
    qasm = visual_to_qasm(body.num_qubits, body.columns)
    return {"source_language": "openqasm2", "source_text": qasm}


@router.post("/from-qasm")
def qasm_to_visual_route(body: QasmParseBody, role: str = Depends(get_current_role)):
    require_dev_permission(role, "circuits:read")
    text = body.source_text or ""
    q2 = downgrade_oqasm3_to_qasm2(text)
    if q2:
        text = q2
    out = qasm_to_visual(text)
    if q2:
        out["import_meta"] = {"openqasm3_downgraded": True, "parsed_as": "openqasm2"}
    return out
