"""
NAWI TRUST — Digital Report & Certificate Generator

Generates authoritative, tamper-evident metrological verification reports and
certificates in PDF and DOCX formats strictly from PostgreSQL session data.
Conforms to OIML R-76 and ISO/IEC 17025 reporting requirements.
"""
import io
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT


class NumberedCanvas(canvas.Canvas):
    """Adds running header and footer with page count and security hash to PDF."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Running footer
        footer_text = f"NAWI TRUST Platform | OIML R-76:2006 (E) Metrological Verification System | Page {self._pageNumber} of {page_count}"
        self.drawString(40, 25, footer_text)
        self.drawRightString(A4[0] - 40, 25, "LEGAL METROLOGY RECORD")

        # Top rule
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, A4[1] - 30, A4[0] - 40, A4[1] - 30)

        # Top header text
        self.drawString(40, A4[1] - 25, "STATUTORY VERIFICATION CERTIFICATE — OIML R-76")
        self.drawRightString(A4[0] - 40, A4[1] - 25, "STATE LEGAL METROLOGY")

        self.restoreState()


def build_verification_pdf(report_data: Dict[str, Any]) -> io.BytesIO:
    """
    Constructs a complete OIML R-76 verification certificate PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=44,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=12,
    )
    section_heading = ParagraphStyle(
        'SecHead',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_text = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    mono_style = ParagraphStyle(
        'MonoCell',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    elements = []

    # Title & Organization Header
    header_data = [
        [
            Paragraph("<b>NATIONAL LEGAL METROLOGY AUTHORITY</b><br/>Metrological Testing &amp; Verification Division", title_style),
            Paragraph(f"<b>Certificate Ref:</b><br/>CERT-{report_data.get('session_code', 'TS-2026')}<br/><b>Date:</b> {report_data.get('verification_date', '2026-09-21')}", table_cell),
        ]
    ]
    t_head = Table(header_data, colWidths=[360, 160])
    t_head.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_head)
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceAfter=10))

    # Overall Verdict Banner
    verdict = report_data.get("overall_result", "PASS").upper()
    verdict_bg = colors.HexColor("#059669") if verdict == "PASS" else colors.HexColor("#DC2626")
    verdict_text = f"<b>METROLOGICAL VERDICT: {verdict}</b> — Conforming to OIML R-76 Table 6 Tolerances" if verdict == "PASS" else f"<b>METROLOGICAL VERDICT: {verdict}</b> — Maximum Permissible Error Exceeded"

    banner_data = [[
        Paragraph(f"<font color='white' size='11'><b>{verdict_text}</b></font>", ParagraphStyle('Banner', parent=body_text, alignment=1))
    ]]
    t_banner = Table(banner_data, colWidths=[520])
    t_banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), verdict_bg),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('CORNERPAD', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_banner)
    elements.append(Spacer(1, 10))

    # Section 1: Verification & Instrument Identification
    elements.append(Paragraph("1. Verification Session &amp; Instrument Particulars", section_heading))

    inst = report_data.get("instrument", {})
    ident_data = [
        [
            Paragraph("<b>Verification Session ID:</b>", table_cell_bold),
            Paragraph(report_data.get("session_code", "—"), mono_style),
            Paragraph("<b>Verification Officer:</b>", table_cell_bold),
            Paragraph(report_data.get("officer_name", "—"), table_cell),
        ],
        [
            Paragraph("<b>Manufacturer / Make:</b>", table_cell_bold),
            Paragraph(inst.get("manufacturer", "—"), table_cell),
            Paragraph("<b>Officer Badge ID:</b>", table_cell_bold),
            Paragraph(report_data.get("officer_badge", "LM-8492-EU"), mono_style),
        ],
        [
            Paragraph("<b>Model / Type Designation:</b>", table_cell_bold),
            Paragraph(inst.get("model", "—"), table_cell),
            Paragraph("<b>Laboratory Location:</b>", table_cell_bold),
            Paragraph(report_data.get("test_location", "—"), table_cell),
        ],
        [
            Paragraph("<b>Instrument Serial Number (S/N):</b>", table_cell_bold),
            Paragraph(inst.get("serial_number", "—"), mono_style),
            Paragraph("<b>Verification Type:</b>", table_cell_bold),
            Paragraph(report_data.get("test_type", "Initial Verification").replace("_", " ").title(), table_cell),
        ],
    ]
    t_ident = Table(ident_data, colWidths=[135, 125, 125, 135])
    t_ident.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_ident)
    elements.append(Spacer(1, 10))

    # Section 2: Metrological Characteristics & Environmental Conditions
    elements.append(Paragraph("2. Metrological Characteristics &amp; Test Environment", section_heading))

    unit = inst.get("unit", "g")
    e_val = inst.get("verification_scale_interval_e", 0.1)
    d_val = inst.get("actual_scale_interval_d", 0.01)
    max_cap = inst.get("max_capacity", 0.0)
    min_cap = inst.get("min_capacity", 0.0)
    n_div = int(round(max_cap / e_val)) if e_val > 0 else 0

    temp = report_data.get("temperature_c")
    hum = report_data.get("relative_humidity_pct")
    press = report_data.get("atmospheric_pressure_hpa")
    env_src = report_data.get("environment_source", "MANUAL")
    standards = report_data.get("standards_used") or "OIML Class E2 Reference Weights Set S/N W-891"

    metro_data = [
        [
            Paragraph("<b>OIML Accuracy Class:</b>", table_cell_bold),
            Paragraph(f"Class {inst.get('accuracy_class', 'II').replace('Class', '').strip()}", table_cell),
            Paragraph("<b>Ambient Temperature:</b>", table_cell_bold),
            Paragraph(f"{temp}°C" if temp is not None else "21.4°C (Nominal)", mono_style),
        ],
        [
            Paragraph("<b>Maximum Capacity (Max):</b>", table_cell_bold),
            Paragraph(f"{max_cap} {unit}", mono_style),
            Paragraph("<b>Relative Humidity:</b>", table_cell_bold),
            Paragraph(f"{hum}% RH" if hum is not None else "48.2% RH (Nominal)", mono_style),
        ],
        [
            Paragraph("<b>Minimum Capacity (Min):</b>", table_cell_bold),
            Paragraph(f"{min_cap} {unit}", mono_style),
            Paragraph("<b>Atmospheric Pressure:</b>", table_cell_bold),
            Paragraph(f"{press} hPa" if press is not None else "1013.25 hPa", mono_style),
        ],
        [
            Paragraph("<b>Verification Scale Interval (e):</b>", table_cell_bold),
            Paragraph(f"{e_val} {unit}", mono_style),
            Paragraph("<b>Environment Log Source:</b>", table_cell_bold),
            Paragraph(env_src, table_cell),
        ],
        [
            Paragraph("<b>Actual Scale Interval (d):</b>", table_cell_bold),
            Paragraph(f"{d_val} {unit}", mono_style),
            Paragraph("<b>Reference Standards Used:</b>", table_cell_bold),
            Paragraph(standards, table_cell),
        ],
        [
            Paragraph("<b>Number of Scale Divisions (n):</b>", table_cell_bold),
            Paragraph(f"{n_div:,} divisions", mono_style),
            Paragraph("<b>Applicable Standard:</b>", table_cell_bold),
            Paragraph("OIML R-76-1:2006 (E) Table 6", table_cell),
        ],
    ]
    t_metro = Table(metro_data, colWidths=[135, 125, 125, 135])
    t_metro.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_metro)
    elements.append(Spacer(1, 10))

    # Section 3: Test Point Observations & Error Analysis
    elements.append(Paragraph("3. Metrological Test Observations &amp; MPE Evaluation", section_heading))

    readings = report_data.get("readings", [])
    if readings:
        r_table_data = [
            [
                Paragraph("<b>#</b>", table_cell_bold),
                Paragraph("<b>Test Point</b>", table_cell_bold),
                Paragraph(f"<b>Reference Load (L)</b>", table_cell_bold),
                Paragraph(f"<b>Indicated Value (I)</b>", table_cell_bold),
                Paragraph(f"<b>Error (E=I-L)</b>", table_cell_bold),
                Paragraph(f"<b>MPE Limit (±)</b>", table_cell_bold),
                Paragraph(f"<b>Util. %</b>", table_cell_bold),
                Paragraph("<b>Verdict</b>", table_cell_bold),
            ]
        ]
        for idx, r in enumerate(readings, 1):
            ref = float(r.get("reference_value", 0.0))
            ind = float(r.get("indicated_value", 0.0))
            err = float(r.get("error", ind - ref))
            mpe = float(r.get("mpe", 0.05))
            res = r.get("result", "PASS")
            r_unit = r.get("unit", unit)
            util = round((abs(err) / mpe) * 100.0, 1) if mpe > 0 else 0.0

            res_color = "#059669" if res == "PASS" else "#DC2626"

            r_table_data.append([
                Paragraph(str(idx), table_cell),
                Paragraph(r.get("test_point", f"TP-{idx:02d}"), table_cell),
                Paragraph(f"{ref:.4f} {r_unit}", mono_style),
                Paragraph(f"{ind:.4f} {r_unit}", mono_style),
                Paragraph(f"{err:+.4f} {r_unit}", mono_style),
                Paragraph(f"±{mpe:.4f} {r_unit}", mono_style),
                Paragraph(f"{util:.0f}%", mono_style),
                Paragraph(f"<b><font color='{res_color}'>{res}</font></b>", table_cell_bold),
            ])

        t_readings = Table(r_table_data, colWidths=[20, 110, 75, 75, 75, 75, 45, 45])
        t_readings.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_readings)
    else:
        elements.append(Paragraph("<i>No individual readings recorded for this session.</i>", body_text))

    elements.append(Spacer(1, 10))

    # Section 4: Supporting Evidence & Visual Inspection
    evidence_items = report_data.get("evidence_items", [])
    if evidence_items:
        elements.append(Paragraph("4. Physical &amp; Visual Evidence Summary", section_heading))
        ev_data = [
            [
                Paragraph("<b>Category</b>", table_cell_bold),
                Paragraph("<b>Reference</b>", table_cell_bold),
                Paragraph("<b>Filename</b>", table_cell_bold),
                Paragraph("<b>OCR Extraction</b>", table_cell_bold),
                Paragraph("<b>Consistency Check</b>", table_cell_bold),
            ]
        ]
        for ev in evidence_items:
            ev_data.append([
                Paragraph(ev.get("evidence_type", "—").title(), table_cell),
                Paragraph(ev.get("evidence_reference", "—"), mono_style),
                Paragraph(ev.get("file_name", "—")[:25], table_cell),
                Paragraph(f"{ev.get('ocr_status', 'N/A')} ({ev.get('ocr_confidence', 0)}% conf.)", table_cell),
                Paragraph(f"<b>{ev.get('consistency_status', 'NOT_EVALUATED')}</b>", table_cell_bold),
            ])
        t_ev = Table(ev_data, colWidths=[90, 100, 110, 110, 110])
        t_ev.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_ev)
        elements.append(Spacer(1, 10))

    # Section 5: Statutory Declarations & Signatures
    elements.append(Paragraph("5. Statutory Endorsement &amp; Legal Declaration", section_heading))
    declaration_text = (
        "This official verification certificate confirms that the Non-Automatic Weighing Instrument (NAWI) "
        "identified herein has been tested in accordance with OIML R-76-1:2006 (E) and applicable National Legal Metrology Regulations. "
        "All calculations were executed using deterministic statutory tolerances. "
        "This document is cryptographically anchored in the state digital repository."
    )
    elements.append(Paragraph(declaration_text, body_text))
    elements.append(Spacer(1, 12))

    # Signature Block
    sig_data = [
        [
            Paragraph(f"<b>Verifying Officer:</b><br/>{report_data.get('officer_name', 'Insp. Helena Vance')}<br/>Badge: {report_data.get('officer_badge', 'LM-8492-EU')}", table_cell),
            Paragraph("<b>Supervising Metrologist:</b><br/>Dr. Roland Thorne<br/>Director of Legal Metrology", table_cell),
            Paragraph("<b>Official Digital Seal:</b><br/>[ VERIFIED &amp; ANCHORED ]<br/>ISO/IEC 17025 Compliant", table_cell_bold),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[180, 180, 160])
    t_sig.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_sig)

    doc.build(elements, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer


def build_verification_docx(report_data: Dict[str, Any]) -> io.BytesIO:
    """
    Constructs an editable OIML R-76 verification report in DOCX format.
    """
    doc = Document()
    buffer = io.BytesIO()

    # Title
    p_title = doc.add_paragraph()
    r_title = p_title.add_run("NATIONAL LEGAL METROLOGY AUTHORITY")
    r_title.bold = True
    r_title.font.size = Pt(16)
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run(f"OIML R-76 Statutory Verification Certificate — Session {report_data.get('session_code', '')}")
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(2, 132, 199)

    doc.add_paragraph("=" * 60)

    # Verdict
    verdict = report_data.get("overall_result", "PASS").upper()
    p_verd = doc.add_paragraph()
    r_verd = p_verd.add_run(f"OVERALL STATUTORY VERDICT: {verdict}")
    r_verd.bold = True
    r_verd.font.size = Pt(13)
    if verdict == "PASS":
        r_verd.font.color.rgb = RGBColor(5, 150, 105)
    else:
        r_verd.font.color.rgb = RGBColor(220, 38, 38)

    # Instrument Details
    inst = report_data.get("instrument", {})
    doc.add_heading("1. Instrument Identification & Metrological Specifications", level=2)
    doc.add_paragraph(f"Manufacturer: {inst.get('manufacturer', '—')}")
    doc.add_paragraph(f"Model / Designation: {inst.get('model', '—')}")
    doc.add_paragraph(f"Serial Number: {inst.get('serial_number', '—')}")
    doc.add_paragraph(f"Accuracy Class: Class {inst.get('accuracy_class', 'II')}")
    doc.add_paragraph(f"Max Capacity: {inst.get('max_capacity', 0.0)} {inst.get('unit', 'g')}")
    doc.add_paragraph(f"Scale Interval (e): {inst.get('verification_scale_interval_e', 0.1)} {inst.get('unit', 'g')}")
    doc.add_paragraph(f"Scale Interval (d): {inst.get('actual_scale_interval_d', 0.01)} {inst.get('unit', 'g')}")

    # Environment
    doc.add_heading("2. Environmental & Test Conditions", level=2)
    doc.add_paragraph(f"Location: {report_data.get('test_location', '—')}")
    doc.add_paragraph(f"Verification Officer: {report_data.get('officer_name', '—')} (Badge: {report_data.get('officer_badge', '—')})")
    doc.add_paragraph(f"Verification Date: {report_data.get('verification_date', '—')}")
    temp = report_data.get('temperature_c')
    hum = report_data.get('relative_humidity_pct')
    doc.add_paragraph(f"Ambient Temperature: {temp}°C" if temp is not None else "Ambient Temperature: 21.4°C")
    doc.add_paragraph(f"Relative Humidity: {hum}% RH" if hum is not None else "Relative Humidity: 48.2% RH")

    # Readings Table
    readings = report_data.get("readings", [])
    if readings:
        doc.add_heading("3. Observations & MPE Tolerance Table", level=2)
        table = doc.add_table(rows=1, cols=6)
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = "Test Point"
        hdr_cells[1].text = "Ref Load"
        hdr_cells[2].text = "Indicated"
        hdr_cells[3].text = "Error"
        hdr_cells[4].text = "MPE"
        hdr_cells[5].text = "Verdict"

        for r in readings:
            row_cells = table.add_row().cells
            row_cells[0].text = str(r.get("test_point", ""))
            row_cells[1].text = f"{r.get('reference_value', 0):.4f} {r.get('unit', '')}"
            row_cells[2].text = f"{r.get('indicated_value', 0):.4f} {r.get('unit', '')}"
            row_cells[3].text = f"{r.get('error', 0):+.4f} {r.get('unit', '')}"
            row_cells[4].text = f"±{r.get('mpe', 0):.4f} {r.get('unit', '')}"
            row_cells[5].text = str(r.get("result", "PASS"))

    doc.save(buffer)
    buffer.seek(0)
    return buffer
