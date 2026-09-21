import os
import io
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

ALLOWED_OCR_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

# Known candidate paths for Tesseract OCR on Windows
KNOWN_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
    os.path.expandvars(r"%PROGRAMFILES%\Tesseract-OCR\tesseract.exe"),
]


def get_tesseract_path() -> Optional[str]:
    """
    Finds and returns the absolute path to the local Tesseract OCR executable.
    Checks explicit verified locations first, then PATH.
    """
    for candidate in KNOWN_TESSERACT_PATHS:
        if candidate and os.path.isfile(candidate):
            return candidate

    which_tess = shutil.which("tesseract")
    if which_tess and os.path.isfile(which_tess):
        return which_tess

    return None


def get_ocr_engine_info() -> Tuple[bool, str, Optional[str]]:
    """
    Returns (is_available, engine_version_string, executable_path).
    """
    tess_path = get_tesseract_path()
    if not tess_path:
        return False, "Tesseract OCR executable not found on local system", None

    try:
        res = subprocess.run([tess_path, "--version"], capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            first_line = res.stdout.splitlines()[0] if res.stdout else "Tesseract OCR"
            return True, first_line.strip(), tess_path
        else:
            return False, f"Tesseract error: {res.stderr.strip()}", tess_path
    except Exception as exc:
        return False, f"Tesseract execution error: {str(exc)}", tess_path


def is_ocr_available() -> bool:
    """
    Boolean check whether local OCR engine is installed and operational.
    """
    available, _, _ = get_ocr_engine_info()
    return available


def convert_pdf_to_images(pdf_path: Path) -> List[Image.Image]:
    """
    Converts each page of a PDF into a high-resolution PIL Image.
    Uses PyMuPDF (fitz) for pure-local, high-fidelity raster rendering.
    Falls back to pypdf image extraction if needed.
    """
    images: List[Image.Image] = []

    try:
        import pymupdf as fitz
        doc = fitz.open(str(pdf_path))
        for page in doc:
            # Render at 2x resolution (144 dpi) for optimal OCR accuracy
            matrix = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=matrix)
            img_data = pix.tobytes("png")
            images.append(Image.open(io.BytesIO(img_data)))
        doc.close()
        return images
    except ImportError:
        pass

    # Fallback using pypdf image stream extraction
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        for page in reader.pages:
            for image_file_object in page.images:
                pil_img = Image.open(io.BytesIO(image_file_object.data))
                images.append(pil_img)
    except Exception:
        pass

    return images


def run_ocr(file_path: Path) -> Dict[str, Any]:
    """
    Executes local Tesseract OCR on a scanned PDF or image file (.png, .jpg, .jpeg).
    Returns structured OCR result with text, page details, character counts, and status.
    Never hallucinates or fabricates text.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Source file not found at '{file_path}'.")

    ext = file_path.suffix.lower()
    if ext not in ALLOWED_OCR_EXTENSIONS:
        raise ValueError(f"Unsupported OCR file type '{ext}'. Allowed: {sorted(ALLOWED_OCR_EXTENSIONS)}")

    available, engine_info, tess_path = get_ocr_engine_info()
    if not available:
        return {
            "source_file": file_path.name,
            "ocr_status": "UNAVAILABLE",
            "text_extracted": False,
            "page_count": 0,
            "text": "",
            "pages": [],
            "text_length": 0,
            "engine": engine_info,
            "in_memory_only": True,
            "database_modified": False,
            "baseline_schedule_modified": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notice": f"Local OCR engine is unavailable. {engine_info}"
        }

    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = tess_path

    # Convert/Load pages into PIL Images
    pil_images: List[Image.Image] = []
    if ext == ".pdf":
        pil_images = convert_pdf_to_images(file_path)
    else:  # image file
        try:
            with Image.open(file_path) as img:
                pil_images = [img.convert("RGB")]
        except Exception as exc:
            return {
                "source_file": file_path.name,
                "ocr_status": "ERROR",
                "text_extracted": False,
                "page_count": 0,
                "text": "",
                "pages": [],
                "text_length": 0,
                "engine": engine_info,
                "in_memory_only": True,
                "database_modified": False,
                "baseline_schedule_modified": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notice": f"Failed to open image file: {str(exc)}"
            }

    if not pil_images:
        return {
            "source_file": file_path.name,
            "ocr_status": "NO_PAGES_FOUND",
            "text_extracted": False,
            "page_count": 0,
            "text": "",
            "pages": [],
            "text_length": 0,
            "engine": engine_info,
            "in_memory_only": True,
            "database_modified": False,
            "baseline_schedule_modified": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notice": "No raster pages or images could be extracted from source file for OCR."
        }

    # Perform OCR page by page
    page_records: List[Dict[str, Any]] = []
    combined_text_parts: List[str] = []

    for idx, page_img in enumerate(pil_images, start=1):
        try:
            page_text = pytesseract.image_to_string(page_img)
            clean_page_text = page_text.strip()
            page_records.append({
                "page_number": idx,
                "text": clean_page_text,
                "char_count": len(clean_page_text),
                "image_width": page_img.width,
                "image_height": page_img.height
            })
            if clean_page_text:
                combined_text_parts.append(clean_page_text)
        except Exception as exc:
            page_records.append({
                "page_number": idx,
                "text": "",
                "char_count": 0,
                "error": str(exc)
            })

    full_text = "\n\n".join(combined_text_parts).strip()
    has_text = len(full_text) > 0

    return {
        "source_file": file_path.name,
        "ocr_status": "SUCCESS" if has_text else "NO_TEXT_FOUND",
        "text_extracted": has_text,
        "page_count": len(pil_images),
        "text": full_text,
        "pages": page_records,
        "text_length": len(full_text),
        "engine": engine_info,
        "in_memory_only": True,
        "database_modified": False,
        "baseline_schedule_modified": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notice": f"OCR extraction completed with {len(full_text)} characters across {len(pil_images)} page(s)." if has_text else "OCR ran successfully but no recognizable text was detected in the raster content."
    }


def create_sample_scanned_documents(target_pdf_path: Path, target_png_path: Path) -> None:
    """
    Generates a deterministic sample scanned infrastructure report:
    1) Raster PNG image
    2) Image-only raster PDF (has no machine-readable font stream, pure scanned page)
    Both contain realistic infrastructure project progress data suitable for OCR recognition.
    """
    target_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    target_png_path.parent.mkdir(parents=True, exist_ok=True)

    # Use standard Windows Arial font for high-clarity OCR recognition
    try:
        title_font = ImageFont.truetype("arial.ttf", 28)
        header_font = ImageFont.truetype("arial.ttf", 20)
        body_font = ImageFont.truetype("arial.ttf", 18)
    except Exception:
        title_font = ImageFont.load_default()
        header_font = ImageFont.load_default()
        body_font = ImageFont.load_default()

    # Create 1600x1100 clean white page canvas
    img = Image.new("RGB", (1600, 1100), color="white")
    draw = ImageDraw.Draw(img)

    # Document Header
    draw.text((60, 45), "CONSTRUCTION PROGRESS & ENGINEERING REPORT", font=title_font, fill="black")
    draw.line([(60, 85), (1540, 85)], fill="#333333", width=2)

    # Metadata lines
    metadata_lines = [
        "Document ID: DOC-SCAN-2025-01",
        "Document Name: Sector 4 Field Inspection Progress Report",
        "Document Type: Scanned Engineering Report",
        "Date: 2025-01-15",
        "Project: Cross-Country Pipeline Project - Package 1",
        "Site Location: Sector 4 Pump Station & Pipeline Spread",
        "Discipline: Civil / Piping Works",
        "Contractor: Infrasync Infrastructure EPC Ltd.",
        "Prepared By: Resident Project Engineer",
        "Summary: Comprehensive field progress assessment covering pump house earthworks, foundation reinforcement, and pipe spool prefabrication.",
        "Remarks: Civil subgrade compaction density tests passed. Spool welding visual inspection compliant.",
        "Issues: Minor access road traffic cleared. No environmental non-conformances identified."
    ]

    y = 105
    for line in metadata_lines:
        draw.text((60, y), line, font=header_font, fill="black")
        y += 34

    # Activities Section
    y += 20
    draw.line([(60, y), (1540, y)], fill="#666666", width=1)
    y += 15
    draw.text((60, y), "FIELD WORK PROGRESS ACTIVITIES", font=title_font, fill="black")
    y += 45

    activity_lines = [
        "Activity ID: CIV-L6-01 | Activity: Subgrade excavation and compaction | Discipline: Civil | Planned: 5000 | Actual: 3500 | Unit: m3 | Status: In Progress | Remarks: Compaction density verified",
        "Activity ID: CIV-L6-02 | Activity: Foundation rebar fixing and shuttering | Discipline: Civil | Planned: 1200 | Actual: 800 | Unit: t | Status: In Progress | Remarks: Bar bending verified",
        "Activity ID: PIP-L6-01 | Activity: Pipe spool fabrication and welding | Discipline: Piping | Planned: 600 | Actual: 600 | Unit: joints | Status: Completed | Remarks: NDT clearance complete"
    ]

    for act_line in activity_lines:
        draw.text((60, y), act_line, font=body_font, fill="black")
        y += 40

    # Save as PNG
    img.save(target_png_path, "PNG")

    # Save as Image-Only PDF (zero text layer, pure raster)
    img.save(target_pdf_path, "PDF", resolution=150.0)
