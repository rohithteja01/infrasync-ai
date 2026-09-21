import os
import re
import zlib
from pathlib import Path
from typing import Dict, Any, List, Optional
import openpyxl

ALLOWED_SITE_DIARY_EXTENSIONS = {".pdf", ".xlsx", ".xls"}


def create_sample_site_diary_pdf(target_path: Path) -> None:
    """
    Generates a realistic, deterministic infrastructure Site Diary & Inspection Log PDF.
    Contains diary metadata, site & work locations, weather/shift conditions, field remarks,
    issues log, and structured activity records.
    """
    target_path.parent.mkdir(parents=True, exist_ok=True)

    text_lines = [
        "SITE DIARY & CLERK OF WORKS INSPECTION LOG",
        "Diary ID: SD-2025-01-15-01",
        "Date: 2025-01-15",
        "Project: Cross-Country Pipeline Project - Package 1",
        "Site Location: Sector 4 Pump Station & Pipeline Spread",
        "Work Location: Station Pad Earthworks & Spool Yard",
        "Contractor: Infrasync Infrastructure EPC Ltd.",
        "Prepared By: Resident Engineer & Site Inspector",
        "Discipline: Civil & Piping Works",
        "Weather: Clear / Sunny (30C)",
        "Shift: Day Shift (07:00 - 18:00)",
        "Remarks: Compaction density test passed at Section A-B. Welding visual inspection 100% compliant.",
        "Issues: Minor traffic congestion on access road cleared by 08:30. No safety incidents.",
        "Work Summary: Routine daily site supervision of bulk excavation, foundation reinforcement, and pipe spool welding.",
        "--- ACTIVITIES ---",
        "Activity ID: CIV-L6-01 | Activity: Subgrade excavation and compaction | Discipline: Civil | Planned: 5000 | Actual: 3500 | Unit: m3 | Status: In Progress | Work: Bulk excavation and layer compaction at station pad | Remarks: Compaction test passed | Issues: None",
        "Activity ID: CIV-L6-02 | Activity: Foundation rebar fixing and shuttering | Discipline: Civil | Planned: 1200 | Actual: 800 | Unit: t | Status: In Progress | Work: Pump house slab rebar installation | Remarks: Reinforcement checked against drawings | Issues: None",
        "Activity ID: PIP-L6-01 | Activity: Pipe spool fabrication and welding | Discipline: Piping | Planned: 600 | Actual: 600 | Unit: joints | Status: Completed | Work: Prefabrication of 24-inch header spools | Remarks: Visual inspection passed | Issues: None"
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
    Zero external pip dependencies.
    """
    extracted_lines = []

    # 1. Search for stream ... endstream blocks
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL)
    for s in streams:
        decomp = s
        try:
            decomp = zlib.decompress(s)
        except Exception:
            pass

        # Match single string operators: (text) Tj, (text) ', (text) "
        tj_matches = re.findall(rb"\((.*?)\)\s*[\'\"Tj]", decomp, re.DOTALL)
        for m in tj_matches:
            line = m.decode("latin1", errors="ignore").replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
            if line.strip():
                extracted_lines.append(line.strip())

        # Match array operators: [(text) -10 (text)] TJ
        tj_arrays = re.findall(rb"\[(.*?)\]\s*TJ", decomp, re.DOTALL)
        for arr in tj_arrays:
            parts = re.findall(rb"\((.*?)\)", arr)
            if parts:
                joined = "".join(p.decode("latin1", errors="ignore") for p in parts)
                clean_joined = joined.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
                if clean_joined.strip():
                    extracted_lines.append(clean_joined.strip())

    # Fallback: if no stream text found, scan for literal strings in the raw file
    if not extracted_lines:
        raw_matches = re.findall(rb"\(([A-Za-z0-9\s\-_:.,/()|&+=]{4,})\)", pdf_bytes)
        for rm in raw_matches:
            decoded = rm.decode("latin1", errors="ignore").strip()
            if decoded and not decoded.startswith("/"):
                extracted_lines.append(decoded)

    return "\n".join(extracted_lines)


def parse_site_diary_text(text: str, filename: str) -> Dict[str, Any]:
    """
    Deterministically parses extracted Site Diary text into structured metadata and activity records.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    metadata = {
        "diary_id": "SD-UNKNOWN",
        "diary_date": None,
        "project_name": "Infrastructure Construction Project",
        "site_location": "Main Site",
        "work_location": "Field Work Zone",
        "discipline": "General",
        "contractor": "Lead Contractor",
        "prepared_by": "Site Engineer / Inspector",
        "weather": "Normal",
        "shift": "Day Shift",
        "remarks": "",
        "issues": "",
        "work_summary": ""
    }

    activities: List[Dict[str, Any]] = []

    for line in lines:
        # Diary ID / Report ID
        m_id = re.search(r"(?:Diary\s*(?:ID|No|Number|#)?|Site\s*Diary\s*(?:ID|No|#)?|SD\s*(?:No|#)?)\s*[:=-]\s*([A-Za-z0-9\-_/]+)", line, re.IGNORECASE)
        if m_id:
            metadata["diary_id"] = m_id.group(1).strip()

        # Date
        m_date = re.search(r"(?:Diary\s*)?Date\s*[:=-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4})", line, re.IGNORECASE)
        if m_date:
            metadata["diary_date"] = m_date.group(1).strip()

        # Project Name
        m_proj = re.search(r"Project(?:\s*Name)?\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_proj and not any(k in line.lower() for k in ["description", "activity", "date", "location"]):
            metadata["project_name"] = m_proj.group(1).strip()

        # Site Location
        m_site = re.search(r"(?:Site\s*Location)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_site and "clear" not in m_site.group(1).lower():
            metadata["site_location"] = m_site.group(1).strip()

        # Work Location
        m_wloc = re.search(r"(?:Work\s*Location)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_wloc:
            metadata["work_location"] = m_wloc.group(1).strip()

        # Generic Location fallback if neither set
        if metadata["site_location"] == "Main Site":
            m_gen_loc = re.search(r"Location\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
            if m_gen_loc and "clear" not in m_gen_loc.group(1).lower():
                metadata["site_location"] = m_gen_loc.group(1).strip()

        # Contractor
        m_cont = re.search(r"(?:Contractor|Company)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_cont:
            metadata["contractor"] = m_cont.group(1).strip()

        # Prepared By
        m_prep = re.search(r"(?:Prepared\s*By|Inspector|Engineer)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_prep:
            metadata["prepared_by"] = m_prep.group(1).strip()

        # Discipline
        m_disc = re.search(r"Discipline\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_disc and "activity" not in line.lower():
            metadata["discipline"] = m_disc.group(1).strip()

        # Weather
        m_weath = re.search(r"Weather\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_weath:
            metadata["weather"] = m_weath.group(1).strip()

        # Shift
        m_shift = re.search(r"Shift\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_shift:
            metadata["shift"] = m_shift.group(1).strip()

        # Remarks
        m_rem = re.search(r"Remarks\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_rem and "activity" not in line.lower():
            metadata["remarks"] = m_rem.group(1).strip()

        # Issues
        m_iss = re.search(r"Issues(?:\s*Log)?\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_iss and "activity" not in line.lower():
            metadata["issues"] = m_iss.group(1).strip()

        # Work Summary
        m_desc = re.search(r"(?:Work\s*(?:Description|Summary)|Summary)\s*[:=-]\s*([^|;\n\r]+)", line, re.IGNORECASE)
        if m_desc and "activity" not in line.lower():
            metadata["work_summary"] = m_desc.group(1).strip()

        # Activity Line parsing: e.g.
        # "Activity ID: CIV-L6-01 | Activity: Subgrade excavation | Discipline: Civil | Planned: 5000 | Actual: 3500 | Unit: m3 | Status: In Progress | Work: ... | Remarks: ... | Issues: ..."
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
                "start_date": metadata["diary_date"],
                "end_date": metadata["diary_date"],
                "location": metadata.get("work_location") or metadata.get("site_location"),
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
        "file_type": "pdf",
        "diary_metadata": metadata,
        "report_metadata": metadata,  # Alias for cross-compatibility
        "total_activities": len(activities),
        "activities": activities,
        "sheet_count": 1,
        "sheets": [
            {
                "sheet_name": "Site Diary Progress",
                "total_extracted": len(activities),
                "engine": "site_diary_pdf_parser",
                "activities": activities
            }
        ]
    }


def parse_site_diary_excel(file_path: Path) -> Dict[str, Any]:
    """
    Parses an Excel-based Site Diary (.xlsx, .xls) workbook.
    """
    filename = file_path.name
    wb = openpyxl.load_workbook(file_path, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    metadata = {
        "diary_id": f"SD-{file_path.stem.upper()}",
        "diary_date": None,
        "project_name": "Infrastructure Construction Project",
        "site_location": "Main Site",
        "work_location": "Field Work Zone",
        "discipline": "Civil & Piping Works",
        "contractor": "Lead EPC Contractor",
        "prepared_by": "Site Engineer / Inspector",
        "weather": "Normal",
        "shift": "Day Shift",
        "remarks": "",
        "issues": "",
        "work_summary": ""
    }

    if not rows:
        return {
            "filename": filename,
            "file_type": "excel",
            "diary_metadata": metadata,
            "report_metadata": metadata,
            "total_activities": 0,
            "activities": [],
            "sheet_count": 1,
            "sheets": [{"sheet_name": ws.title or "Site Diary", "total_extracted": 0, "activities": []}]
        }

    # Match header row
    header = [str(cell).strip().lower() if cell is not None else "" for cell in rows[0]]
    col_map = {}
    for idx, h in enumerate(header):
        if any(k in h for k in ["activity_id", "wbs", "code", "task_id"]) and "activity_id" not in col_map:
            col_map["activity_id"] = idx
        elif any(k in h for k in ["activity_name", "activity", "name", "description", "task"]) and "activity_name" not in col_map:
            col_map["activity_name"] = idx
        elif any(k in h for k in ["planned", "plan_qty"]) and "planned_quantity" not in col_map:
            col_map["planned_quantity"] = idx
        elif any(k in h for k in ["actual", "act_qty", "progress"]) and "actual_quantity" not in col_map:
            col_map["actual_quantity"] = idx
        elif any(k in h for k in ["unit", "uom"]) and "unit" not in col_map:
            col_map["unit"] = idx
        elif any(k in h for k in ["status", "state"]) and "status" not in col_map:
            col_map["status"] = idx
        elif any(k in h for k in ["discipline", "disc", "trade"]) and "discipline" not in col_map:
            col_map["discipline"] = idx
        elif any(k in h for k in ["remarks", "remark", "notes"]) and "remarks" not in col_map:
            col_map["remarks"] = idx
        elif any(k in h for k in ["issues", "issue", "blocker"]) and "issues" not in col_map:
            col_map["issues"] = idx

    activities: List[Dict[str, Any]] = []
    for r_idx, row in enumerate(rows[1:], 1):
        if not any(row):
            continue

        aid = str(row[col_map["activity_id"]]).strip() if "activity_id" in col_map and row[col_map["activity_id"]] is not None else f"ACT-{r_idx:02d}"
        aname = str(row[col_map["activity_name"]]).strip() if "activity_name" in col_map and row[col_map["activity_name"]] is not None else aid
        p_qty = None
        if "planned_quantity" in col_map and row[col_map["planned_quantity"]] is not None:
            try:
                p_qty = float(row[col_map["planned_quantity"]])
            except ValueError:
                pass

        a_qty = None
        if "actual_quantity" in col_map and row[col_map["actual_quantity"]] is not None:
            try:
                a_qty = float(row[col_map["actual_quantity"]])
            except ValueError:
                pass

        unit = str(row[col_map["unit"]]).strip() if "unit" in col_map and row[col_map["unit"]] is not None else "units"
        status = str(row[col_map["status"]]).strip() if "status" in col_map and row[col_map["status"]] is not None else "In Progress"
        disc = str(row[col_map["discipline"]]).strip() if "discipline" in col_map and row[col_map["discipline"]] is not None else metadata["discipline"]
        remarks = str(row[col_map["remarks"]]).strip() if "remarks" in col_map and row[col_map["remarks"]] is not None else None
        issues = str(row[col_map["issues"]]).strip() if "issues" in col_map and row[col_map["issues"]] is not None else None

        activities.append({
            "activity_id": aid,
            "activity_name": aname,
            "discipline": disc,
            "planned_quantity": p_qty,
            "actual_quantity": a_qty,
            "unit": unit,
            "status": status,
            "work_description": aname,
            "remarks": remarks,
            "issues": issues,
            "start_date": metadata["diary_date"],
            "end_date": None,
            "source_row_index": r_idx,
            "original_record": {h: row[i] for i, h in enumerate(header) if i < len(row)}
        })

    return {
        "filename": filename,
        "file_type": "excel",
        "diary_metadata": metadata,
        "report_metadata": metadata,
        "total_activities": len(activities),
        "activities": activities,
        "sheet_count": 1,
        "sheets": [
            {
                "sheet_name": ws.title or "Site Diary Progress",
                "total_extracted": len(activities),
                "engine": "site_diary_excel_parser",
                "activities": activities
            }
        ]
    }


def parse_site_diary(file_path: Path) -> Dict[str, Any]:
    """
    Main entrypoint to read and parse any stored Site Diary file (.pdf, .xlsx, .xls).
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Site diary file not found at '{file_path}'.")

    ext = file_path.suffix.lower()
    if ext not in ALLOWED_SITE_DIARY_EXTENSIONS:
        raise ValueError(f"Unsupported site diary file type '{ext}'. Allowed: {sorted(ALLOWED_SITE_DIARY_EXTENSIONS)}")

    if ext == ".pdf":
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        text = extract_text_from_pdf_stream(pdf_bytes)
        result = parse_site_diary_text(text, file_path.name)
    else:
        result = parse_site_diary_excel(file_path)

    result["in_memory_only"] = True
    result["database_modified"] = False
    result["baseline_schedule_modified"] = False

    return result
