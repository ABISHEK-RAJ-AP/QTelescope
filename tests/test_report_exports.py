"""Report HTML/preview contracts."""
from app.reports.report_generator import ReportGenerator


def test_html_report_has_header_footer_and_table():
    rows = [
        {"backend_id": "ibm_q1", "status": "online", "qubits": 127, "provider": "ibm", "type": "superconducting", "quantum_volume": 64, "backend_name": "Q1"},
        {"backend_id": "ion_a", "status": "offline", "qubits": 32, "provider": "ionq", "type": "trapped_ion", "quantum_volume": 32, "backend_name": "Ion A"},
    ]
    fieldnames = ["backend_id", "backend_name", "provider", "type", "qubits", "status", "quantum_volume"]
    html = ReportGenerator.generate_html_report(
        "Test",
        "Subtitle",
        "backend_monitoring",
        fieldnames,
        rows,
        include_charts=True,
        include_summary=True,
    )
    assert "Q-TeleScope" in html
    assert "Telemetry detail" in html
    assert "Field definitions" in html
    assert "RESTRICTED" in html
    assert "head-logos" in html or "C-DAC" in html
    assert "<table" in html
    assert "chart-bar" in html
    assert "online" in html
    assert "motion-div" not in html


def test_alert_glossary_describes_columns():
    fieldnames = [
        "alert_id", "backend_id", "resource_type", "resource_id",
        "rule_type", "severity", "status", "summary", "detected_at",
    ]
    glossary = ReportGenerator.generate_glossary_html("alerts", fieldnames)
    assert "Stable identifier" in glossary
    assert "<code>rule_type</code>" in glossary
    assert "India Standard Time" in glossary


def test_preview_row_limit():
    rows = [
        {
            "alert_id": f"a{i}",
            "backend_id": "ibm_q1",
            "severity": "CRITICAL",
            "status": "ACTIVE",
            "resource_id": "ibm_q1_Q3",
            "resource_type": "QUBIT",
            "rule_type": "t1_degradation",
            "summary": "T1 below threshold",
            "detected_at": "2026-01-01 10:00:00 AM IST",
        }
        for i in range(10)
    ]
    fieldnames = list(rows[0].keys())
    html = ReportGenerator.generate_html_report(
        "Alerts",
        "Sub",
        "alerts",
        fieldnames,
        rows,
        row_limit=3,
        preview_watermark=True,
    )
    assert "PREVIEW" in html
    assert "Showing 3 of 10 rows" in html