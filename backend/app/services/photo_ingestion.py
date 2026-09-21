import os
import io
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Union

from PIL import Image, ImageDraw, ImageFont

ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

PHOTO_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def sanitize_filename(filename: str) -> str:
    """Safely extracts base filename and strips directory traversal patterns."""
    if not filename:
        raise ValueError("Filename cannot be empty.")
    # Extract filename strictly without path components
    safe_name = Path(filename).name
    # Strip any remaining backslash or slash characters
    safe_name = safe_name.replace("/", "").replace("\\", "").strip()
    if not safe_name or safe_name in (".", ".."):
        raise ValueError(f"Invalid filename '{filename}'.")
    return safe_name


def validate_photo_extension(filename: str) -> str:
    """Validates that file extension is a supported photo format."""
    safe_name = sanitize_filename(filename)
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError(
            f"Disallowed photo format '{ext}'. Allowed extensions: {sorted(ALLOWED_PHOTO_EXTENSIONS)}"
        )
    return ext


def extract_image_dimensions(file_input: Union[Path, str, bytes]) -> tuple[Optional[int], Optional[int]]:
    """
    Extracts image width and height using local Pillow without keeping unneeded bitmaps in memory.
    """
    try:
        if isinstance(file_input, (bytes, bytearray)):
            with Image.open(io.BytesIO(file_input)) as img:
                return img.size[0], img.size[1]
        else:
            with Image.open(file_input) as img:
                return img.size[0], img.size[1]
    except Exception:
        return None, None


def get_photo_evidence_id(filename: str) -> str:
    """Generates a deterministic evidence identifier from filename."""
    stem = Path(filename).stem.upper().replace(" ", "-").replace("_", "-")
    # Add a short deterministic hash suffix for uniqueness
    short_hash = hashlib.md5(filename.encode("utf-8")).hexdigest()[:6].upper()
    return f"EVD-{stem}-{short_hash}"


def save_sidecar_metadata(storage_dir: Path, filename: str, metadata: Dict[str, Any]) -> Path:
    """Saves optional evidence metadata to a local sidecar JSON file."""
    meta_path = storage_dir / f"{filename}.meta.json"
    clean_meta = {
        "evidence_id": metadata.get("evidence_id"),
        "capture_date": metadata.get("capture_date"),
        "project_name": metadata.get("project_name"),
        "site_location": metadata.get("site_location"),
        "work_location": metadata.get("work_location"),
        "discipline": metadata.get("discipline"),
        "activity_id": metadata.get("activity_id"),
        "description": metadata.get("description"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(clean_meta, f, indent=2)
    return meta_path


def load_sidecar_metadata(storage_dir: Path, filename: str) -> Dict[str, Any]:
    """Loads optional sidecar metadata JSON if present."""
    meta_path = storage_dir / f"{filename}.meta.json"
    if meta_path.exists() and meta_path.is_file():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def parse_photo_metadata(
    file_path: Union[Path, str],
    optional_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Parses photo file on disk and returns structured execution evidence metadata.
    Does NOT infer activity, progress, or delay from image pixels.
    All inference is strictly disabled.
    """
    p = Path(file_path).resolve()
    if not p.exists() or not p.is_file():
        raise FileNotFoundError(f"Photo file '{p.name}' not found.")

    stat = p.stat()
    if stat.st_size == 0:
        raise ValueError(f"Photo file '{p.name}' is empty (0 bytes).")

    ext = validate_photo_extension(p.name)
    mime_type = PHOTO_MIME_TYPES.get(ext, "application/octet-stream")
    width, height = extract_image_dimensions(p)

    # Load optional sidecar metadata if present
    sidecar = load_sidecar_metadata(p.parent, p.name)
    if optional_fields:
        sidecar.update({k: v for k, v in optional_fields.items() if v is not None})

    created_iso = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
    evidence_id = sidecar.get("evidence_id") or get_photo_evidence_id(p.name)

    return {
        "evidence_id": evidence_id,
        "filename": p.name,
        "file_type": ext.lstrip("."),
        "mime_type": mime_type,
        "size_bytes": stat.st_size,
        "size_kb": round(stat.st_size / 1024, 2),
        "width": width,
        "height": height,
        "created_at": created_iso,
        "source_type": "PHOTO",
        "evidence_type": "EXECUTION_EVIDENCE",
        "capture_date": sidecar.get("capture_date"),
        "start_date": sidecar.get("capture_date"),
        "end_date": sidecar.get("capture_date"),
        "project_name": sidecar.get("project_name"),
        "site_location": sidecar.get("site_location"),
        "work_location": sidecar.get("work_location"),
        "location": sidecar.get("work_location") or sidecar.get("site_location"),
        "discipline": sidecar.get("discipline"),
        "activity_id": sidecar.get("activity_id"),
        "activity_name": sidecar.get("activity_name") or sidecar.get("description"),
        "description": sidecar.get("description"),
        "status": "Evidence Recorded",
        "in_memory_only": True,
        "database_modified": False,
        "baseline_schedule_modified": False,
    }


def parse_photo_bytes(
    file_bytes: bytes,
    filename: str,
    optional_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Parses in-memory photo bytes and returns structured execution evidence metadata.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise ValueError("Photo upload is empty (0 bytes).")

    safe_name = sanitize_filename(filename)
    ext = validate_photo_extension(safe_name)
    mime_type = PHOTO_MIME_TYPES.get(ext, "application/octet-stream")
    width, height = extract_image_dimensions(file_bytes)

    opt = optional_fields or {}
    evidence_id = opt.get("evidence_id") or get_photo_evidence_id(safe_name)
    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "evidence_id": evidence_id,
        "filename": safe_name,
        "file_type": ext.lstrip("."),
        "mime_type": mime_type,
        "size_bytes": len(file_bytes),
        "size_kb": round(len(file_bytes) / 1024, 2),
        "width": width,
        "height": height,
        "created_at": now_iso,
        "source_type": "PHOTO",
        "evidence_type": "EXECUTION_EVIDENCE",
        "capture_date": opt.get("capture_date"),
        "project_name": opt.get("project_name"),
        "site_location": opt.get("site_location"),
        "work_location": opt.get("work_location"),
        "discipline": opt.get("discipline"),
        "activity_id": opt.get("activity_id"),
        "description": opt.get("description"),
        "in_memory_only": True,
        "database_modified": False,
        "baseline_schedule_modified": False,
    }


def list_photos_in_storage(storage_dir: Path) -> List[Dict[str, Any]]:
    """
    Scans storage directory and returns list of all photo evidence files with metadata.
    """
    storage_path = Path(storage_dir).resolve()
    photos = []
    if storage_path.exists():
        for f in sorted(storage_path.iterdir()):
            if f.is_file() and f.suffix.lower() in ALLOWED_PHOTO_EXTENSIONS:
                try:
                    meta = parse_photo_metadata(f)
                    photos.append(meta)
                except Exception:
                    continue
    return photos


def generate_sample_photo_evidence(target_path: Union[Path, str]) -> Path:
    """
    Generates a clean, synthetic, copyright-free infrastructure site progress test photo.
    Represents execution evidence for subgrade excavation / foundation area.
    Never uses external web resources or copyrighted photos.
    """
    p = Path(target_path).resolve()
    p.parent.mkdir(parents=True, exist_ok=True)

    width, height = 800, 600
    img = Image.new("RGB", (width, height), color=(235, 238, 242))
    draw = ImageDraw.Draw(img)

    # Draw simulated site ground / terrain background
    draw.rectangle([(0, 220), (800, 600)], fill=(212, 197, 169))

    # Draw simulated foundation excavation trench
    draw.rectangle([(80, 280), (720, 520)], fill=(168, 149, 120), outline=(138, 120, 94), width=3)

    # Draw foundation grid lines (simulating subgrade compaction / rebar layout)
    for x in range(120, 700, 60):
        draw.line([(x, 300), (x, 500)], fill=(110, 95, 75), width=2)
    for y in range(320, 500, 40):
        draw.line([(100, y), (700, y)], fill=(110, 95, 75), width=2)

    # Draw inspection pegs / safety boundary markers
    for x_peg in (90, 240, 390, 540, 710):
        draw.rectangle([(x_peg - 5, 260), (x_peg + 5, 280)], fill=(234, 88, 12))
        draw.polygon([(x_peg, 250), (x_peg - 8, 262), (x_peg + 8, 262)], fill=(249, 115, 22))

    # Header banner
    draw.rectangle([(0, 0), (800, 60)], fill=(30, 41, 59))
    draw.text((24, 18), "INFRASYNC AI — EXECUTION EVIDENCE CAPTURE", fill=(255, 255, 255))
    draw.text((620, 20), "FEATURE A: EVIDENCE", fill=(148, 163, 184))

    # Info card overlay (top right)
    draw.rectangle([(460, 80), (770, 220)], fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    draw.text((475, 95), "EVIDENCE RECORD: EVD-SAMPLE-01", fill=(15, 23, 42))
    draw.text((475, 120), "Site Location: Sector 4 Substructure", fill=(71, 85, 105))
    draw.text((475, 140), "Work Package: Main Substructure", fill=(71, 85, 105))
    draw.text((475, 160), "Discipline: Civil Engineering", fill=(71, 85, 105))
    draw.text((475, 180), "Capture Date: 2025-01-15", fill=(71, 85, 105))

    # Bottom notice stamp
    draw.rectangle([(80, 545), (720, 580)], fill=(241, 245, 249), outline=(148, 163, 184), width=1)
    draw.text((110, 555), "TEST EVIDENCE ASSET ONLY — NO AUTOMATIC PROGRESS / ACTIVITY INFERRED", fill=(71, 85, 105))

    img.save(p, format="JPEG", quality=90)

    # Save matching sidecar metadata
    sidecar_meta = {
        "evidence_id": "EVD-SAMPLE-CIV-01",
        "capture_date": "2025-01-15",
        "project_name": "Hydrocarbon Refinery Expansion Phase 2",
        "site_location": "Sector 4 Pump Station",
        "work_location": "Grid B-4 Subgrade Excavation Area",
        "discipline": "Civil",
        "activity_id": "CIV-L6-01",
        "description": "Visual record of subgrade compaction and pit boundary markers prior to foundation rebar installation."
    }
    save_sidecar_metadata(p.parent, p.name, sidecar_meta)

    return p
