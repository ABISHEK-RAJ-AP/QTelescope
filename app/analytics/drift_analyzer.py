import math
from typing import List, Dict, Any, Optional

class DriftAnalyzer:
    """
    Computes statistical parameter drift, rate of change, rolling metrics, and drift statuses.
    """
    @staticmethod
    def analyze_drift(series: List[Dict[str, Any]], metric_key: str = "t1") -> Dict[str, Any]:
        """
        series is a chronologically sorted list of dicts with keys 'timestamp' and metric_key
        """
        valid_points = [p for p in series if p.get(metric_key) is not None]
        if len(valid_points) < 2:
            val = valid_points[0].get(metric_key) if valid_points else None
            return {
                "latest_val": val,
                "previous_val": val,
                "abs_change": 0.0,
                "pct_change": 0.0,
                "drift_status": "NORMAL",
                "points": []
            }

        points_result = []
        values = []

        for i in range(len(valid_points)):
            curr = valid_points[i]
            c_val = float(curr[metric_key])
            values.append(c_val)

            if i == 0:
                points_result.append({
                    "timestamp": curr["timestamp"],
                    "current_value": c_val,
                    "previous_value": c_val,
                    "abs_change": 0.0,
                    "pct_change": 0.0,
                    "change_direction": "STABLE",
                    "rate_of_change": 0.0,
                    "rolling_avg": c_val,
                    "rolling_std_dev": 0.0,
                    "drift_status": "NORMAL"
                })
                continue

            prev = valid_points[i - 1]
            p_val = float(prev[metric_key])
            abs_chg = round(c_val - p_val, 4)
            pct_chg = round(((c_val - p_val) / p_val) * 100.0, 2) if p_val != 0 else 0.0

            if abs_chg > 0.0001:
                direction = "INCREASING"
            elif abs_chg < -0.0001:
                direction = "DECREASING"
            else:
                direction = "STABLE"

            # Compute rolling avg & std dev up to index i
            sub_vals = values[:i+1]
            avg = sum(sub_vals) / len(sub_vals)
            variance = sum((x - avg) ** 2 for x in sub_vals) / len(sub_vals)
            std_dev = math.sqrt(variance)

            # Determine drift status (e.g. if > 2 std devs from rolling mean or > 25% drop)
            drift_st = "NORMAL"
            if abs(pct_chg) > 30.0 or (std_dev > 0 and abs(c_val - avg) > 2.5 * std_dev):
                drift_st = "CRITICAL_DRIFT"
            elif abs(pct_chg) > 15.0 or (std_dev > 0 and abs(c_val - avg) > 1.8 * std_dev):
                drift_st = "DRIFTING"

            points_result.append({
                "timestamp": curr["timestamp"],
                "current_value": c_val,
                "previous_value": p_val,
                "abs_change": abs_chg,
                "pct_change": pct_chg,
                "change_direction": direction,
                "rate_of_change": abs_chg,
                "rolling_avg": round(avg, 4),
                "rolling_std_dev": round(std_dev, 4),
                "drift_status": drift_st
            })

        latest = points_result[-1]
        return {
            "latest_val": latest["current_value"],
            "previous_val": latest["previous_value"],
            "abs_change": latest["abs_change"],
            "pct_change": latest["pct_change"],
            "drift_status": latest["drift_status"],
            "points": points_result
        }
