#!/usr/bin/env python3
"""Convert Baseline launch docs to PDF via Chromium headless.

Inputs:  /app/docs/sales/*.md
         /app/docs/operations/DIGITALOCEAN_EXECUTION.md
         /app/docs/operations/PRODUCTION_VERIFICATION_CHECKLIST.md
         /app/docs/operations/PRODUCTION_READINESS_REPORT.md
         /app/docs/onboarding/14_DAY_PILOT_SOP.md

Output:  /app/public/downloads/<flat-name>.pdf
         /app/public/downloads/index.json
         /app/public/downloads/baseline-launch-bundle.zip
"""
import os
import re
import json
import shutil
import zipfile
import subprocess
import tempfile
from pathlib import Path

import markdown

ROOT = Path("/app")
OUT_DIR = ROOT / "public" / "downloads"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# (source_path, friendly_title, output_filename)
DOCS = [
    # Sales playbooks
    ("docs/sales/SALES_OPERATOR_QUICKSTART.md", "Sales Operator Quickstart", "sales-operator-quickstart.pdf"),
    ("docs/sales/README.md", "Sales Playbook Index", "sales-playbook-index.pdf"),
    ("docs/sales/property-management.md", "Property Management — Sales Playbook", "playbook-property-management.pdf"),
    ("docs/sales/general-contractor.md", "General Contractor — Sales Playbook", "playbook-general-contractor.pdf"),
    ("docs/sales/home-services.md", "Home Services — Sales Playbook", "playbook-home-services.pdf"),
    ("docs/sales/real-estate.md", "Real Estate — Sales Playbook", "playbook-real-estate.pdf"),
    ("docs/sales/mortgage.md", "Mortgage — Sales Playbook", "playbook-mortgage.pdf"),
    ("docs/sales/cpa.md", "CPA / Accounting — Sales Playbook", "playbook-cpa.pdf"),
    ("docs/sales/law-firm.md", "Law Firm — Sales Playbook", "playbook-law-firm.pdf"),
    ("docs/sales/marketing-agency.md", "Marketing Agency — Sales Playbook", "playbook-marketing-agency.pdf"),
    ("docs/sales/ai-agency.md", "AI Agency — Sales Playbook", "playbook-ai-agency.pdf"),
    # Operations
    ("docs/operations/DIGITALOCEAN_EXECUTION.md", "DigitalOcean Production Deployment", "ops-digitalocean-execution.pdf"),
    ("docs/operations/PRODUCTION_VERIFICATION_CHECKLIST.md", "Production Verification Checklist", "ops-production-verification-checklist.pdf"),
    ("docs/operations/PRODUCTION_READINESS_REPORT.md", "Production Readiness Report", "ops-production-readiness-report.pdf"),
    # Onboarding
    ("docs/onboarding/14_DAY_PILOT_SOP.md", "14-Day Pilot SOP", "onboarding-14-day-pilot-sop.pdf"),
]

CSS = """
@page {
  size: Letter;
  margin: 0.7in 0.6in 0.8in 0.6in;
  @bottom-center {
    content: "Baseline AI Workforce OS — " counter(page) " / " counter(pages);
    font-family: -apple-system, "Inter", system-ui, sans-serif;
    font-size: 9pt;
    color: #6b7280;
  }
}
* { box-sizing: border-box; }
html, body {
  font-family: -apple-system, "Inter", "Segoe UI", Roboto, system-ui, sans-serif;
  font-size: 10.5pt;
  line-height: 1.5;
  color: #111827;
  margin: 0;
}
.cover {
  page-break-after: always;
  padding: 1.5in 0.4in 0 0.4in;
  border-left: 8px solid #0ea5e9;
}
.cover .kicker {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #0ea5e9;
  font-size: 10pt;
  font-weight: 600;
  margin-bottom: 0.4in;
}
.cover h1 {
  font-size: 32pt;
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 0.3in 0;
  letter-spacing: -0.02em;
}
.cover .meta {
  margin-top: 0.6in;
  font-size: 10pt;
  color: #6b7280;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.2in;
}
.cover .doctrine {
  margin-top: 0.5in;
  padding: 0.18in 0.22in;
  background: #0b1220;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 9.5pt;
}
.cover .doctrine strong { color: #38bdf8; }

h1, h2, h3, h4 {
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #0f172a;
  page-break-after: avoid;
}
h1 { font-size: 20pt; margin: 0.4in 0 0.12in 0; border-bottom: 2px solid #0ea5e9; padding-bottom: 0.06in; }
h2 { font-size: 14pt; margin: 0.32in 0 0.08in 0; color: #0369a1; }
h3 { font-size: 11.5pt; margin: 0.22in 0 0.06in 0; }
h4 { font-size: 10.5pt; margin: 0.18in 0 0.04in 0; color: #334155; }
p, li { font-size: 10.5pt; }
ul, ol { margin: 0.04in 0 0.12in 0.28in; padding: 0; }
li { margin: 0.02in 0; }
blockquote {
  margin: 0.16in 0;
  padding: 0.08in 0.18in;
  border-left: 3px solid #0ea5e9;
  background: #f0f9ff;
  color: #0f172a;
  font-size: 10pt;
}
code {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9pt;
  background: #f1f5f9;
  padding: 0 0.04in;
  border-radius: 3px;
  color: #0f172a;
}
pre {
  background: #0b1220;
  color: #e2e8f0;
  padding: 0.14in 0.18in;
  border-radius: 6px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 8.8pt;
  line-height: 1.45;
  page-break-inside: avoid;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.12in 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th, td {
  text-align: left;
  padding: 0.06in 0.1in;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}
th {
  background: #f8fafc;
  color: #0f172a;
  font-weight: 700;
  border-bottom: 2px solid #cbd5e1;
}
tr:nth-child(2n) td { background: #fafafa; }
hr { border: 0; border-top: 1px solid #e5e7eb; margin: 0.2in 0; }
a { color: #0369a1; text-decoration: none; }
strong { color: #0f172a; }
em { color: #334155; }
"""

HTML_SHELL = """<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>{css}</style></head><body>
<section class="cover">
  <div class="kicker">Baseline AI Workforce OS</div>
  <h1>{title}</h1>
  <div class="doctrine">
    <strong>Mission Control</strong> supervises &middot;
    <strong>Baseline OS</strong> coordinates &middot;
    <strong>Hermes / OpenClaw / Claude Code</strong> execute
  </div>
  <div class="meta">
    Document: {filename}<br/>
    Source: {source}<br/>
    Generated: {date}
  </div>
</section>
{body}
</body></html>"""


def md_to_html(md_text: str) -> str:
    return markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc", "sane_lists", "nl2br"],
        output_format="html5",
    )


def render_pdf(html_path: Path, pdf_path: Path) -> None:
    cmd = [
        "/usr/bin/google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--virtual-time-budget=5000",
        f"--print-to-pdf={pdf_path}",
        "--print-to-pdf-no-header",
        f"file://{html_path}",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if res.returncode != 0:
        raise RuntimeError(
            f"chromium failed for {html_path.name}: {res.stderr[:500]}"
        )


def main():
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    index = []
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for src, title, outname in DOCS:
            src_path = ROOT / src
            if not src_path.exists():
                print(f"SKIP {src} (missing)")
                continue
            md_text = src_path.read_text(encoding="utf-8")
            # Strip the first H1 since the cover supplies the title
            md_lines = md_text.splitlines()
            for i, line in enumerate(md_lines):
                if line.startswith("# "):
                    md_lines[i] = ""
                    break
            body_html = md_to_html("\n".join(md_lines))
            full_html = HTML_SHELL.format(
                title=title,
                css=CSS,
                filename=outname,
                source=src,
                date=today,
                body=body_html,
            )
            html_path = tmpdir / (outname.replace(".pdf", ".html"))
            html_path.write_text(full_html, encoding="utf-8")
            pdf_path = OUT_DIR / outname
            render_pdf(html_path, pdf_path)
            kb = round(pdf_path.stat().st_size / 1024, 1)
            print(f"OK  {outname} ({kb} KB)")
            index.append({
                "file": outname,
                "title": title,
                "source": src,
                "kb": kb,
            })

    # Bundle ZIP
    zip_path = OUT_DIR / "baseline-launch-bundle.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for entry in index:
            zf.write(OUT_DIR / entry["file"], arcname=entry["file"])
    zip_kb = round(zip_path.stat().st_size / 1024, 1)
    print(f"OK  baseline-launch-bundle.zip ({zip_kb} KB, {len(index)} files)")

    (OUT_DIR / "index.json").write_text(
        json.dumps({"generated": today, "docs": index, "bundle_kb": zip_kb}, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
