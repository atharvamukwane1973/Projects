"""
modules/organizer.py — Core File Organisation Engine
======================================================
Scans a source directory and moves every file into a category subfolder
based on the extension map defined in config.py.

Public API
----------
    organize_directory(source_path, dry_run=False) -> OrganizeResult

OrganizeResult (dataclass)
--------------------------
    moved   : int   — files successfully relocated
    skipped : int   — files intentionally left alone (protected / already placed)
    errors  : int   — files that raised an exception during move

Architecture
------------
    main.py
        └── calls organize_directory()
                ├── reads  config.EXTENSION_MAP, config.MISC_FOLDER
                ├── reads  config.PROTECTED_NAMES
                └── writes logs via logger_util.get_logger(__name__)

No module below this one in the dependency chain imports organizer.py,
keeping the graph acyclic and testable in isolation.

Complexity
----------
    O(n)  — linear in the number of files; each file visited exactly once.
    O(1)  — per-file extension lookup (dict hash map).
    O(k)  — conflict resolution, where k is the collision count (≪ n).
"""

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config import EXTENSION_MAP, MISC_FOLDER, PROTECTED_NAMES
from modules.logger_util import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class OrganizeResult:
    """
    Immutable-by-convention summary returned by organize_directory().

    Attributes
    ----------
    moved   : Number of files successfully moved.
    skipped : Number of files intentionally skipped (protected or already
              inside a category subfolder).
    errors  : Number of files that raised an exception (logged internally).
    details : Human-readable lines describing each action — useful for
              dry-run previews and verbose CLI output.
    """
    moved:   int = 0
    skipped: int = 0
    errors:  int = 0
    details: list[str] = field(default_factory=list)

    def __str__(self) -> str:
        return (
            f"Organised → Moved: {self.moved} | "
            f"Skipped: {self.skipped} | "
            f"Errors: {self.errors}"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_category(extension: str) -> str:
    """
    Map a file extension to its category folder name.

    Parameters
    ----------
    extension : str
        Lowercase file extension including the leading dot, e.g. '.pdf'.

    Returns
    -------
    str
        The destination category folder name (e.g. 'Documents'), or
        config.MISC_FOLDER if the extension is not in EXTENSION_MAP.

    Complexity: O(1) — single dict lookup.
    """
    return EXTENSION_MAP.get(extension.lower(), MISC_FOLDER)


def _resolve_conflict(destination: Path) -> Path:
    """
    If ``destination`` already exists, append an incrementing counter
    to the stem until a free path is found.

    Examples
    --------
        report.pdf        → report_1.pdf  → report_2.pdf …
        photo.jpg         → photo_1.jpg   → photo_2.jpg  …

    Parameters
    ----------
    destination : Path
        The initially desired target path.

    Returns
    -------
    Path
        A path guaranteed not to exist at the moment of this call.

    Complexity: O(k) where k is the number of collisions — almost always
    O(1) in practice because duplicate file names in the same folder
    are rare outside a duplicate-heavy download directory.
    """
    if not destination.exists():
        return destination

    stem      = destination.stem
    suffix    = destination.suffix
    parent    = destination.parent
    counter   = 1

    while True:
        candidate = parent / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            logger.debug(
                "Name conflict resolved: %s → %s",
                destination.name,
                candidate.name,
            )
            return candidate
        counter += 1


def _is_category_folder(path: Path, source: Path) -> bool:
    """
    Return True if ``path`` is a direct child of ``source`` AND matches
    a known category name (or MISC_FOLDER).

    Used inside os.walk to prune traversal so we never re-organise files
    that have already been sorted into category subfolders.

    Complexity: O(m) where m = |EXTENSION_MAP values| — bounded constant.
    """
    known_categories: set[str] = set(EXTENSION_MAP.values()) | {MISC_FOLDER}
    return path.parent == source and path.name in known_categories


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def organize_directory(
    source_path: str,
    dry_run: bool = False,
) -> OrganizeResult:
    """
    Scan ``source_path`` and move every file into a category subfolder.

    Parameters
    ----------
    source_path : str
        Absolute or relative path to the directory to organise.
        Must exist and be a directory.
    dry_run : bool, optional
        When True, log and record every action that *would* happen but
        do not move any files.  Defaults to False.

    Returns
    -------
    OrganizeResult
        Summary of moved / skipped / errored files.

    Raises
    ------
    ValueError
        If source_path does not exist or is not a directory.

    Notes
    -----
    * Uses os.walk with topdown=True so we can prune already-organised
      category subdirectories from further traversal.
    * Uses shutil.move which works across filesystem boundaries (unlike
      os.rename which is limited to the same device).
    * All individual file errors are caught and logged — the function
      never raises on a per-file permission error or I/O failure.
    """
    result  = OrganizeResult()
    source  = Path(source_path).resolve()

    # ------------------------------------------------------------------ #
    # 1. Validate input
    # ------------------------------------------------------------------ #
    if not source.exists():
        raise ValueError(f"Source path does not exist: {source}")
    if not source.is_dir():
        raise ValueError(f"Source path is not a directory: {source}")

    mode_label = "[DRY RUN] " if dry_run else ""
    logger.info("%sStarting organisation of: %s", mode_label, source)

    # ------------------------------------------------------------------ #
    # 2. Walk the directory tree
    #    topdown=True lets us modify `dirs` in-place to skip subtrees.
    # ------------------------------------------------------------------ #
    for current_dir, dirs, files in os.walk(source, topdown=True):
        current_path = Path(current_dir)

        # ---- Prune category subfolders from further recursion ----------
        # We modify dirs in-place (required by os.walk contract).
        # This prevents re-sorting files that are already organised.
        dirs[:] = [
            d for d in dirs
            if not _is_category_folder(current_path / d, source)
        ]

        for filename in files:
            file_path = current_path / filename

            # ---- 2a. Skip protected files ------------------------------
            if filename in PROTECTED_NAMES:
                logger.debug("Protected — skipping: %s", filename)
                result.skipped += 1
                continue

            # ---- 2b. Determine category --------------------------------
            extension = file_path.suffix          # e.g. ".pdf"
            category  = _get_category(extension)  # O(1) lookup

            # ---- 2c. Build destination path ----------------------------
            dest_dir  = source / category
            dest_file = dest_dir / filename
            dest_file = _resolve_conflict(dest_file)   # handle name clashes

            # ---- 2d. Move (or simulate) --------------------------------
            action_line = (
                f"{file_path.relative_to(source)}  →  "
                f"{category}/{dest_file.name}"
            )

            if dry_run:
                logger.info("[DRY RUN] Would move: %s", action_line)
                result.details.append(f"[PREVIEW] {action_line}")
                result.moved += 1    # count as "would move" for summary
                continue

            try:
                os.makedirs(dest_dir, exist_ok=True)
                shutil.move(str(file_path), str(dest_file))

                logger.info("Moved: %s", action_line)
                result.details.append(f"[OK]      {action_line}")
                result.moved += 1

            except PermissionError as exc:
                logger.warning(
                    "Permission denied — skipping %s: %s", filename, exc
                )
                result.details.append(f"[PERM]    {filename} — {exc}")
                result.errors += 1

            except FileNotFoundError as exc:
                # Race condition: file deleted between walk and move
                logger.warning(
                    "File vanished before move — skipping %s: %s",
                    filename, exc,
                )
                result.details.append(f"[GONE]    {filename} — {exc}")
                result.errors += 1

            except OSError as exc:
                # Catches: cross-device link errors, disk full, etc.
                logger.error(
                    "OS error moving %s: %s", filename, exc
                )
                result.details.append(f"[ERROR]   {filename} — {exc}")
                result.errors += 1

    # ------------------------------------------------------------------ #
    # 3. Final summary
    # ------------------------------------------------------------------ #
    logger.info(
        "%sOrganisation complete. %s", mode_label, result
    )
    return result


def get_directory_preview(source_path: str) -> dict[str, list[str]]:
    """
    Return a category → [filenames] mapping without moving anything.

    Useful for showing the user what *will* happen before they confirm.

    Parameters
    ----------
    source_path : str
        Path to the directory to preview.

    Returns
    -------
    dict[str, list[str]]
        Keys are category folder names; values are lists of filenames
        that would be moved into that category.

    Complexity: O(n) — iterates files once; O(1) per lookup.
    """
    source  = Path(source_path).resolve()
    preview: dict[str, list[str]] = {}

    if not source.exists() or not source.is_dir():
        logger.warning("Preview requested on invalid path: %s", source_path)
        return preview

    for current_dir, dirs, files in os.walk(source, topdown=True):
        current_path = Path(current_dir)
        dirs[:] = [
            d for d in dirs
            if not _is_category_folder(current_path / d, source)
        ]

        for filename in files:
            if filename in PROTECTED_NAMES:
                continue
            ext      = (current_path / filename).suffix
            category = _get_category(ext)
            preview.setdefault(category, []).append(filename)

    return preview
