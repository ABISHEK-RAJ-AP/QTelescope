"""Studio platform catalog — features and customization options (deployment-extensible)."""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List

# ponytail: extend by merging STUDIO_CONFIG_OVERRIDE env JSON or site file later

DEFAULT_STUDIO_CONFIG: Dict[str, Any] = {
    "schema_version": 1,
    "workspace_id": "build",
    "display_name": "Quantum Development Studio",
    "project_types": [
        {"id": "quantum_circuit", "label": "Quantum circuit", "default_source_language": "openqasm3"},
        {"id": "sdk_python", "label": "Python / Qiskit SDK", "default_source_language": "python"},
        {"id": "notebook", "label": "Notebook project", "default_source_language": "notebook"},
        {"id": "hybrid", "label": "Hybrid classical–quantum", "default_source_language": "python"},
        {"id": "custom", "label": "Custom (site-defined)", "default_source_language": "openqasm3"},
    ],
    "source_languages": [
        {"id": "openqasm3", "label": "OpenQASM 3", "extensions": [".qasm", ".oqasm"]},
        {"id": "openqasm2", "label": "OpenQASM 2", "extensions": [".qasm"]},
        {"id": "qiskit", "label": "Qiskit JSON", "extensions": [".json"]},
        {"id": "python", "label": "Python", "extensions": [".py"]},
        {"id": "notebook", "label": "Jupyter", "extensions": [".ipynb"]},
    ],
    "features": [
        {"id": "visual_circuit_editor", "label": "Visual circuit composer", "default_enabled": True, "category": "ide"},
        {"id": "monaco_source_editor", "label": "Source code editor", "default_enabled": True, "category": "ide"},
        {"id": "sdk_notebook", "label": "Notebook / script projects", "default_enabled": True, "category": "ide"},
        {"id": "project_templates", "label": "Project templates", "default_enabled": True, "category": "ide"},
        {"id": "autosave_revisions", "label": "Autosave & revision history", "default_enabled": True, "category": "ide"},
        {"id": "import_export_bundle", "label": "Import / export project bundles", "default_enabled": True, "category": "ide"},
        {"id": "compilation", "label": "Compilation & diagnostics", "default_enabled": True, "category": "build"},
        {"id": "preflight", "label": "Preflight & manifest checks", "default_enabled": True, "category": "build"},
        {"id": "resource_estimation", "label": "Resource estimation", "default_enabled": True, "category": "build"},
        {"id": "simulation_cpu", "label": "CPU simulation", "default_enabled": True, "category": "execution"},
        {"id": "simulation_gpu", "label": "GPU simulation (connector)", "default_enabled": False, "category": "execution"},
        {"id": "simulation_hpc", "label": "HPC batch simulation", "default_enabled": False, "category": "execution"},
        {"id": "parameter_sweeps", "label": "Parameter sweeps", "default_enabled": True, "category": "execution"},
        {"id": "optimization_runs", "label": "Versioned optimization", "default_enabled": True, "category": "build"},
        {"id": "run_comparison", "label": "Run comparison & baselines", "default_enabled": True, "category": "analysis"},
        {"id": "reproducibility_manifest", "label": "Reproducibility manifests", "default_enabled": True, "category": "analysis"},
        {"id": "experiment_reports", "label": "Experiment reports", "default_enabled": True, "category": "analysis"},
        {"id": "workload_submission", "label": "Governed workload submission", "default_enabled": True, "category": "governance"},
        {"id": "ai_assist", "label": "AI-assisted drafting (site policy)", "default_enabled": False, "category": "assist"},
        {"id": "research_workflow_graph", "label": "Research workflow graph", "default_enabled": False, "category": "research"},
        {"id": "paper_reproduction_lab", "label": "Paper reproduction lab", "default_enabled": False, "category": "research"},
    ],
    "editor": {
        "themes": ["system", "dark", "light", "high_contrast"],
        "font_families": ["jetbrains-mono", "fira-code", "source-code-pro"],
        "font_sizes": [12, 13, 14, 15, 16, 18],
        "tab_sizes": [2, 4],
        "line_wrapping": [True, False],
        "minimap": [True, False],
    },
    "gate_palette": [
        {"id": "h", "label": "H", "qubits": 1, "color": "#6366f1"},
        {"id": "x", "label": "X", "qubits": 1, "color": "#ef4444"},
        {"id": "z", "label": "Z", "qubits": 1, "color": "#22c55e"},
        {"id": "cx", "label": "CX", "qubits": 2, "color": "#f59e0b"},
        {"id": "measure", "label": "M", "qubits": 1, "color": "#94a3b8"},
    ],
    "simulation": {
        "default_shots": 1024,
        "shots_presets": [128, 256, 512, 1024, 4096, 8192, 16384],
        "max_shots": 100000,
        "seed_optional": True,
        "parameter_bindings": True,
        "budget_warnings": True,
    },
    "execution_target_classes": [
        {"id": "simulator_cpu", "label": "CPU simulator"},
        {"id": "simulator_gpu", "label": "GPU simulator"},
        {"id": "simulator_hpc", "label": "HPC simulator"},
        {"id": "hardware", "label": "Quantum hardware (governed)"},
    ],
    "settings_schema": {
        "type": "object",
        "additionalProperties": True,
        "properties": {
            "editor": {
                "type": "object",
                "title": "Editor",
                "additionalProperties": True,
                "properties": {
                    "theme": {
                        "type": "string",
                        "title": "Editor theme",
                        "enum": ["system", "dark", "light", "high_contrast"],
                        "default": "dark",
                    },
                    "font_size": {"type": "integer", "title": "Font size", "minimum": 12, "maximum": 18, "default": 14},
                    "minimap": {"type": "boolean", "title": "Minimap", "default": False},
                },
            },
            "simulation": {
                "type": "object",
                "title": "Simulation",
                "additionalProperties": True,
                "properties": {
                    "default_shots": {
                        "type": "integer",
                        "title": "Default shots",
                        "minimum": 128,
                        "maximum": 100000,
                        "default": 1024,
                    },
                    "seed": {"type": "integer", "title": "Random seed (optional)", "minimum": 0},
                },
            },
            "ui": {"type": "object", "title": "UI", "additionalProperties": True},
            "integrations": {"type": "object", "title": "Integrations", "additionalProperties": True},
        },
    },
    "templates": [
        {
            "template_id": "blank_circuit",
            "name": "Blank circuit",
            "project_type": "quantum_circuit",
            "default_settings": {"editor": {"theme": "dark"}},
            "default_capabilities": {"visual_circuit_editor": True, "monaco_source_editor": True},
            "initial_source": "OPENQASM 3.0;\ninclude \"stdgates.inc\";\nqubit[2] q;\nbit[2] c;\nh q[0];\ncx q[0], q[1];\nc[0] = measure q[0];\nc[1] = measure q[1];\n",
        },
        {
            "template_id": "qiskit_python",
            "name": "Qiskit Python starter",
            "project_type": "sdk_python",
            "default_settings": {},
            "default_capabilities": {"monaco_source_editor": True, "sdk_notebook": True},
            "initial_source": "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2, 2)\nqc.h(0)\nqc.cx(0, 1)\nqc.measure([0, 1], [0, 1])\n",
        },
    ],
}


def get_studio_platform_config() -> Dict[str, Any]:
    return deepcopy(DEFAULT_STUDIO_CONFIG)


def default_capabilities_map() -> Dict[str, bool]:
    return {f["id"]: bool(f.get("default_enabled", False)) for f in DEFAULT_STUDIO_CONFIG["features"]}
