import csv
import io
import json
import datetime
from typing import List, Dict, Any

class ReportGenerator:
    """
    Generates downloadable reports in CSV, JSON, and formatted HTML (printable as PDF).
    """
    @staticmethod
    def generate_csv_report(data: List[Dict[str, Any]], fieldnames: List[str]) -> str:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
        return output.getvalue()

    @staticmethod
    def generate_html_report(title: str, subtitle: str, data_summary: Dict[str, Any], table_rows: List[Dict[str, Any]]) -> str:
        ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        now_str = datetime.datetime.now(ist_tz).strftime("%Y-%m-%d %I:%M:%S %p IST")
        
        # Format HTML table
        headers = list(table_rows[0].keys()) if table_rows else []
        th_html = "".join(f"<th style='padding: 10px; border-bottom: 2px solid #334155; text-align: left; font-size: 13px;'>{h.replace('_', ' ').title()}</th>" for h in headers)
        
        tr_html = ""
        for row in table_rows:
            tds = "".join(f"<td style='padding: 10px; border-bottom: 1px solid #1e293b; font-size: 13px;'>{row.get(h, '')}</td>" for h in headers)
            tr_html += f"<tr>{tds}</tr>"

        summary_html = "".join(f"<div style='background: #1e293b; padding: 12px 18px; border-radius: 8px; font-size: 14px;'><strong>{k.replace('_', ' ').title()}:</strong> {v}</div>" for k, v in data_summary.items())

        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title} - Quantum Telemetry Platform</title>
    <style>
        body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 30px; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }}
        .title {{ font-size: 24px; font-weight: bold; color: #38bdf8; }}
        .subtitle {{ font-size: 14px; color: #94a3b8; margin-top: 4px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }}
        table {{ width: 100%; border-collapse: collapse; background: #0f172a; border-radius: 8px; overflow: hidden; }}
        th {{ background: #1e293b; color: #38bdf8; }}
        tr:nth-child(even) {{ background: #182234; }}
        .footer {{ margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 15px; }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="title">{title}</div>
            <div class="subtitle">{subtitle}</div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #94a3b8;">
            Generated At: {now_str}<br>
            Platform: Quantum Monitoring v1.0
        </div>
    </div>
    
    <div class="summary-grid">
        {summary_html}
    </div>
    
    <h3>Telemetry Details</h3>
    <table>
        <thead><tr>{th_html}</tr></thead>
        <tbody>{tr_html}</tbody>
    </table>
    
    <div class="footer">
        Quantum Telemetry, Monitoring & Resource Management Platform &copy; 2026. Confidential & Proprietary.
    </div>
</body>
</html>"""
