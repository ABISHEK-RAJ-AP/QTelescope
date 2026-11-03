from typing import List, Dict, Any

class HealthEngine:
    """
    Transparent, rule-based health calculation engine for backends and qubits.
    Provides clear contributing factors rather than an opaque score.
    """
    @staticmethod
    def evaluate_backend_health(
        operational: bool,
        status_msg: str,
        calibration_freshness: str,
        calibration_age_hours: float,
        pending_jobs: int,
        qubits_telemetry: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        
        factors = []
        score = 100.0

        # 1. Operational Status Factor
        if operational:
            factors.append({
                "name": "Operational Status",
                "status": "HEALTHY",
                "description": f"Backend is ONLINE ({status_msg})",
                "value": "ONLINE"
            })
        else:
            score -= 50.0
            factors.append({
                "name": "Operational Status",
                "status": "CRITICAL",
                "description": f"Backend is OFFLINE: {status_msg}",
                "value": "OFFLINE"
            })

        # 2. Calibration Freshness Factor
        if calibration_freshness == "Fresh":
            factors.append({
                "name": "Calibration Freshness",
                "status": "HEALTHY",
                "description": f"Calibration is fresh ({calibration_age_hours:.1f}h old)",
                "value": f"{calibration_age_hours:.1f}h"
            })
        elif calibration_freshness in ["Recent", "Aging"]:
            score -= 10.0
            factors.append({
                "name": "Calibration Freshness",
                "status": "WARNING",
                "description": f"Calibration is aging ({calibration_age_hours:.1f}h old)",
                "value": f"{calibration_age_hours:.1f}h"
            })
        else: # Stale / Unknown
            score -= 25.0
            factors.append({
                "name": "Calibration Freshness",
                "status": "CRITICAL",
                "description": f"Calibration is STALE or unknown ({calibration_age_hours:.1f}h old)",
                "value": f"{calibration_age_hours:.1f}h"
            })

        # 3. Queue Congestion Factor
        if pending_jobs > 50:
            score -= 15.0
            factors.append({
                "name": "Queue Condition",
                "status": "WARNING",
                "description": f"High pending job count ({pending_jobs} jobs in queue)",
                "value": pending_jobs
            })
        else:
            factors.append({
                "name": "Queue Condition",
                "status": "HEALTHY",
                "description": f"Normal queue level ({pending_jobs} pending jobs)",
                "value": pending_jobs
            })

        # 4. Qubit Coherence & Readout Condition
        faulty_count = 0
        total_q = len(qubits_telemetry)
        if total_q > 0:
            for q in qubits_telemetry:
                t1 = q.get("t1")
                t2 = q.get("t2")
                ro = q.get("readout_error")
                if (t1 and t1 < 50.0) or (t2 and t2 < 40.0) or (ro and ro > 0.05):
                    faulty_count += 1

            faulty_pct = (faulty_count / total_q) * 100.0
            if faulty_pct > 15.0:
                score -= 30.0
                factors.append({
                    "name": "Qubit Health",
                    "status": "CRITICAL",
                    "description": f"{faulty_count}/{total_q} qubits ({faulty_pct:.1f}%) exhibiting degraded parameters",
                    "value": f"{faulty_pct:.1f}% degraded"
                })
            elif faulty_pct > 0.0:
                score -= 10.0
                factors.append({
                    "name": "Qubit Health",
                    "status": "WARNING",
                    "description": f"{faulty_count}/{total_q} qubits showing degraded parameters",
                    "value": f"{faulty_count} degraded"
                })
            else:
                factors.append({
                    "name": "Qubit Health",
                    "status": "HEALTHY",
                    "description": "All qubits operating within nominal thresholds",
                    "value": "100% nominal"
                })
        else:
            factors.append({
                "name": "Qubit Health",
                "status": "UNKNOWN",
                "description": "No qubit telemetry available",
                "value": "NO_DATA"
            })

        final_score = max(0.0, score)
        if final_score >= 85.0:
            overall = "HEALTHY"
        elif final_score >= 60.0:
            overall = "DEGRADED"
        else:
            overall = "CRITICAL"

        return {
            "overall_health": overall,
            "health_score": round(final_score, 1),
            "contributing_factors": factors
        }

    @staticmethod
    def evaluate_qubit_health(t1: float, t2: float, readout_error: float) -> str:
        if t1 is None or t2 is None or readout_error is None:
            return "Unknown"
        if t1 < 40.0 or t2 < 30.0 or readout_error > 0.08:
            return "Unavailable"
        if t1 < 70.0 or t2 < 50.0 or readout_error > 0.03:
            return "Degraded"
        if t1 < 100.0 or t2 < 70.0 or readout_error > 0.02:
            return "Warning"
        return "Healthy"
