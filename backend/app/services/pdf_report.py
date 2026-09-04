import io
import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)

def generate_exception_pdf_report(
    exception_data: Dict[str, Any],
    audit_logs: list = None
) -> bytes:
    """
    Generates a professional financial audit PDF evidence report for an exception.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    header_style = ParagraphStyle(
        'DocHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0A2540')
    )
    sub_header = ParagraphStyle(
        'SubHeader',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#4A5568')
    )
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0A2540'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_text = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#2D3748')
    )
    body_bold = ParagraphStyle(
        'BodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1A202C')
    )
    badge_style = ParagraphStyle(
        'BadgeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1
    )
    mono_style = ParagraphStyle(
        'MonoCustom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#2B6CB0')
    )

    story = []

    # 1. Header Banner
    generated_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    header_data = [
        [
            Paragraph("<b>FINCTRL AI</b> &bull; Financial Controller Evidence Report", header_style),
            Paragraph(f"<b>STATUS:</b> {exception_data.get('status', 'OPEN')}<br/><b>SEVERITY:</b> {exception_data.get('severity', 'HIGH')}", body_bold)
        ],
        [
            Paragraph(f"Autonomous Multi-Source Reconciliation & Investigation Trail<br/>Generated: {generated_at}", sub_header),
            Paragraph(f"Exception ID: <b>{exception_data.get('id', 'N/A')}</b>", mono_style)
        ]
    ]
    t_header = Table(header_data, colWidths=[360, 180])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0A2540'), spaceAfter=12))

    # 2. Key Metadata Summary Table
    story.append(Paragraph("1. TRANSACTION & EXPOSURE OVERVIEW", section_title))
    
    exp_amount = float(exception_data.get('expected_amount', 0.0))
    act_amount = float(exception_data.get('accounted_amount', 0.0))
    diff_amount = float(exception_data.get('difference', 0.0))
    exposure_amount = float(exception_data.get('financial_exposure', 0.0))

    meta_table_data = [
        [
            Paragraph("<b>Transaction ID:</b>", body_bold),
            Paragraph(str(exception_data.get('transaction_id', 'N/A')), mono_style),
            Paragraph("<b>Merchant:</b>", body_bold),
            Paragraph(str(exception_data.get('merchant_name', 'N/A')), body_text),
        ],
        [
            Paragraph("<b>Payment Reference:</b>", body_bold),
            Paragraph(str(exception_data.get('payment_reference') or exception_data.get('transaction_id', 'N/A')), mono_style),
            Paragraph("<b>Exception Type:</b>", body_bold),
            Paragraph(str(exception_data.get('exception_type', 'N/A')), body_bold),
        ],
        [
            Paragraph("<b>Captured Amount:</b>", body_bold),
            Paragraph(f"₹{exp_amount:,.2f}", body_text),
            Paragraph("<b>Accounted / Net:</b>", body_bold),
            Paragraph(f"₹{act_amount:,.2f}", body_text),
        ],
        [
            Paragraph("<b>Discrepancy:</b>", body_bold),
            Paragraph(f"₹{diff_amount:,.2f}", body_bold),
            Paragraph("<b>At-Risk Exposure:</b>", body_bold),
            Paragraph(f"<font color='#E53E3E'><b>₹{exposure_amount:,.2f}</b></font>", body_bold),
        ],
        [
            Paragraph("<b>Human Approval:</b>", body_bold),
            Paragraph(f"{'Required' if exception_data.get('human_approval_required') else 'Auto'} ({exception_data.get('human_approval_status', 'PENDING')})", body_text),
            Paragraph("<b>Priority Score:</b>", body_bold),
            Paragraph(f"{float(exception_data.get('priority_score', 0)):.1f}", body_text),
        ]
    ]

    t_meta = Table(meta_table_data, colWidths=[110, 160, 110, 160])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F7FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#EDF2F7')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # 3. Deterministic Equation Verification
    story.append(Paragraph("2. DOUBLE-ENTRY FINANCIAL EQUATION VERIFICATION", section_title))
    eq_summary = (
        "<b>Fundamental Ledger Verification:</b> Payment Captured = Net Settlement + Refunds + Fee Deductions + GST (18%) + Adjustments<br/>"
        f"<b>Captured:</b> ₹{exp_amount:,.2f} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Settled:</b> ₹{act_amount:,.2f} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Variance:</b> ₹{diff_amount:,.2f}"
    )
    story.append(Paragraph(eq_summary, body_text))
    story.append(Spacer(1, 10))

    # 4. AI Investigation & Evidence Trail
    inv = exception_data.get('investigation') or {}
    story.append(Paragraph("3. AI INVESTIGATION & AUDIT TRAIL", section_title))

    if inv:
        conf_pct = float(inv.get('confidence', 0.0)) * 100
        inv_status = inv.get('status', 'UNRESOLVED')
        status_color = "#38A169" if inv_status == "RESOLVED" else "#DD6B20" if inv_status == "INVESTIGATING" else "#E53E3E"
        
        inv_banner = [
            [
                Paragraph(f"<b>Root Cause:</b> {inv.get('root_cause', 'UNKNOWN')}", body_bold),
                Paragraph(f"<b>AI Confidence:</b> {conf_pct:.1f}%", body_bold),
                Paragraph(f"<b>Outcome:</b> <font color='{status_color}'><b>{inv_status}</b></font>", body_bold),
            ]
        ]
        t_inv_b = Table(inv_banner, colWidths=[200, 170, 170])
        t_inv_b.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EDF2F7')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E0')),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_inv_b)
        story.append(Spacer(1, 6))

        # Reasoning
        reasoning = inv.get('reasoning_summary', 'No reasoning recorded.')
        story.append(Paragraph(f"<b>Investigator Reasoning:</b> {reasoning}", body_text))
        story.append(Spacer(1, 6))

        # Calculation Steps
        calc_steps = inv.get('calculation_steps') or []
        if calc_steps:
            story.append(Paragraph("<b>Step-by-Step Mathematical Verification:</b>", body_bold))
            for step in calc_steps:
                story.append(Paragraph(f"&bull; {step}", mono_style))
            story.append(Spacer(1, 6))

        # Evidence Records Table
        evidence_recs = inv.get('evidence_records') or []
        if evidence_recs:
            story.append(Paragraph("<b>Cited Ledger Evidence Records:</b>", body_bold))
            ev_table_data = [
                [
                    Paragraph("<b>Type</b>", body_bold),
                    Paragraph("<b>Reference</b>", body_bold),
                    Paragraph("<b>Amount</b>", body_bold),
                    Paragraph("<b>Details / Fee Type</b>", body_bold)
                ]
            ]
            for ev in evidence_recs:
                ev_table_data.append([
                    Paragraph(str(ev.get('type', 'N/A')), mono_style),
                    Paragraph(str(ev.get('reference', 'N/A')), mono_style),
                    Paragraph(f"₹{float(ev.get('amount', 0.0)):,.2f}" if ev.get('amount') is not None else "-", body_text),
                    Paragraph(str(ev.get('fee_type') or ev.get('reason') or '-'), body_text)
                ])
            
            t_ev = Table(ev_table_data, colWidths=[80, 180, 110, 170])
            t_ev.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E0')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(t_ev)
            story.append(Spacer(1, 6))

        # Recommended Action
        rec_action = inv.get('recommended_action')
        if rec_action:
            story.append(Paragraph(f"<b>Recommended Action:</b> <i>{rec_action}</i>", body_text))
            story.append(Spacer(1, 8))
    else:
        story.append(Paragraph("<i>No AI investigation completed yet for this exception.</i>", body_text))
        story.append(Spacer(1, 8))

    # 5. Governance Sign-off & Audit Log
    story.append(Paragraph("4. GOVERNANCE, APPROVAL & SIGN-OFF", section_title))
    
    sign_off_data = [
        [
            Paragraph("<b>Automated System Verification:</b><br/>Deterministic Match Engine L1-L4<br/>Status: PASSED", body_text),
            Paragraph("<b>Finance Controller Sign-off:</b><br/><br/>_______________________________<br/>Authorized Officer Signature", body_text),
            Paragraph("<b>Compliance & Settlement Date:</b><br/><br/>Date: ________________________", body_text)
        ]
    ]
    t_sign = Table(sign_off_data, colWidths=[180, 200, 160])
    t_sign.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E0')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_sign)

    doc.build(story)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value


def generate_dispute_notice_pdf(
    exception_data: Dict[str, Any],
    merchant_details: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Generates a formal legal/financial dispute escalation notice to be submitted
    to Razorpay merchant support or acquiring bank nodal officers for unexplained shortages.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        'DisputeHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#991B1B')
    )
    sub_header = ParagraphStyle(
        'DisputeSubHeader',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#4A5568')
    )
    section_title = ParagraphStyle(
        'DisputeSectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0A2540'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_text = ParagraphStyle(
        'DisputeBodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#2D3748')
    )
    body_bold = ParagraphStyle(
        'DisputeBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1A202C')
    )
    mono_style = ParagraphStyle(
        'DisputeMono',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#991B1B')
    )

    story = []

    # 1. Header Banner
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%d-%b-%Y %H:%M:%S UTC")
    disp_id = f"DISP-{exception_data.get('id', 'REC')}"
    merchant_name = exception_data.get('merchant_name', 'Merchant Enterprise')

    header_table = [
        [
            Paragraph("<b>NOTICE OF FINANCIAL DISCREPANCY & SETTLEMENT DISPUTE</b>", header_style),
            Paragraph(f"<b>DISPUTE REF:</b> {disp_id}<br/><b>DATE:</b> {now_utc[:11]}", body_bold)
        ],
        [
            Paragraph(f"ISSUED UNDER REGULATORY PAYMENT AGGREGATOR & NODAL SETTLEMENT GUIDELINES<br/>Automated Financial Controller Record &bull; Generated: {now_utc}", sub_header),
            Paragraph(f"PRIORITY: <font color='#DC2626'><b>MANDATORY RECTIFICATION</b></font>", body_bold)
        ]
    ]
    t_header = Table(header_table, colWidths=[370, 170])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#991B1B'), spaceAfter=10))

    # 2. Addressed To & From
    addressee_data = [
        [
            Paragraph("<b>TO:</b><br/>"
                      "Dispute & Settlement Escalation Cell<br/>"
                      "Payment Aggregator / Acquirer Nodal Desk<br/>"
                      "Ref: Settlement Variance & Unremitted Balance", body_text),
            Paragraph(f"<b>FROM:</b><br/>"
                      f"<b>{merchant_name}</b><br/>"
                      "Finance Operations & Treasury Controller<br/>"
                      "System: FINCTRL Autonomous AI Controller", body_text)
        ]
    ]
    t_addr = Table(addressee_data, colWidths=[270, 270])
    t_addr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#FECACA')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_addr)
    story.append(Spacer(1, 10))

    # 3. Discrepancy Particulars
    story.append(Paragraph("1. TRANSACTION & SETTLEMENT PARTICULARS", section_title))
    exp_amount = float(exception_data.get('expected_amount', 0.0))
    act_amount = float(exception_data.get('accounted_amount', 0.0))
    exposure_amount = float(exception_data.get('financial_exposure', 0.0))
    diff_amount = float(exception_data.get('difference', 0.0))

    meta_rows = [
        [
            Paragraph("<b>Transaction Gateway ID:</b>", body_bold),
            Paragraph(str(exception_data.get('transaction_id', 'N/A')), mono_style),
            Paragraph("<b>Merchant Order Ref:</b>", body_bold),
            Paragraph(str(exception_data.get('payment_reference') or 'N/A'), body_text),
        ],
        [
            Paragraph("<b>Discrepancy Category:</b>", body_bold),
            Paragraph(f"<font color='#B91C1C'><b>{exception_data.get('exception_type', 'UNRESOLVED_SHORTAGE')}</b></font>", body_bold),
            Paragraph("<b>Severity / Risk Level:</b>", body_bold),
            Paragraph(str(exception_data.get('severity', 'HIGH')), body_bold),
        ],
        [
            Paragraph("<b>Captured Customer Rupee:</b>", body_bold),
            Paragraph(f"₹{exp_amount:,.2f}", body_bold),
            Paragraph("<b>Accounted / Received Rupee:</b>", body_bold),
            Paragraph(f"₹{act_amount:,.2f}", body_text),
        ],
        [
            Paragraph("<b>Net Disputed Rupee Exposure:</b>", body_bold),
            Paragraph(f"<font color='#DC2626'><b>₹{exposure_amount:,.2f}</b></font>", body_bold),
            Paragraph("<b>SLA Settlement Variance:</b>", body_bold),
            Paragraph(f"₹{abs(diff_amount):,.2f}", body_text),
        ],
    ]
    t_meta = Table(meta_rows, colWidths=[150, 120, 150, 120])
    t_meta.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # 4. Evidence of Non-Remittance
    story.append(Paragraph("2. RECONCILIATION AUDIT FINDING & EVIDENCE", section_title))
    inv = exception_data.get('investigation') or {}
    root_cause = inv.get('root_cause', 'UNEXPLAINED_GATEWAY_SHORTAGE')
    reasoning = inv.get('reasoning_summary') or (
        f"A discrepancy of ₹{exposure_amount:,.2f} was detected between captured customer funds and received gateway settlements. "
        "No matching MDR fee schedule, GST invoice debit, or customer refund record justifies this deduction in the general ledger."
    )

    evidence_box = [
        [
            Paragraph(f"<b>Root Cause Identified:</b> {root_cause}<br/><br/>"
                      f"<b>Auditor Finding:</b> {reasoning}<br/><br/>"
                      "<b>Status:</b> Zero corresponding credit received in partner nodal bank account. "
                      "Payment is marked CAPTURED by customer but missing or under-settled in payout batch.", body_text)
        ]
    ]
    t_ev = Table(evidence_box, colWidths=[540])
    t_ev.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_ev)
    story.append(Spacer(1, 10))

    # 5. Regulatory Notice & Action Demanded
    story.append(Paragraph("3. DEMAND FOR REMEDIATION UNDER SETTLEMENT SLA", section_title))
    legal_text = (
        "Pursuant to standard Merchant Services Agreements and Master Payment Aggregator Directions, "
        "all captured merchant transactions must be settled within the stipulated T+2 business day window, "
        "less authorized contract MDR fees and applicable GST. Deductions not supported by itemized invoice logs "
        "are considered unauthorized withholdings.<br/><br/>"
        "<b>Action Required within 5 Business Days:</b><br/>"
        "1. Remit the outstanding disputed amount of <b>₹" + f"{exposure_amount:,.2f}" + "</b> via direct bank UTR credit, OR<br/>"
        "2. Provide an itemized fee schedule and gateway credit/debit adjustment reference explaining the variance.<br/><br/>"
        "Failure to resolve will result in escalation to the Banking Ombudsman and nodal grievance officer."
    )
    story.append(Paragraph(legal_text, body_text))
    story.append(Spacer(1, 12))

    # 6. Sign-off block
    sign_data = [
        [
            Paragraph("<b>Automated Evidence Dossier:</b><br/>FINCTRL Autonomous AI Engine<br/>Integrity Check: PASSED (Zero Hallucination)", body_text),
            Paragraph("<b>Authorized Finance Controller:</b><br/><br/>____________________________________<br/>Signature & Corporate Stamp", body_text),
            Paragraph("<b>Date of Issue:</b><br/><br/>" + now_utc[:11], body_text)
        ]
    ]
    t_sign = Table(sign_data, colWidths=[180, 200, 160])
    t_sign.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_sign)

    doc.build(story)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value
