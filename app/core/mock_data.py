import random
import datetime
from typing import List, Dict, Any, Optional

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

# ==============================================================================
# CENTRALIZED MOCK QUANTUM HARDWARE DATA STORE
# Single Source of Truth for all 4 Quantum Computing Hardware Platforms:
# 1. IBM Quantum (ibm_brisbane - 127 Qubits, Superconducting Heavy-Hex)
# 2. Rigetti Computing (rigetti_aspen_m3 - 80 Qubits, Octagonal Ring Transmon)
# 3. IonQ (ionq_forte - 36 Qubits, Trapped-Ion All-to-All Optical Trap)
# 4. C-DAC Platform (cdac_qsim_param - 64 Qubits, PARAM HPC Quantum Simulator)
# ==============================================================================

MOCK_HARDWARE_BACKENDS: Dict[str, Dict[str, Any]] = {
    "ibm_brisbane": {
        "backend_id": "ibm_brisbane",
        "provider_id": "ibm_quantum",
        "backend_name": "IBM Brisbane (127Q)",
        "backend_type": "hardware",
        "qpu_modality": "superconducting",
        "topology_type": "heavy_hex",
        "qubit_count": 127,
        "operational_status": "ONLINE",
        "status_message": "Operational Eagle r3 Heavy-Hex QPU",
        "configuration_version": "2.4.1",
        "quantum_volume": 512,
        "clops": 2600,
        "basis_gates": ["ecr", "id", "rz", "sx", "x"],
        "modality_extensions": {
            "processor_architecture": "Eagle r3 Heavy-Hexagonal Planar Lattice",
            "cryogenic_mxc_temp": "12.4 mK",
            "control_type": "All-Microwave Cross-Resonance (CR)",
            "readout_multiplexing_ghz": "7.0 - 7.5 GHz",
            "native_2q_gate": "Echoed Cross-Resonance (ECR)"
        },
        "base_metrics": {
            "avg_t1_us": 235.0,
            "avg_t2_us": 250.0,
            "readout_error": 0.014,
            "gate_error_1q": 0.0002,
            "gate_error_2q": 0.0085,
            "qubit_freq_base": 4.80,
            "qubit_freq_step": 0.008,
            "anharmonicity": -0.34,
            "readout_length_ns": 680.0,
            "fridge_temp_mK": 12.4
        }
    },

    "rigetti_aspen_m3": {
        "backend_id": "rigetti_aspen_m3",
        "provider_id": "rigetti_quantum",
        "backend_name": "Rigetti Aspen-M-3 (80Q)",
        "backend_type": "hardware",
        "qpu_modality": "superconducting",
        "topology_type": "octagonal_ring",
        "qubit_count": 80,
        "operational_status": "ONLINE",
        "status_message": "Operational Dual-Octagon Transmon QPU",
        "configuration_version": "2.1.0",
        "quantum_volume": 32,
        "clops": 1600,
        "basis_gates": ["rx", "rz", "cz", "xy"],
        "modality_extensions": {
            "processor_architecture": "8-Qubit Octagonal Ring Tiles",
            "cryogenic_mxc_temp": "14.2 mK",
            "control_type": "Fast DC Flux Bias Tuning Lines",
            "coupling_type": "Capacitive / Inductive Ring Couplers",
            "native_2q_gate": "Parametric Controlled-Z (CZ)"
        },
        "base_metrics": {
            "avg_t1_us": 46.0,
            "avg_t2_us": 39.0,
            "readout_error": 0.026,
            "gate_error_1q": 0.0012,
            "gate_error_2q": 0.0145,
            "qubit_freq_base": 4.10,
            "qubit_freq_step": 0.015,
            "anharmonicity": -0.22,
            "readout_length_ns": 850.0,
            "fridge_temp_mK": 14.2
        }
    },

    "ionq_forte": {
        "backend_id": "ionq_forte",
        "provider_id": "ionq_quantum",
        "backend_name": "IonQ Forte (36Q)",
        "backend_type": "hardware",
        "qpu_modality": "trapped_ion",
        "topology_type": "all_to_all",
        "qubit_count": 36,
        "operational_status": "ONLINE",
        "status_message": "Operational Trapped-Ion QPU (#AQ 35)",
        "configuration_version": "3.1.0",
        "quantum_volume": 2048,
        "clops": 900,
        "basis_gates": ["gpi", "gpi2", "ms", "rz"],
        "modality_extensions": {
            "trap_technology": "Linear RF Paul Trap with Ultra-High Vacuum",
            "vacuum_pressure_torr": "2.4 × 10⁻¹¹ Torr",
            "ion_species": "Ytterbium-171 (171Yb+) Atomic Hyperfine States",
            "optical_addressing": "Individual 355nm Pulsed Raman Laser Beams",
            "motional_mode_freq_mhz": "2.85 MHz Center-of-Mass (COM)",
            "native_2q_gate": "Mølmer–Sørensen (MS)"
        },
        "base_metrics": {
            "avg_t1_us": 10000000.0, # 10.0 Seconds
            "avg_t2_us": 2500000.0,  # 2.5 Seconds
            "readout_error": 0.0035,
            "gate_error_1q": 0.0004,
            "gate_error_2q": 0.0050,
            "qubit_freq_base": 12.642821, # GHz hyperfine splitting
            "qubit_freq_step": 0.00001,
            "anharmonicity": 0.0,
            "readout_length_ns": 150.0,
            "fridge_temp_mK": 295000.0 # Room Temp Vacuum Chamber (295 K)
        }
    },

    "cdac_qsim_param": {
        "backend_id": "cdac_qsim_param",
        "provider_id": "cdac_quantum",
        "backend_name": "C-DAC PARAM QSim-64",
        "backend_type": "simulator",
        "qpu_modality": "simulator",
        "topology_type": "all_to_all",
        "qubit_count": 64,
        "operational_status": "ONLINE",
        "status_message": "C-DAC High-Performance Quantum Simulator Cluster",
        "configuration_version": "3.0.0-cdac",
        "quantum_volume": 4096,
        "clops": 15000,
        "basis_gates": ["u1", "u2", "u3", "cx", "cz", "swap", "id"],
        "modality_extensions": {
            "supercomputing_cluster": "PARAM Siddhi-AI / PARAM Brahma HPC",
            "acceleration_stack": "MPI Distributed Ranks + OpenMP + NVIDIA CUDA Quantum",
            "simulation_architecture": "Distributed Statevector & Tensor Network Evaluator",
            "memory_scaling": "2ᴺ × 16 Bytes (Exact Analytical Simulation)"
        },
        "base_metrics": {
            "avg_t1_us": 300.0,
            "avg_t2_us": 300.0,
            "readout_error": 0.0001,
            "gate_error_1q": 0.00001,
            "gate_error_2q": 0.0001,
            "qubit_freq_base": 5.00,
            "qubit_freq_step": 0.005,
            "anharmonicity": -0.30,
            "readout_length_ns": 100.0,
            "fridge_temp_mK": 293000.0 # Server room ambient
        }
    }
}

# ==============================================================================
# ACCESSOR & GENERATOR FUNCTIONS
# ==============================================================================

def get_all_mock_backends() -> List[Dict[str, Any]]:
    """Returns the list of 4 standardized backend definitions."""
    return list(MOCK_HARDWARE_BACKENDS.values())

def get_mock_backend(backend_id: str) -> Optional[Dict[str, Any]]:
    """Returns metadata for a specific backend by identifier."""
    return MOCK_HARDWARE_BACKENDS.get(backend_id)

def get_mock_backend_status(backend_id: str) -> Dict[str, Any]:
    """Generates dynamic live operational status and queue latency."""
    b = MOCK_HARDWARE_BACKENDS.get(backend_id)
    if not b:
        return {
            "backend_id": backend_id,
            "operational": True,
            "pending_jobs": 0,
            "status_message": "Operational",
            "estimated_wait_time": 0,
            "timestamp": utcnow().isoformat()
        }
    
    pending = random.randint(1, 12)
    wait_time = pending * random.uniform(5.0, 15.0)
    return {
        "backend_id": backend_id,
        "operational": True,
        "pending_jobs": pending,
        "status_message": b["status_message"],
        "estimated_wait_time": int(wait_time),
        "timestamp": utcnow().isoformat()
    }

def get_mock_backend_properties(backend_id: str) -> Dict[str, Any]:
    """Generates physical qubit coherence times, gate fidelities, and environmental metrics."""
    b = MOCK_HARDWARE_BACKENDS.get(backend_id, MOCK_HARDWARE_BACKENDS["ibm_brisbane"])
    metrics = b["base_metrics"]
    n_qubits = b["qubit_count"]
    
    now = utcnow()
    cal_timestamp = (now - datetime.timedelta(hours=random.uniform(0.8, 3.5))).isoformat()

    qubits = []
    for i in range(n_qubits):
        t1_val = metrics["avg_t1_us"] + random.uniform(-metrics["avg_t1_us"] * 0.08, metrics["avg_t1_us"] * 0.08)
        t2_val = metrics["avg_t2_us"] + random.uniform(-metrics["avg_t2_us"] * 0.08, metrics["avg_t2_us"] * 0.08)
        
        # Inject controlled outlier for drift demo if IBM
        if backend_id == "ibm_brisbane" and i in [14, 42]:
            t1_val = random.uniform(36.0, 48.0)
            t2_val = random.uniform(28.0, 42.0)
            
        qubits.append({
            "qubit_index": i,
            "t1": t1_val,
            "t2": t2_val,
            "frequency": metrics["qubit_freq_base"] + (i * metrics["qubit_freq_step"]),
            "readout_error": metrics["readout_error"] + random.uniform(-0.002, 0.004),
            "prob_meas0_prep1": 0.01,
            "prob_meas1_prep0": 0.01,
            "anharmonicity": metrics["anharmonicity"],
            "readout_length": metrics["readout_length_ns"]
        })
        
    gates = []
    for i in range(n_qubits):
        gates.append({
            "gate_name": f"1q_{i}",
            "gate_type": "1q",
            "qubits": [i],
            "error_rate": metrics["gate_error_1q"],
            "gate_length": 35.0
        })
        
    edges = get_mock_connectivity(backend_id)
    for e in edges:
        q1, q2 = e["qubits"]
        gates.append({
            "gate_name": f"2q_{q1}_{q2}",
            "gate_type": "2q",
            "qubits": [q1, q2],
            "error_rate": metrics["gate_error_2q"],
            "gate_length": 220.0
        })

    return {
        "backend_id": backend_id,
        "calibration_timestamp": cal_timestamp,
        "qubits": qubits,
        "gates": gates,
        "general_properties": {
            "fridge_temperature_mK": metrics["fridge_temp_mK"],
            "firmware_version": b["configuration_version"]
        }
    }

def get_mock_connectivity(backend_id: str) -> List[Dict[str, Any]]:
    """Generates physical lattice coupling topology edges."""
    b = MOCK_HARDWARE_BACKENDS.get(backend_id, MOCK_HARDWARE_BACKENDS["ibm_brisbane"])
    n_qubits = b["qubit_count"]
    topology = b["topology_type"]
    edges = []

    if topology == "heavy_hex":
        for i in range(n_qubits - 1):
            if i % 3 != 0 or i + 2 >= n_qubits:
                edges.append({"edge_id": f"{backend_id}_e_{i}_{i+1}", "qubits": [i, i+1], "directed": False})
            if i + 4 < n_qubits and i % 5 == 0:
                edges.append({"edge_id": f"{backend_id}_e_{i}_{i+4}", "qubits": [i, i+4], "directed": False})

    elif topology == "octagonal_ring":
        for ring in range(n_qubits // 8):
            offset = ring * 8
            for i in range(8):
                q1 = offset + i
                q2 = offset + ((i + 1) % 8)
                edges.append({"edge_id": f"{backend_id}_e_{q1}_{q2}", "qubits": [q1, q2], "directed": False})

    elif topology == "all_to_all":
        # Connect each qubit with adjacent neighbors in optical trap
        for i in range(n_qubits):
            for j in range(i + 1, min(i + 5, n_qubits)):
                edges.append({"edge_id": f"{backend_id}_e_{i}_{j}", "qubits": [i, j], "directed": False})

    return edges

def get_mock_jobs(backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Generates quantum execution jobs and circuit run logs."""
    now = utcnow()
    jobs = []
    statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "RUNNING", "QUEUED", "FAILED", "CANCELLED"]
    failure_samples = [
        "Job execution failed: runtime error during shot assembly",
        "Transpilation failed: invalid instruction on basis gate u3",
        "Queue capacity exceeded — fair-share throttle",
        "Device offline for scheduled calibration maintenance",
        "Connection timeout to upstream QPU control plane",
        "Invalid credentials / IAM token expired",
    ]

    for i in range(limit):
        sub_time = now - datetime.timedelta(minutes=i * 12 + random.randint(1, 8))
        st = statuses[i % len(statuses)]
        failed = st in ("FAILED", "CANCELLED", "ERROR")
        jobs.append({
            "job_id": f"job_{backend_id.split('_')[0]}_{random.randint(100000, 999999)}",
            "backend_id": backend_id,
            "status": st,
            "submitted_at": sub_time.isoformat(),
            "created_at": sub_time.isoformat(),
            "runtime": random.uniform(2.5, 40.0) if st == "COMPLETED" else None,
            "failure_reason": failure_samples[i % len(failure_samples)] if failed else None,
            "calibration_identifier": f"cal_{backend_id}_{now.strftime('%Y%m%d')}",
            "tags": ["runtime_eval", "benchmark"] if i % 2 == 0 else ["qaoa", "production"]
        })
    return jobs
