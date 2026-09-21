import os
import re
import zlib
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"}


def create_sample_project_document_pdf(target_path: Path) -> None:
    """
    Generates a realistic, deterministic infrastructure Project Document PDF.
    Represents a formal Construction Progress & Engineering Report containing
    project metadata, field notes, summary of works, and structured activity records.
    """
    target_path.parent.mkdir(parents=True, exist_ok=True)

    text_lines = [
        "CONSTRUCTION PROGRESS & ENGINEERING REPORT",
        "Document ID: DOC-2025-01-15-01",
        "Document Name: Construction Progress Report - Spread 4",
        "Document Type: Construction Progress Report",
        "Date: 2025-01-15",
        "Project: Cross-Country Pipeline Project - Package 1",
        "Site Location: Sector 4 Pump Station & Pipeline Spread",
        "Discipline: Civil / Piping Works",
        "Contractor: Infrasync Infrastructure EPC Ltd.",
        "Prepared By: Lead Planning Engineer & Resident Project Manager",
        "Summary: Comprehensive field progress assessment covering pump house earthworks, foundation reinforcement, and pipe spool prefabrication.",
        "Remarks: Civil subgrade compaction density tests passed in Section A-B. Spool welding visual inspection compliant with project specs.",
        "Issues: Minor traffic congestion on access road cleared. No environmental non-conformances identified.",
        "--- ACTIVITIES ---",
        "Activity ID: CIV-L6-01 | Activity: Subgrade excavation and compaction | Discipline: Civil | Planned: 5000 | Actual: 3500 | Unit: m3 | Status: In Progress | Work: Bulk excavation and layer compaction at station pad | Remarks: Compaction density verified",
        "Activity ID: CIV-L6-02 | Activity: Foundation rebar fixing and shuttering | Discipline: Civil | Planned: 1200 | Actual: 800 | Unit: t | Status: In Progress | Work: Pump house slab reinforcement installation | Remarks: Bar bending schedule verified",
        "Activity ID: PIP-L6-01 | Activity: Pipe spool fabrication and welding | Discipline: Piping | Planned: 600 | Actual: 600 | Unit: joints | Status: Completed | Work: Prefabrication of 24-inch carbon steel header spools | Remarks: Visual and NDT clearance complete"
    ]

    stream_content = "BT /F1 12 Tf 50 750 Td 14 TL\n"
    for line in text_lines:
        safe_line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_content += f"({safe_line}) ' \n"
    stream_content += "ET"

    stream_bytes = stream_content.encode("latin1")
    compressed = zlib.compress(stream_bytes)

    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >> endobj\n"
        b"4 0 obj << /Length " + str(len(compressed)).encode("latin1") + b" /Filter /FlateDecode >>\nstream\n"
        + compressed +
        b"\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000280 00000 n \ntrailer << /Size 5 /Root 1 0 R >>\nstartxref\n" + str(300 + len(compressed)).encode("latin1") + b"\n%%EOF\n"
    )

    with open(target_path, "wb") as f:
        f.write(pdf_content)


def extract_text_from_pdf_stream(pdf_bytes: bytes) -> str:
    """
    Robust, pure-Python text extraction from PDF streams.
    Handles uncompressed and zlib FlateDecode streams, Tj, TJ, and text operators.
    Only extracts from genuine PDF text objects (BT ... ET).
    Scanned image PDFs without font streams return empty string to trigger OCR.
    """
    extracted_lines = []

    # Search for stream ... endstream blocks
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL)
    for s in streams:
        decomp = s
        try:
            decomp = zlib.decompress(s)
        except Exception:
            pass

        # Text stream must contain BT and ET operators
        if b"BT" not in decomp or b"ET" not in decomp:
            continue

        bt_blocks = re.findall(rb"BT\s*(.*?)\s*ET", decomp, re.DOTALL)
        for block in bt_blocks:
            # Match single string operators: (text) Tj, (text) ', (text) "
            tj_matches = re.findall(rb"\((.*?)\)\s*[\'\"Tj]", block, re.DOTALL)
            for m in tj_matches:
                line = m.decode("latin1", errors="ignore").replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
                if line.strip():
                    extracted_lines.append(line.strip())

            # Match array operators: [(text) -10 (text)] TJ
            tj_arrays = re.findall(rb"\[(.*?)\]\s*TJ", block, re.DOTALL)
            for arr in tj_arrays:
                parts = re.findall(rb"\((.*?)\)", arr)
                if parts:
                    joined = "".join(p.decode("latin1", errors="ignore") for p in parts)
                    clean_joined = joined.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
                    if clean_joined.strip():
                        extracted_lines.append(clean_joined.strip())

    return "\n".join(extracted_lines)


def extract_text_from_docx(file_path: Path) -> str:
    """
    Extracts plain text from a .docx file using standard library zipfile and XML parser.
    Zero external pip dependencies.
    """
    try:
        with zipfile.ZipFile(file_path) as docx:
            xml_content = docx.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            # Namespace for WordprocessingML
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in tree.iterfind(".//w:p", ns):
                texts = [node.text for node in p.iterfind(".//w:t", ns) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)
    except Exception:
        return ""


def extract_text_from_txt(file_path: Path) -> str:
    """
    Reads plain text from a .txt document file.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


def parse_document_text(text: str, filename: str) -> Dict[str, Any]:
    """
    Deterministically parses extracted project document text into structured metadata and activity records.
    If no text is extractable (e.g. scanned image PDF without OCR), returns clean indication.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Check if text is completely unavailable
    if not lines:
        return {
            "filename": filename,
            "file_type": Path(filename).suffix.lower().lstrip("."),
            "document_metadata": {
                "document_id": f"DOC-{Path(filename).stem.upper()}",
                "document_name": filename,
                "document_type": "Project Document",
                "title": filename,
                "project_name": "Infrastructure Construction Project",
                "document_date": None,
                "site_location": "Main Site",
                "discipline": "General",
                "prepared_by": "Project Management Office",
                "contractor": "Lead Contractor",
                "summary": "Document text extraction unavailable.",
                "remarks": "No machine-readable text stream found in document.",
                "issues": "Document may be an image-only or scanned file. OCR is required (Feature 2.29).",
                "text_extracted": False,
                "extraction_status": "TEXT_UNAVAILABLE"
            },
            "report_metadata": {},
            "total_activities": 0,
            "activities": [],
            "sheet_count": 0,
            "sheets": [],
            "text_extracted": False,
            "extraction_status": "TEXT_UNAVAILABLE",
            "text_preview": "",
            "notice": "No machine-readable text found in document. Scanned documents require OCR (Feature 2.29)."
        }

    # Infer Document Title from top line if present
    title = lines[0] if lines else "Project Document"
    if any(k in title.lower() for k in ["id:", "date:", "project:"]):
        title = "Construction Progress & Engineering Report"

    metadata = {
        "document_id": f"DOC-{Path(filename).stem.upper()}",
        "document_name": filename,
        "document_type": "Progress Report",
        "title": title,
        "project_name": "Infrastructure Construction Project",
        "document_date": None,
        "site_location": "Main Site",
        "discipline": "General Infrastructure",
        "contractor": "Lead EPC Contractor",
        "prepared_by": "Project Management Team",
        "summary": "",
        "remarks": "",
        "issues": "",
        "text_extracted": True,
        "extraction_status": "SUCCESS"
    }

    activities: List[Dict[str, Any]] = []

    for line in lines:
        # Document ID
        m_id = re.search(r"(?:Document\s*(?:ID|No|Number|#)?|DOC\s*(?:No|#)?)\s*[:=-]\s*([A-Za-z0-9\-_/]+)", line, re.IGNORECASE)
        if m_id:
            metadata["document_id"] = m_id.group(1).strip()

        # Document Name
        m_dname = re.search(r"Document\s*Name\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_dname:
            metadata["document_name"] = m_dname.group(1).strip()

        # Document Type
        m_dtype = re.search(r"Document\s*Type\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_dtype:
            metadata["document_type"] = m_dtype.group(1).strip()

        # Date
        m_date = re.search(r"(?:Document\s*)?Date\s*[:=-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4})", line, re.IGNORECASE)
        if m_date:
            metadata["document_date"] = m_date.group(1).strip()

        # Project Name
        m_proj = re.search(r"Project(?:\s*Name)?\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_proj and not any(k in line.lower() for k in ["description", "activity", "date", "location"]):
            metadata["project_name"] = m_proj.group(1).strip()

        # Site Location
        m_site = re.search(r"(?:Site\s*Location|Location)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_site and "clear" not in m_site.group(1).lower():
            metadata["site_location"] = m_site.group(1).strip()

        # Discipline
        m_disc = re.search(r"Discipline\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_disc and "activity" not in line.lower():
            metadata["discipline"] = m_disc.group(1).strip()

        # Contractor
        m_cont = re.search(r"(?:Contractor|Company)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_cont:
            metadata["contractor"] = m_cont.group(1).strip()

        # Prepared By
        m_prep = re.search(r"(?:Prepared\s*By|Author|Engineer|Manager)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_prep:
            metadata["prepared_by"] = m_prep.group(1).strip()

        # Summary
        m_sum = re.search(r"(?:Summary|Executive\s*Summary|Overview)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_sum and "activity" not in line.lower():
            metadata["summary"] = m_sum.group(1).strip()

        # Remarks
        m_rem = re.search(r"Remarks\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_rem and "activity" not in line.lower():
            metadata["remarks"] = m_rem.group(1).strip()

        # Issues
        m_iss = re.search(r"Issues(?:\s*Log)?\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_iss and "activity" not in line.lower():
            metadata["issues"] = m_iss.group(1).strip()

        # Activity Line parsing: e.g.
        # "Activity ID: CIV-L6-01 | Activity: Subgrade excavation | Discipline: Civil | Planned: 5000 | Actual: 3500 | Unit: m3 | Status: In Progress | Work: ... | Remarks: ..."
        if ("activity id:" in line.lower() or "activity:" in line.lower()) and "|" in line:
            parts = [p.strip() for p in line.split("|")]
            act_dict: Dict[str, Any] = {
                "activity_id": None,
                "activity_name": None,
                "discipline": metadata["discipline"],
                "planned_quantity": None,
                "actual_quantity": None,
                "unit": None,
                "status": "In Progress",
                "work_description": "",
                "remarks": None,
                "issues": None,
                "start_date": metadata["document_date"],
                "end_date": metadata["document_date"],
                "location": metadata.get("site_location"),
                "source_row_index": len(activities) + 1,
                "original_record": {}
            }

            raw_kv = {}
            for part in parts:
                if ":" in part:
                    k, v = part.split(":", 1)
                    k_clean = k.strip().lower().replace(" ", "_")
                    v_clean = v.strip()
                    raw_kv[k_clean] = v_clean

                    if k_clean in ("activity_id", "id", "wbs_code", "wbs"):
                        act_dict["activity_id"] = v_clean
                    elif k_clean in ("activity", "activity_name", "task", "name"):
                        act_dict["activity_name"] = v_clean
                    elif k_clean in ("discipline", "disc", "trade"):
                        act_dict["discipline"] = v_clean
                    elif k_clean in ("planned", "planned_quantity", "planned_qty", "plan"):
                        try:
                            act_dict["planned_quantity"] = float(v_clean)
                        except ValueError:
                            pass
                    elif k_clean in ("actual", "actual_quantity", "actual_qty", "progress"):
                        try:
                            act_dict["actual_quantity"] = float(v_clean)
                        except ValueError:
                            pass
                    elif k_clean in ("unit", "uom"):
                        act_dict["unit"] = v_clean
                    elif k_clean in ("status", "state"):
                        act_dict["status"] = v_clean
                    elif k_clean in ("work", "work_description", "scope", "work_summary"):
                        act_dict["work_description"] = v_clean
                    elif k_clean in ("remarks", "remark", "note", "notes"):
                        act_dict["remarks"] = v_clean
                    elif k_clean in ("issues", "issue", "blocker"):
                        act_dict["issues"] = v_clean

            act_dict["original_record"] = raw_kv

            if not act_dict["activity_name"] and act_dict["activity_id"]:
                act_dict["activity_name"] = act_dict["activity_id"]
            if not act_dict["work_description"] and act_dict["activity_name"]:
                act_dict["work_description"] = act_dict["activity_name"]

            if act_dict["planned_quantity"] is not None and act_dict["actual_quantity"] is not None:
                if act_dict["planned_quantity"] > 0:
                    pct = round((act_dict["actual_quantity"] / act_dict["planned_quantity"]) * 100, 2)
                    act_dict["progress_percentage"] = pct
                    act_dict["progress_percent"] = pct
                else:
                    act_dict["progress_percentage"] = 0.0
                    act_dict["progress_percent"] = 0.0

            if act_dict["activity_id"]:
                activities.append(act_dict)

    # Standardized Activity Intelligence format
    return {
        "filename": filename,
        "file_type": Path(filename).suffix.lower().lstrip("."),
        "document_metadata": metadata,
        "report_metadata": metadata,  # Cross-compatibility alias
        "total_activities": len(activities),
        "activities": activities,
        "sheet_count": 1 if activities else 0,
        "sheets": [
            {
                "sheet_name": "Document Progress",
                "total_extracted": len(activities),
                "engine": "document_parser",
                "activities": activities
            }
        ] if activities else [],
        "text_extracted": True,
        "extraction_status": "SUCCESS",
        "text_preview": "\n".join(lines[:15]),
        "notice": "Document parsed successfully into standardized Activity Intelligence format."
    }


def parse_document(file_path: Path) -> Dict[str, Any]:
    """
    Main entrypoint to read and parse any stored Project Document file (.pdf, .docx, .txt, .png, .jpg, .jpeg).
    If a PDF has no machine-readable text stream (scanned PDF) or an image is passed,
    it automatically routes through local OCR (Feature 2.29).
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Project document file not found at '{file_path}'.")

    ext = file_path.suffix.lower()
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValueError(f"Unsupported document file type '{ext}'. Allowed: {sorted(ALLOWED_DOCUMENT_EXTENSIONS)}")

    ocr_applied = False
    ocr_info = None

    if ext == ".pdf":
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        text = extract_text_from_pdf_stream(pdf_bytes)
        # If no stream text found (scanned PDF), invoke OCR (Feature 2.29)
        if not text or not text.strip():
            try:
                from app.services.ocr import run_ocr, is_ocr_available
                if is_ocr_available():
                    ocr_res = run_ocr(file_path)
                    if ocr_res.get("text_extracted") and ocr_res.get("text"):
                        text = ocr_res["text"]
                        ocr_applied = True
                        ocr_info = ocr_res
            except Exception:
                pass
    elif ext in (".png", ".jpg", ".jpeg"):
        try:
            from app.services.ocr import run_ocr, is_ocr_available
            if is_ocr_available():
                ocr_res = run_ocr(file_path)
                if ocr_res.get("text_extracted") and ocr_res.get("text"):
                    text = ocr_res["text"]
                    ocr_applied = True
                    ocr_info = ocr_res
        except Exception:
            pass
    elif ext == ".docx":
        text = extract_text_from_docx(file_path)
    else:  # .txt
        text = extract_text_from_txt(file_path)

    result = parse_document_text(text, file_path.name)
    result["in_memory_only"] = True
    result["database_modified"] = False
    result["baseline_schedule_modified"] = False
    result["ocr_applied"] = ocr_applied
    if ocr_applied and ocr_info:
        result["ocr_engine"] = ocr_info.get("engine")
        result["ocr_page_count"] = ocr_info.get("page_count")
        result["notice"] = f"Scanned document text successfully extracted via OCR (Feature 2.29) using {ocr_info.get('engine')}."

    return result
