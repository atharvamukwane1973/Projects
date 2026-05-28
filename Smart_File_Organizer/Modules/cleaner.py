"""
modules/cleaner.py — Safety-First File Cleanup Utility
=======================================================
The ONLY destructive module in the project.  Every deletion path is
guarded by three independent safety layers:

    Layer 1 — PROTECTED_NAMES whitelist  (config.py, always enforced)
    Layer 2 — dry_run preview mode       (see what would be deleted first)
    Layer 3 — Explicit confirmation      (caller must pass confirmed=True)

This means main.py is responsible for obtaining user consent BEFORE
calling any mutating function here.  The cleaner itself never prompts —
keeping I/O and business logic separated.

Public API
----------
    delete_duplicates(result, confirmed, dry_run)  -> CleanResult
    remove_empty_folders(source_path, dry_run)     -> CleanResult
    get_folder_stats(source_path)                  -> FolderStats

CleanResult (dataclass)
-----------------------
    deleted       : int    — items successfully removed
    skipped       : int    — items protected or intentionally left
    errors        : int    — items that raised an exception
    freed_bytes   : int    — actual disk space recovered
    details       : list[str]

Architecture
------------
    main.py
        ├── calls duplicate_checker.find_duplicates() → DuplicateResult
        ├── displays format_duplicate_report()
        ├── prompts user for confirmation
        └── calls cleaner.delete_duplicates(result, confirmed=True)

    cleaner.py never imports organizer.py or duplicate_checker.py —
    it only CONSUMES their output types, keeping the graph acyclic.

Complexity
----------
    delete_duplicates   → O(k)    k = number of duplicate files to remove
    remove_empty_folders→ O(d)    d = total subdirectory count
    get_folder_stats    → O(n)    n = total files
"""

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from config import PROTECTED_NAMES
from modules.logger_util import get_logger

# TYPE_CHECKING guard avoids a circular import at runtime while still
# giving static analysers full type information.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from modules.duplicate_checker import DuplicateResult

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result containers
# ---------------------------------------------------------------------------

@dataclass
class CleanResult:
    """
    Summary returned by every public cleaner function.

    Attributes
    ----------
    deleted     : Items (files or folders) successfully removed.
    skipped     : Items intentionally left (protected, dry-run, kept copy).
    errors      : Items that raised an exception during removal.
    freed_bytes : Actual disk space recovered (0 in dry-run mode).
    details     : Human-readable per-item action lines.
    """
    deleted:     int       = 0
    skipped:     int       = 0
    errors:      int       = 0
    freed_bytes: int       = 0
    details:     list[str] = field(default_factory=list)

    @property
    def freed_mb(self) -> float:
        """Freed disk space in megabytes."""
        return self.freed_bytes / (1024 * 1024)

    def __str__(self) -> str:
        return (
            f"Deleted: {self.deleted} | "
            f"Skipped: {self.skipped} | "
            f"Errors: {self.errors} | "
            f"Freed: {self.freed_mb:.2f} MB"
        )


@dataclass
class FolderStats:
    """
    Lightweight summary of a directory returned by get_folder_stats().

    Attributes
    ----------
    total_files   : Total file count (all depths).
    total_folders : Total subfolder count.
    total_bytes   : Combined size of all files.
    empty_folders : Folders containing zero files at any depth.
    """
    total_files:   int = 0
    total_folders: int = 0
    total_bytes:   int = 0
    empty_folders: int = 0

    @property
    def total_mb(self) -> float:
        return self.total_bytes / (1024 * 1024)

    def __str__(self) -> str:
        return (
            f"Files: {self.total_files} | "
            f"Folders: {self.total_folders} | "
            f"Size: {self.total_mb:.2f} MB | "
            f"Empty folders: {self.empty_folders}"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_protected(path: Path) -> bool:
    """
    Return True if the file or folder name appears in PROTECTED_NAMES.

    This is Layer 1 of the safety architecture — a hard whitelist that
    cannot be overridden by any runtime argument.

    Complexity: O(1) — frozenset membership test.
    """
    return path.name in PROTECTED_NAMES


def _safe_delete_file(
    path: Path,
    result: CleanResult,
    dry_run: bool,
    label: str = "",
) -> None:
    """
    Delete a single file with full exception handling.

    Mutates ``result`` in place — increments deleted/skipped/errors
    and appends a detail line.

    Parameters
    ----------
    path    : Absolute path to the file to delete.
    result  : CleanResult accumulator to update.
    dry_run : If True, log the action but do not delete.
    label   : Optional prefix for the detail line (e.g. '[DUPE]').
    """
    prefix = f"{label} " if label else ""

    # ── Layer 1: Protected names ──────────────────────────────────
    if _is_protected(path):
        msg = f"[PROTECTED] {path.name} — skipped (in PROTECTED_NAMES)"
        logger.debug(msg)
        result.details.append(msg)
        result.skipped += 1
        return

    # ── Dry-run preview ───────────────────────────────────────────
    if dry_run:
        try:
            size = path.stat().st_size
        except OSError:
            size = 0
        msg = f"[DRY RUN] {prefix}Would delete: {path}  ({size / 1024:.1f} KB)"
        logger.info(msg)
        result.details.append(msg)
        result.deleted += 1     # count as "would delete" for summary
        return

    # ── Actual deletion ───────────────────────────────────────────
    try:
        size = path.stat().st_size   # capture BEFORE deletion
        path.unlink()
        result.freed_bytes += size
        result.deleted += 1
        msg = f"[DELETED] {prefix}{path}  ({size / 1024:.1f} KB freed)"
        logger.info(msg)
        result.details.append(msg)

    except PermissionError as exc:
        msg = f"[PERM]    {path.name} — permission denied: {exc}"
        logger.warning(msg)
        result.details.append(msg)
        result.errors += 1

    except FileNotFoundError:
        # File already gone — race condition or double-delete
        msg = f"[GONE]    {path.name} — already removed"
        logger.warning(msg)
        result.details.append(msg)
        result.skipped += 1

    except OSError as exc:
        msg = f"[ERROR]   {path.name} — OS error: {exc}"
        logger.error(msg)
        result.details.append(msg)
        result.errors += 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def delete_duplicates(
    result: "DuplicateResult",
    confirmed: bool = False,
    dry_run: bool = False,
) -> CleanResult:
    """
    Delete the duplicate copies identified by duplicate_checker.find_duplicates().

    For each duplicate group, the FIRST path (index 0) is treated as the
    "original" and is always kept.  All subsequent paths are deleted.

    Parameters
    ----------
    result    : DuplicateResult from duplicate_checker.find_duplicates().
    confirmed : Must be True to proceed with live deletion.  If False and
                dry_run is also False, the function aborts with a warning.
                This enforces Layer 3 — the caller (main.py) must explicitly
                obtain user consent before passing confirmed=True.
    dry_run   : Preview mode — log what would be deleted, touch nothing.
                Overrides confirmed; useful for safe previewing.

    Returns
    -------
    CleanResult
        Summary of deleted / skipped / errored files and bytes freed.

    Notes
    -----
    * Never raises on per-file errors — all exceptions are caught and
      recorded in CleanResult.errors.
    * Empty groups are silently skipped (defensive; should not occur from
      find_duplicates() output).
    """
    clean = CleanResult()
    mode  = "[DRY RUN] " if dry_run else ""

    # ── Safety gate: refuse to delete without consent ─────────────
    if not dry_run and not confirmed:
        msg = (
            "Deletion aborted — confirmed=False was passed to "
            "delete_duplicates(). Call with confirmed=True after "
            "obtaining explicit user consent."
        )
        logger.warning(msg)
        clean.details.append(f"[ABORTED] {msg}")
        return clean

    if not result.groups:
        logger.info("No duplicate groups to process.")
        return clean

    logger.info(
        "%sDeleting duplicates across %d group(s).",
        mode, result.group_count,
    )

    for digest, paths in result.groups.items():
        if len(paths) < 2:
            continue    # Defensive: skip malformed groups

        short_hash  = f"{digest[:8]}..."
        kept_path   = paths[0]
        dupe_paths  = paths[1:]

        logger.info(
            "%sGroup [%s] — keeping: %s | deleting %d copy/copies",
            mode, short_hash, kept_path.name, len(dupe_paths),
        )

        # Mark the kept file in the details (never touched)
        clean.details.append(
            f"[KEPT]    {kept_path}  (original retained)"
        )
        clean.skipped += 1

        for dupe in dupe_paths:
            _safe_delete_file(dupe, clean, dry_run, label="[DUPE]")

    logger.info("%sDuplicate cleanup complete. %s", mode, clean)
    return clean


def remove_empty_folders(
    source_path: str,
    dry_run: bool = False,
    remove_root: bool = False,
) -> CleanResult:
    """
    Recursively remove empty subdirectories from ``source_path``.

    Uses os.walk with topdown=False (bottom-up traversal) so that deeply
    nested empty directories are removed before their parents are checked.
    os.rmdir() is inherently safe — it raises OSError if the directory
    still contains any files or subdirectories, so there is zero risk
    of accidentally deleting a non-empty folder.

    Parameters
    ----------
    source_path : str   — root directory to clean.
    dry_run     : bool  — if True, log but do not remove anything.
    remove_root : bool  — if True, also remove source_path itself if it
                          ends up empty.  Default False (protect root).

    Returns
    -------
    CleanResult
        deleted = number of empty folders removed.
    """
    clean  = CleanResult()
    source = Path(source_path).resolve()
    mode   = "[DRY RUN] " if dry_run else ""

    if not source.exists() or not source.is_dir():
        logger.warning("remove_empty_folders: invalid path %s", source_path)
        return clean

    logger.info("%sScanning for empty folders in: %s", mode, source)

    # topdown=False → children processed before parents (crucial for
    # removing nested empty hierarchies in a single pass).
    for current_dir, dirs, files in os.walk(source, topdown=False):
        folder = Path(current_dir)

        # Never touch the root itself unless explicitly allowed
        if folder == source and not remove_root:
            continue

        # Never touch protected names
        if _is_protected(folder):
            logger.debug("Protected folder — skipping: %s", folder.name)
            clean.skipped += 1
            continue

        # Check emptiness: os.listdir is accurate AFTER children are
        # already removed by previous loop iterations.
        try:
            is_empty = not any(folder.iterdir())
        except PermissionError as exc:
            logger.warning("Cannot read folder %s: %s", folder, exc)
            clean.errors += 1
            continue

        if not is_empty:
            continue

        if dry_run:
            msg = f"[DRY RUN] Would remove empty folder: {folder}"
            logger.info(msg)
            clean.details.append(msg)
            clean.deleted += 1
            continue

        try:
            os.rmdir(folder)     # Raises OSError if not empty — safe.
            msg = f"[REMOVED] Empty folder: {folder}"
            logger.info(msg)
            clean.details.append(msg)
            clean.deleted += 1

        except OSError as exc:
            # Folder became non-empty between our check and rmdir —
            # race condition; safe to ignore.
            msg = f"[SKIP]    {folder.name} — not empty or locked: {exc}"
            logger.debug(msg)
            clean.details.append(msg)
            clean.skipped += 1

    logger.info("%sEmpty folder removal complete. %s", mode, clean)
    return clean


def get_folder_stats(source_path: str) -> FolderStats:
    """
    Collect lightweight statistics about a directory without modifying it.

    Used by main.py to display a pre-clean summary so the user knows
    what they are working with before invoking any destructive operation.

    Parameters
    ----------
    source_path : str — path to the directory to inspect.

    Returns
    -------
    FolderStats
        File count, folder count, total size, and empty-folder count.

    Complexity: O(n) — one stat() per file, one listdir() per directory.
    """
    stats  = FolderStats()
    source = Path(source_path).resolve()

    if not source.exists() or not source.is_dir():
        logger.warning("get_folder_stats: invalid path %s", source_path)
        return stats

    for current_dir, dirs, files in os.walk(source):
        folder = Path(current_dir)

        # Count subdirectories
        stats.total_folders += len(dirs)

        # Count and size files
        for filename in files:
            stats.total_files += 1
            try:
                stats.total_bytes += (folder / filename).stat().st_size
            except OSError:
                pass    # File unreadable — count it but skip sizing

        # Detect empty folders (no files AND no subdirs at this level)
        if not files and not dirs and folder != source:
            stats.empty_folders += 1

    return stats
