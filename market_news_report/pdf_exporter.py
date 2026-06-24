from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


IMAGE_RE = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<path>[^)]+)\)")
LINK_RE = re.compile(r"\[(?P<label>[^\]]+)\]\((?P<url>[^)]+)\)")


def convert_markdown_to_pdf(md_path: str | Path, pdf_path: str | Path | None = None) -> Path:
    md_path = Path(md_path)
    if pdf_path is None:
        pdf_path = md_path.with_suffix(".pdf")
    pdf_path = Path(pdf_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    styles = _styles()
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.65 * inch,
        title=md_path.stem,
    )
    story = _markdown_to_story(md_path.read_text(encoding="utf-8"), md_path.parent, styles)
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return pdf_path


def _markdown_to_story(markdown: str, base_dir: Path, styles) -> list:
    story = []
    lines = markdown.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 0.08 * inch))
            index += 1
            continue
        if stripped == "---":
            story.append(PageBreak())
            index += 1
            continue
        if stripped.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            story.extend(_table_flowables(table_lines, styles))
            continue

        image_match = IMAGE_RE.fullmatch(stripped)
        if image_match:
            story.extend(_image_flowables(image_match.group("path"), image_match.group("alt"), base_dir, styles))
            index += 1
            continue

        if stripped.startswith("# "):
            story.append(Paragraph(_inline(stripped[2:]), styles["Title"]))
            story.append(Spacer(1, 0.14 * inch))
        elif stripped.startswith("## "):
            story.append(Paragraph(_inline(stripped[3:]), styles["Heading2"]))
            story.append(Spacer(1, 0.08 * inch))
        elif stripped.startswith("### "):
            story.append(Paragraph(_inline(stripped[4:]), styles["Heading3"]))
            story.append(Spacer(1, 0.05 * inch))
        elif stripped.startswith("- "):
            story.append(Paragraph(f"- {_inline(stripped[2:])}", styles["Bullet"]))
        else:
            story.append(Paragraph(_inline(stripped), styles["Body"]))
        index += 1
    return story


def _table_flowables(lines: list[str], styles) -> list:
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if all(set(cell) <= {"-", ":", " "} for cell in cells):
            continue
        rows.append([Paragraph(_inline(cell), styles["TableCell"]) for cell in cells])
    if not rows:
        return []

    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f0f5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#17324d")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c7d1d8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return [table, Spacer(1, 0.12 * inch)]


def _image_flowables(path_value: str, alt: str, base_dir: Path, styles) -> list:
    path = _resolve_image_path(path_value, base_dir)
    if not path or not path.exists():
        return [Paragraph(f"Image: {_inline(path_value)}", styles["Caption"])]

    max_width = 6.8 * inch
    max_height = 3.8 * inch
    try:
        image = Image(str(path))
        ratio = min(max_width / image.imageWidth, max_height / image.imageHeight, 1)
        image.drawWidth = image.imageWidth * ratio
        image.drawHeight = image.imageHeight * ratio
        image.hAlign = "CENTER"
    except Exception:
        return [Paragraph(f"Image could not be rendered: {_inline(path_value)}", styles["Caption"])]

    flowables = [image]
    if alt:
        flowables.append(Paragraph(_inline(alt), styles["Caption"]))
    flowables.append(Spacer(1, 0.12 * inch))
    return flowables


def _resolve_image_path(path_value: str, base_dir: Path) -> Path | None:
    cleaned = path_value.strip().strip("<>")
    if cleaned.startswith(("http://", "https://")):
        return None
    path = Path(cleaned)
    if path.is_absolute():
        return path
    return base_dir / path


def _inline(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = LINK_RE.sub(lambda m: _link(m.group("label"), m.group("url")), escaped)
    return escaped


def _link(label: str, url: str) -> str:
    label = html.escape(label)
    url = html.escape(url, quote=True)
    return f'<a href="{url}"><font color="#1f5f99">{label}</font></a>'


def _styles():
    sample = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "ReportTitle",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#17324d"),
            spaceAfter=10,
        ),
        "Heading2": ParagraphStyle(
            "ReportHeading2",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1f4e67"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "Heading3": ParagraphStyle(
            "ReportHeading3",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=colors.HexColor("#30363d"),
            spaceBefore=7,
            spaceAfter=4,
        ),
        "Body": ParagraphStyle(
            "ReportBody",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#222222"),
        ),
        "Bullet": ParagraphStyle(
            "ReportBullet",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.5,
            leftIndent=12,
            firstLineIndent=-8,
        ),
        "Caption": ParagraphStyle(
            "ReportCaption",
            parent=sample["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#666666"),
        ),
        "TableCell": ParagraphStyle(
            "ReportTableCell",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#222222"),
        ),
    }


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#777777"))
    canvas.drawRightString(A4[0] - 0.65 * inch, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()
