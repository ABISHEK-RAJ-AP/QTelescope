import csv
import io
import datetime
import html
from collections import Counter
from typing import Any, Dict, List, Optional


class ReportGenerator:
    """CSV, JSON, and printable HTML exports for audit evidence."""

    ORG_NAME = "Q-TeleScope · Quantum Telemetry"
    PLATFORM = "Quantum Monitoring & Resource Platform"

    @staticmethod
    def generate_csv_report(data: List[Dict[str, Any]], fieldnames: List[str]) -> str:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in data:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
        return output.getvalue()

    @staticmethod
    def compute_aggregates(report_type: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not rows:
            return {"total_records": 0}
        agg: Dict[str, Any] = {"total_records": len(rows)}
        if report_type == "backend_monitoring":
            by_status = Counter(str(r.get("status") or "unknown") for r in rows)
            agg["status_breakdown"] = dict(by_status)
            agg["total_qubits"] = sum(int(r.get("qubits") or 0) for r in rows)
            agg["providers"] = len({r.get("provider") for r in rows if r.get("provider")})
        elif report_type == "alerts":
            by_sev = Counter(str(r.get("severity") or "unknown") for r in rows)
            by_st = Counter(str(r.get("status") or "unknown") for r in rows)
            agg["severity_breakdown"] = dict(by_sev)
            agg["status_breakdown"] = dict(by_st)
            agg["open_alerts"] = sum(1 for r in rows if str(r.get("status")).lower() in ("open", "active", "firing"))
        elif report_type == "calibration":
            by_fresh = Counter(str(r.get("freshness") or "unknown") for r in rows)
            agg["freshness_breakdown"] = dict(by_fresh)
            ages = [float(r.get("age_hours") or 0) for r in rows]
            agg["max_age_hours"] = round(max(ages), 2) if ages else 0
            agg["mean_age_hours"] = round(sum(ages) / len(ages), 2) if ages else 0
        return agg

    @staticmethod
    def _svg_bar_chart(title: str, counts: Dict[str, int], max_width: int = 520) -> str:
        if not counts:
            return ""
        items = sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:8]
        max_val = max(v for _, v in items) or 1
        bar_h = 22
        gap = 8
        height = 36 + len(items) * (bar_h + gap)
        bars = []
        y = 28
        for label, val in items:
            w = int((val / max_val) * (max_width - 140))
            safe_label = html.escape(label)
            bars.append(
                f'<text x="0" y="{y + 16}" class="chart-label">{safe_label}</text>'
                f'<rect x="120" y="{y}" width="{w}" height="{bar_h}" class="chart-bar" rx="3"/>'
                f'<text x="{125 + w}" y="{y + 16}" class="chart-val">{val}</text>'
            )
            y += bar_h + gap
        return (
            f'<figure class="chart"><figcaption>{html.escape(title)}</figcaption>'
            f'<svg viewBox="0 0 {max_width} {height}" width="100%" height="{height}" role="img" aria-label="{html.escape(title)}">'
            f"{''.join(bars)}</svg></figure>"
        )

    @staticmethod
    def generate_charts_html(report_type: str, aggregates: Dict[str, Any]) -> str:
        parts: List[str] = []
        if report_type == "backend_monitoring" and aggregates.get("status_breakdown"):
            parts.append(ReportGenerator._svg_bar_chart("Backends by operational status", aggregates["status_breakdown"]))
        if report_type == "alerts":
            if aggregates.get("severity_breakdown"):
                parts.append(ReportGenerator._svg_bar_chart("Alerts by severity", aggregates["severity_breakdown"]))
            if aggregates.get("status_breakdown"):
                parts.append(ReportGenerator._svg_bar_chart("Alerts by status", aggregates["status_breakdown"]))
        if report_type == "calibration" and aggregates.get("freshness_breakdown"):
            parts.append(ReportGenerator._svg_bar_chart("Calibrations by freshness", aggregates["freshness_breakdown"]))
        return f'<section class="charts-grid">{"".join(parts)}</section>' if parts else ""

    @staticmethod
    def generate_summary_html(report_type: str, aggregates: Dict[str, Any], scope_label: str) -> str:
        cards = [
            ("Scope", scope_label),
            ("Total records", aggregates.get("total_records", 0)),
        ]
        if report_type == "backend_monitoring":
            cards.append(("Total qubits (sum)", aggregates.get("total_qubits", 0)))
            cards.append(("Distinct providers", aggregates.get("providers", 0)))
        if report_type == "alerts":
            cards.append(("Open / active alerts", aggregates.get("open_alerts", 0)))
        if report_type == "calibration":
            cards.append(("Mean calibration age (h)", aggregates.get("mean_age_hours", 0)))
            cards.append(("Max calibration age (h)", aggregates.get("max_age_hours", 0)))
        inner = "".join(
            f'<div class="kpi"><span class="kpi-k">{html.escape(str(k))}</span>'
            f'<span class="kpi-v">{html.escape(str(v))}</span></div>'
            for k, v in cards
        )
        return f'<section class="kpi-grid" aria-label="Summary">{inner}</section>'

    @staticmethod
    def generate_glossary_html(fieldnames: List[str]) -> str:
        if not fieldnames:
            return ""
        lis = "".join(f"<li><code>{html.escape(f)}</code></li>" for f in fieldnames)
        return (
            '<section class="glossary"><h2>Column reference</h2>'
            f"<ul>{lis}</ul></section>"
        )

    @staticmethod
    def generate_html_report(
        title: str,
        subtitle: str,
        report_type: str,
        fieldnames: List[str],
        table_rows: List[Dict[str, Any]],
        *,
        scope_label: str = "Fleet (all backends)",
        include_summary: bool = True,
        include_charts: bool = True,
        include_glossary: bool = True,
        row_limit: Optional[int] = None,
        preview_watermark: bool = False,
    ) -> str:
        ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        now_str = datetime.datetime.now(ist_tz).strftime("%Y-%m-%d %I:%M:%S %p IST")
        aggregates = ReportGenerator.compute_aggregates(report_type, table_rows)
        display_rows = table_rows[:row_limit] if row_limit is not None else table_rows
        headers = fieldnames or (list(table_rows[0].keys()) if table_rows else [])

        th_html = "".join(f"<th>{html.escape(h.replace('_', ' ').title())}</th>" for h in headers)
        tr_html = ""
        for row in display_rows:
            tds = "".join(f"<td>{html.escape(str(row.get(h, '') or '—'))}</td>" for h in headers)
            tr_html += f"<tr>{tds}</tr>"
        if not tr_html:
            tr_html = f'<tr><td colspan="{max(len(headers), 1)}">No rows in this scope.</td></tr>'

        summary_block = ReportGenerator.generate_summary_html(report_type, aggregates, scope_label) if include_summary else ""
        charts_block = ReportGenerator.generate_charts_html(report_type, aggregates) if include_charts else ""
        glossary_block = ReportGenerator.generate_glossary_html(headers) if include_glossary else ""
        truncated_note = ""
        if row_limit is not None and len(table_rows) > len(display_rows):
            truncated_note = (
                f'<p class="truncate-note">Showing {len(display_rows)} of {len(table_rows)} rows '
                f'({"preview" if preview_watermark else "export cap"}).</p>'
            )

        watermark = '<div class="watermark">PREVIEW</div>' if preview_watermark else ""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{html.escape(title)}</title>
  <style>
    @page {{ margin: 18mm 14mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
      color: #0f172a; background: #f8fafc; margin: 0; padding: 24px;
      line-height: 1.45; font-size: 13px;
    }}
    .sheet {{
      max-width: 920px; margin: 0 auto; background: #fff;
      border: 2px solid #0e7490; border-radius: 4px;
      box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
      position: relative; overflow: hidden;
    }}
    .watermark {{
      position: absolute; inset: 40% 0 auto 0; text-align: center;
      font-size: 72px; font-weight: 800; color: rgba(14, 116, 144, 0.08);
      transform: rotate(-18deg); pointer-events: none; user-select: none;
    }}
    .head-band {{
      display: flex; justify-content: space-between; gap: 16px;
      padding: 20px 24px; border-bottom: 3px solid #0891b2;
      background: linear-gradient(180deg, #ecfeff 0%, #fff 100%);
    }}
    .org {{ font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #0e7490; font-weight: 700; }}
    .title {{ font-size: 22px; font-weight: 700; color: #0f172a; margin: 6px 0 0; }}
    .subtitle {{ font-size: 13px; color: #475569; margin-top: 4px; }}
    .meta {{ text-align: right; font-size: 11px; color: #64748b; }}
    .meta strong {{ display: block; color: #334155; font-size: 12px; }}
    .body {{ padding: 20px 24px 28px; }}
    .kpi-grid {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px; margin-bottom: 18px;
    }}
    .kpi {{
      border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #f1f5f9;
    }}
    .kpi-k {{ display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }}
    .kpi-v {{ display: block; font-size: 18px; font-weight: 700; color: #0e7490; margin-top: 4px; }}
    .charts-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 18px; }}
    .chart {{ margin: 0; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #fff; }}
    .chart figcaption {{ font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; }}
    .chart-label {{ font-size: 11px; fill: #475569; }}
    .chart-bar {{ fill: #0891b2; }}
    .chart-val {{ font-size: 11px; fill: #0f172a; font-weight: 600; }}
    h2.section-title {{ font-size: 14px; margin: 0 0 10px; color: #0f172a; border-left: 4px solid #0891b2; padding-left: 8px; }}
    table.data {{
      width: 100%; border-collapse: collapse; border: 1px solid #94a3b8;
      font-size: 12px;
    }}
    table.data th, table.data td {{
      border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top;
    }}
    table.data th {{ background: #e0f2fe; color: #0c4a6e; font-weight: 600; }}
    table.data tr:nth-child(even) td {{ background: #f8fafc; }}
    .truncate-note {{ font-size: 11px; color: #64748b; margin: 0 0 8px; }}
    .glossary {{ margin-top: 18px; font-size: 11px; color: #475569; }}
    .glossary ul {{ margin: 6px 0 0; padding-left: 18px; }}
    .foot-band {{
      border-top: 2px solid #0891b2; padding: 12px 24px; font-size: 10px; color: #64748b;
      display: flex; justify-content: space-between; gap: 12px; background: #f1f5f9;
    }}
    @media print {{
      body {{ background: #fff; padding: 0; }}
      .sheet {{ border: none; box-shadow: none; max-width: none; }}
      .watermark {{ color: rgba(14, 116, 144, 0.12); }}
    }}
  </style>
</head>
<body>
  <article class="sheet">
    {watermark}
    <header class="head-band">
      <div>
        <div class="org">{html.escape(ReportGenerator.ORG_NAME)}</div>
        <h1 class="title">{html.escape(title)}</h1>
        <p class="subtitle">{html.escape(subtitle)}</p>
      </motion-div>
      <div class="meta">
        <strong>Generated</strong>
        {html.escape(now_str)}<br>
        <strong>Report kind</strong> {html.escape(report_type.replace('_', ' '))}<br>
        <strong>{html.escape(ReportGenerator.PLATFORM)}</strong>
      </div>
    </header>
    <div class="body">
      {summary_block}
      {charts_block}
      <h2 class="section-title">Telemetry detail</h2>
      {truncated_note}
      <table class="data">
        <thead><tr>{th_html}</tr></thead>
        <tbody>{tr_html}</tbody>
      </table>
      {glossary_block}
    </div>
    <footer class="foot-band">
      <span>Confidential — internal operations evidence. Verify hashes on downloadable ZIP snapshots where applicable.</span>
      <span>© {datetime.datetime.now().year} C-DAC quantum telemetry programme</span>
    </footer>
  </article>
</body>
</html>"""