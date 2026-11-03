import datetime
from typing import Tuple

class CalibrationFreshnessMonitor:
    """
    Evaluates calibration snapshot timestamps to compute age in hours and freshness status.
    """
    @staticmethod
    def calculate_freshness(calibration_time: datetime.datetime, collection_time: datetime.datetime = None) -> Tuple[float, str]:
        if not calibration_time:
            return 9999.0, "Unknown"
            
        if not collection_time:
            collection_time = datetime.datetime.utcnow()

        # Handle timezone awareness safely
        cal_naive = calibration_time.replace(tzinfo=None) if calibration_time.tzinfo else calibration_time
        col_naive = collection_time.replace(tzinfo=None) if collection_time.tzinfo else collection_time

        delta_seconds = (col_naive - cal_naive).total_seconds()
        age_hours = round(max(0.0, delta_seconds / 3600.0), 2)

        if age_hours <= 6.0:
            status = "Fresh"
        elif age_hours <= 12.0:
            status = "Recent"
        elif age_hours <= 24.0:
            status = "Aging"
        else:
            status = "Stale"

        return age_hours, status
