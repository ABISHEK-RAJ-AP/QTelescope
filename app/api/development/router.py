from fastapi import APIRouter

from app.api.development import (
    circuits,
    compilation,
    device_selection,
    estimation,
    execution_targets,
    experiment_reports,
    preflight,
    projects,
    simulation,
    simulation_actions,
    studio_config,
    workload_submissions,
    visual_circuit,
    workloads,
    workspaces,
)

router = APIRouter()
router.include_router(workspaces.router)
router.include_router(studio_config.router)
router.include_router(visual_circuit.router)
router.include_router(execution_targets.router)
router.include_router(projects.router)
router.include_router(circuits.router)
router.include_router(compilation.router)
router.include_router(preflight.router)
router.include_router(estimation.router)
router.include_router(device_selection.router)
router.include_router(simulation.router)
router.include_router(simulation_actions.router)
router.include_router(workloads.router)
router.include_router(experiment_reports.router)
router.include_router(workload_submissions.router)
