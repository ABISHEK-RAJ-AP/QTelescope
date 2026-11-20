import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


def _parse_ts(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    text = str(raw).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _delta_hours(prev_ts: Any, cur_ts: Any) -> Optional[float]:
    t0, t1 = _parse_ts(prev_ts), _parse_ts(cur_ts)
    if not t0 or not t1:
        return None
    return max((t1 - t0).total_seconds() / 3600.0, 1e-9)


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

            dt_h = _delta_hours(prev["timestamp"], curr["timestamp"])
            rate = round(abs_chg / dt_h, 4) if dt_h is not None else None

            row: Dict[str, Any] = {
                "timestamp": curr["timestamp"],
                "current_value": c_val,
                "previous_value": p_val,
                "abs_change": abs_chg,
                "pct_change": pct_chg,
                "change_direction": direction,
                "rate_of_change": rate,
                "rolling_avg": round(avg, 4),
                "rolling_std_dev": round(std_dev, 4),
                "drift_status": drift_st,
            }
            if dt_h is not None:
                row["interval_hours"] = round(dt_h, 6)
            points_result.append(row)

        latest = points_result[-1]
        return {
            "latest_val": latest["current_value"],
            "previous_val": latest["previous_value"],
            "abs_change": latest["abs_change"],
            "pct_change": latest["pct_change"],
            "drift_status": latest["drift_status"],
            "points": points_result
        }
