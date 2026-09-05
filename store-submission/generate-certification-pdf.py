from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "contract-definitions-certification-info.pdf"

NAVY = colors.HexColor("#18324A")
BLUE = colors.HexColor("#1769AA")
LIGHT_BLUE = colors.HexColor("#EEF5FA")
GREEN = colors.HexColor("#2A7657")
LIGHT_GREEN = colors.HexColor("#EDF7F2")
MID = colors.HexColor("#566573")
LINE = colors.HexColor("#D5E0E8")
WHITE = colors.white

STABLE_APP = "https://app.contract-definitions.gut-ventures.com/"
TESTED_RELEASE = "https://f4f1217a.contract-definition-companion-app.pages.dev/"
SITE = "https://contract-definitions.gut-ventures.com/"
DEMO = SITE + "demo/Contract-Definitions-Demo-SPA.docx"
SUPPORT = SITE + "support/"
PRIVACY = SITE + "privacy/"


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=25, leading=29, textColor=NAVY, alignment=TA_CENTER,
    spaceAfter=5 * mm,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle", parent=styles["Normal"], fontName="Helvetica",
    fontSize=12, leading=16, textColor=MID, alignment=TA_CENTER,
    spaceAfter=8 * mm,
))
styles.add(ParagraphStyle(
    name="H1Custom", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=15, leading=18, textColor=NAVY, spaceBefore=2 * mm,
    spaceAfter=3 * mm,
))
styles.add(ParagraphStyle(
    name="H2Custom", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=13, textColor=NAVY, spaceBefore=1.5 * mm,
    spaceAfter=1.5 * mm,
))
styles.add(ParagraphStyle(
    name="BodyCustom", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.7, leading=11.5, textColor=colors.HexColor("#263746"),
    spaceAfter=1.5 * mm,
))
styles.add(ParagraphStyle(
    name="Small", parent=styles["BodyCustom"], fontSize=7.7, leading=10,
    textColor=MID, spaceAfter=0.8 * mm,
))
styles.add(ParagraphStyle(
    name="TableLabel", parent=styles["BodyCustom"], fontName="Helvetica-Bold",
    fontSize=7.8, leading=9.8, textColor=NAVY, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="TableValue", parent=styles["BodyCustom"], fontSize=7.8,
    leading=9.8, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="Callout", parent=styles["BodyCustom"], fontSize=9.2,
    leading=12.3, textColor=NAVY, spaceAfter=0,
))
styles.add(ParagraphStyle(
    name="LinkSmall", parent=styles["Small"], textColor=BLUE,
    wordWrap="CJK",
))


def P(text, style="BodyCustom"):
    return Paragraph(text, styles[style])


def linked(url, label=None):
    label = label or url
    return f'<link href="{url}" color="#1769AA">{label}</link>'


def bullet_list(items, level=0, font_size=8.5, leading=11):
    item_style = ParagraphStyle(
        f"Bullet{level}-{font_size}", parent=styles["BodyCustom"],
        fontSize=font_size, leading=leading, spaceAfter=0,
    )
    return ListFlowable(
        [ListItem(Paragraph(item, item_style), leftIndent=0, spaceAfter=1.2 * mm) for item in items],
        bulletType="bullet", start="circle", leftIndent=(5 + level * 3) * mm,
        bulletFontName="Helvetica", bulletFontSize=6, bulletColor=BLUE,
        bulletOffsetY=1,
    )


def section(title, body):
    return KeepTogether([P(title, "H1Custom"), *body])


def callout(content, background=LIGHT_BLUE, accent=BLUE):
    table = Table([[P(content, "Callout")]], colWidths=[171 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.6, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def page_frame(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, height - 15 * mm, width - 20 * mm, height - 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MID)
    canvas.drawString(20 * mm, height - 11.5 * mm, "Contract Definitions - Microsoft Certification Information")
    canvas.drawRightString(width - 20 * mm, height - 11.5 * mm, f"Page {doc.page}")
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.drawString(20 * mm, 9.5 * mm, "GUT Ventures GmbH")
    canvas.drawRightString(width - 20 * mm, 9.5 * mm, "Prepared for Microsoft Marketplace certification")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=21 * mm, bottomMargin=19 * mm,
        title="Contract Definitions - Microsoft Certification Information",
        author="GUT Ventures GmbH",
        subject="Reviewer instructions and privacy information for Microsoft Marketplace certification",
    )
    story = []

    story.extend([
        Spacer(1, 13 * mm),
        P("Contract Definitions", "CoverTitle"),
        P("Microsoft Marketplace certification information", "CoverSubtitle"),
    ])

    identity = [
        [P("Publisher", "TableLabel"), P("GUT Ventures GmbH", "TableValue")],
        [P("Manifest version", "TableLabel"), P("1.0.0.5", "TableValue")],
        [P("Add-in ID", "TableLabel"), P("7f9bbabc-5f39-4743-9b46-5e0b7e9a9362", "TableValue")],
        [P("Authentication", "TableLabel"), P("None", "TableValue")],
        [P("Payment / license", "TableLabel"), P("None - free and fully functional without an account", "TableValue")],
        [P("Document processing", "TableLabel"), P("Local inside the Word add-in WebView; no contract upload or application backend", "TableValue")],
    ]
    table = Table(identity, colWidths=[42 * mm, 129 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BLUE),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([
        table, Spacer(1, 5 * mm),
        callout("<b>No credentials are required.</b> Reviewers can exercise every feature with the supplied synthetic Word document.", LIGHT_GREEN, GREEN),
        Spacer(1, 5 * mm),
        P("Reviewer package", "H1Custom"),
        bullet_list([
            "Production manifest: <b>manifest.production.xml</b>",
            "Sample document: <b>Contract-Definitions-Demo-SPA.docx</b>",
            f"Public sample document: {linked(DEMO)}",
            f"Support: {linked(SUPPORT)}",
            f"Privacy policy: {linked(PRIVACY)}",
        ], font_size=8.7, leading=11.5),
        Spacer(1, 2 * mm),
        P("The sample document contains only fictional companies, names, addresses, transaction details, and commercial terms. It is expressly marked as a demo and is suitable for certification testing.", "Small"),
        Spacer(1, 4 * mm),
        P("Production delivery", "H1Custom"),
        callout(
            f"<b>Stable manifest endpoint</b><br/>{linked(STABLE_APP)}<br/><br/>"
            f"<b>Tested immutable release</b><br/>{linked(TESTED_RELEASE)}<br/><br/>"
            "The stable Cloudflare Pages production URL currently resolves to the tested immutable release. The hash-addressed release remains available for audit and rollback. Office.js is loaded from Microsoft's official CDN."
        ),
        PageBreak(),
    ])

    story.extend([
        section("1. Product overview", [
            P("Contract Definitions turns the defined terms in an open English-language Word document into a searchable task-pane index. Reviewers can read definitions, jump to the source definition, navigate detected occurrences, pin terms, refresh after document changes, and optionally add temporary inline annotations."),
            P("The add-in uses deterministic, rule-based parsing. It does not use AI, an application server, telemetry, advertising, or analytics."),
        ]),
        section("2. Access and dependencies", [
            bullet_list([
                "No test account, credentials, license key, tenant configuration, subscription, or external purchase is required.",
                "The add-in does not use Microsoft Entra ID or single sign-on.",
                "Internet access is required only for the static production files and Microsoft Office.js.",
                "The add-in requests <b>ReadWriteDocument</b> to read paragraph text, select definitions and occurrences, and insert or remove temporary Word annotations.",
            ]),
        ]),
        P("3. Detailed test procedure", "H1Custom"),
        ListFlowable([
            ListItem(P(text), leftIndent=0, spaceAfter=1.15 * mm)
            for text in [
                "Open <b>Contract-Definitions-Demo-SPA.docx</b> in Microsoft Word.",
                "On the Home ribbon, choose <b>Definitions</b>, then <b>Definitions</b> to open the Contract Definitions task pane.",
                "Wait for the automatic scan. A searchable list of defined terms should appear. The sample document should yield dozens of definitions.",
                "Search for <b>Purchase Price</b>. Select the result and confirm that its definition and usage count are displayed.",
                "Choose <b>Go to definition</b>. Word should select the source definition without changing the contract text.",
                "Use <b>Previous</b> and <b>Next</b>. Word should select successive detected occurrences in the document.",
                "Clear the search and pin one or more definitions. Pinned terms should remain at the top while the task pane is open.",
                "Edit a harmless word in the demo document and choose <b>Refresh</b>. The index should be recalculated from the current open document.",
                "On a client supporting WordApi 1.7, choose <b>Annotate all defined terms</b>. Temporary inline annotations should appear. Choose <b>Remove annotations</b> and confirm that they are removed.",
                "Open <b>Menu - Privacy</b>. Confirm that contract text is processed locally and is not uploaded to an application server or AI service.",
            ]
        ], bulletType="1", start="1", leftIndent=6 * mm, bulletFontName="Helvetica-Bold", bulletFontSize=8.2, bulletColor=BLUE),
        PageBreak(),
    ])

    story.extend([
        P("4. Expected behavior and fallback", "H1Custom"),
        P("Core workflow", "H2Custom"),
        bullet_list([
            "Definition detection, search, pinning, navigation, and refresh are available on WordApi 1.6 clients.",
            "The add-in does not rewrite the underlying contract language. Navigation changes only the current selection.",
            "Temporary annotations are inserted only after an explicit user action and can be removed from the task pane.",
        ], font_size=8.2, leading=10.4),
        P("WordApi 1.6 fallback", "H2Custom"),
        bullet_list([
            "If WordApi 1.7 annotations are unavailable, annotation controls are not shown. Core detection and navigation remain functional.",
            "If no recognizable English definitions section is found, the task pane displays <b>No definitions found</b> and offers a refresh action.",
            "If browser storage is unavailable, the add-in continues to work; only non-document preferences are not persisted.",
        ], font_size=8.2, leading=10.4),
        P("Supported environments", "H2Custom"),
    ])
    environments = [
        [P("Environment", "TableLabel"), P("Expected result", "TableLabel"), P("Status", "TableLabel")],
        [P("Word on Mac (Microsoft 365)", "TableValue"), P("Full core workflow; annotations where WordApi 1.7 is available", "TableValue"), P("Stable production URL smoke-tested", "TableValue")],
        [P("Word 2019 or later on Mac", "TableValue"), P("Core workflow; API-dependent fallback", "TableValue"), P("Declared by manifest", "TableValue")],
        [P("Word on the web", "TableValue"), P("Full core workflow; annotations where supported", "TableValue"), P("Declared by manifest", "TableValue")],
        [P("Word on Windows (Microsoft 365)", "TableValue"), P("Full core workflow; annotations where supported", "TableValue"), P("Declared by manifest", "TableValue")],
        [P("Word on iPad", "TableValue"), P("Meaningful touch workflow on compatible versions", "TableValue"), P("Direct acquisition disabled; compatibility review remains applicable", "TableValue")],
    ]
    environment_table = Table(environments, colWidths=[43 * mm, 74 * mm, 54 * mm], repeatRows=1)
    environment_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BLUE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([
        environment_table,
        P("Microsoft's manifest acceptance service identifies these environments from the declared WordApi 1.6 requirement.", "Small"),
        P("5. Privacy and network behavior", "H1Custom"),
        bullet_list([
            "Contract parsing runs locally in the add-in WebView.",
            "No contract text, scan result, document identifier, user identifier, or usage event is sent to GUT Ventures.",
            "No telemetry, advertising, cookies, or application analytics are used.",
            "Local storage contains only non-document preferences, such as annotation mode and a settings version.",
            "The production Content Security Policy sets <b>connect-src 'none'</b>, preventing application network requests after the static files have loaded.",
            f"Office.js is loaded from {linked('https://appsforoffice.microsoft.com/lib/1/hosted/office.js')} as required by Microsoft.",
        ], font_size=8.0, leading=10.2),
        P("6. Permission justification", "H1Custom"),
        P("<b>ReadWriteDocument</b> is necessary to read paragraph text, select the definition source and detected occurrences, and optionally insert or remove temporary annotations. The add-in does not silently alter contract language and does not transmit document content.", "Small"),
        P("7. Support", "H1Custom"),
        P(f"Support page: {linked(SUPPORT)}<br/>Privacy policy: {linked(PRIVACY)}<br/>Support email: {linked('mailto:lukas@gut-ventures.com', 'lukas@gut-ventures.com')}", "Small"),
    ])

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    print(OUTPUT)


if __name__ == "__main__":
    build()
