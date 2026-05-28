"""
modules/duplicate_checker.py — SHA-256 Duplicate Detection Engine
==================================================================
Finds duplicate files using a two-pass strategy:

  Pass 1 — Group files by size (O(n), stat-only, no I/O reads).
            Discard groups with a single member → they cannot be duplicates.

  Pass 2 — Hash only the survivors using SHA-256 in 64 KB chunks.
            Group by digest; discard single-member groups again.
            Remaining groups are confirmed duplicates.

This approach eliminates ~80-90 % of files before any hashing occurs,
making it dramatically faster than a naïve "hash everything" approach.

Public API
----------
    find_duplicates(source_path, recursive=True)  -> DuplicateResult
    format_duplicate_report(result)               -> str

DuplicateResult (dataclass)
---------------------------
    groups          : dict[str, list[Path]]   — hash → duplicate paths
    total_files     : int                     — files scanned
    duplicate_count : int                     — files that are duplicates
    wasted_bytes    : int                     — reclaimable disk space

Architecture
------------
    main.py
        └── calls find_duplicates()
                ├── reads  config.HASH_CHUNK_SIZE, config.PROTECTED_NAMES
                └── writes logs via logger_util.get_logger(__name__)

Complexity
----------
    Pass 1  → O(n)       — one os.stat() per file, no reads
    Pass 2  → O(m · b)   — m = size-collision survivors, b = bytes per file
    Overall → O(n + m·b) — practically O(n) since m ≪ n
    Memory  → O(chunk)   — flat 64 KB regardless of individual file size
"""

import hashlib
import os
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config import HASH_CHUNK_SIZE, PROTECTED_NAMES
from modules.logger_util import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class DuplicateResult:
    """
    Summary returned by find_duplicates().

    Attributes
    ----------
    groups : dict[str, list[Path]]
        Maps each SHA-256 digest to the list of paths that share it.
        Only groups with 2+ members are included (confirmed duplicates).
    total_files : int
        Total number of files scanned (including non-duplicates).
    duplicate_count : int
        Total number of duplicate files (all members of all groups).
        The "original" cannot be determined programmatically — the caller
        decides which copy to keep.
    wasted_bytes : int
        Conservative estimate of reclaimable disk space:
        for each group, (count - 1) × file_size.  Keeping one copy of
        each group would free this many bytes.
    """
    groups:          dict[str, list[Path]] = field(default_factory=dict)
    total_files:     int = 0
    duplicate_count: int = 0
    wasted_bytes:    int = 0

    @property
    def group_count(self) -> int:
        """Number of distinct duplicate groups."""
        return len(self.groups)

    def __str__(self) -> str:
        mb = self.wasted_bytes / (1024 * 1024)
        return (
            f"Scanned: {self.total_files} files | "
            f"Duplicate groups: {self.group_count} | "
            f"Duplicate files: {self.duplicate_count} | "
            f"Reclaimable: {mb:.2f} MB"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_sha256(file_path: Path) -> Optional[str]:
    """
    Compute the SHA-256 hex digest of a file using chunked reads.

    Reading in fixed-size chunks keeps peak memory usage at O(chunk_size)
    regardless of how large the file is — critical for video/archive files.

    Parameters
    ----------
    file_path : Path
        Absolute path to the file to hash.

    Returns
    -------
    str or None
        64-character lowercase hex digest, or None if the file could not
        be read (PermissionError, file vanished, I/O error).

    Complexity: O(b) where b = file size in bytes.
    Memory:     O(HASH_CHUNK_SIZE) — flat constant regardless of b.
    """
    hasher = hashlib.sha256()

    try:
        with open(file_path, "rb") as fh:
            while chunk := fh.read(HASH_CHUNK_SIZE):   # walrus, Python 3.8+
                hasher.update(chunk)
        return hasher.hexdigest()

    except PermissionError:
        logger.warning("Permission denied — cannot hash: %s", file_path)
        return None

    except FileNotFoundError:
        # Race condition: file deleted between scan and hash.
        logger.warning("File vanished before hashing: %s", file_path)
        return None

    except OSError as exc:
        logger.error("OS error hashing %s: %s", file_path, exc)
        return None


def _collect_files(source: Path, recursive: bool) -> list[Path]:
    """
    Return a flat list of all files under ``source``.

    Parameters
    ----------
    source    : Path  — root directory to scan.
    recursive : bool  — if False, only the top-level directory is scanned.

    Returns
    -------
    list[Path]
        Absolute paths of every non-protected file found.

    Complexity: O(n) — each filesystem entry visited once.
    """
    collected: list[Path] = []

    if recursive:
        for current_dir, _, files in os.walk(source):
            for filename in files:
                if filename in PROTECTED_NAMES:
                    logger.debug("Protected — skipping: %s", filename)
                    continue
                collected.append(Path(current_dir) / filename)
    else:
        for entry in source.iterdir():
            if entry.is_file() and entry.name not in PROTECTED_NAMES:
                collected.append(entry)

    logger.debug("Collected %d files for duplicate scan.", len(collected))
    return collected


def _bucket_by_size(files: list[Path]) -> dict[int, list[Path]]:
    """
    Group files by their byte size.

    Only groups with 2+ members survive — single-member groups cannot
    possibly be duplicates and are discarded immediately.

    Parameters
    ----------
    files : list[Path]
        All file paths to consider.

    Returns
    -------
    dict[int, list[Path]]
        Maps file size (bytes) → list of paths sharing that size.
        Contains ONLY groups with ≥ 2 members.

    Complexity: O(n) — one os.stat() per file.
    """
    size_map: dict[int, list[Path]] = defaultdict(list)

    for path in files:
        try:
            size = path.stat().st_size
            size_map[size].append(path)
        except (OSError, FileNotFoundError) as exc:
            logger.warning("Could not stat %s: %s", path, exc)

    # Keep only groups that could contain duplicates
    survivors = {
        size: paths
        for size, paths in size_map.items()
        if len(paths) >= 2
    }

    eliminated = len(files) - sum(len(v) for v in survivors.values())
    logger.debug(
        "Pass 1 (size filter): %d unique-size files eliminated, "
        "%d candidates remain for hashing.",
        eliminated,
        sum(len(v) for v in survivors.values()),
    )
    return survivors


def _bucket_by_hash(
    size_buckets: dict[int, list[Path]],
) -> dict[str, list[Path]]:
    """
    Hash all size-collision survivors and group by digest.

    Only groups with 2+ members survive — a unique hash means the files
    happen to share a size but have different content.

    Parameters
    ----------
    size_buckets : dict[int, list[Path]]
        Output of _bucket_by_size() — files grouped by byte size.

    Returns
    -------
    dict[str, list[Path]]
        Maps SHA-256 hex digest → list of paths that are byte-for-byte
        identical.  Contains ONLY confirmed duplicate groups (≥ 2 members).

    Complexity: O(m · b) where m = candidate count, b = bytes per file.
    Memory:     O(HASH_CHUNK_SIZE) per file — chunked reads.
    """
    hash_map: dict[str, list[Path]] = defaultdict(list)
    total_candidates = sum(len(v) for v in size_buckets.values())
    hashed = 0

    for size, paths in size_buckets.items():
        for path in paths:
            digest = _compute_sha256(path)
            if digest is not None:
                hash_map[digest].append(path)
            hashed += 1
            # Progress heartbeat every 100 files — useful for large scans
            if hashed % 100 == 0:
                logger.debug("Hashing progress: %d / %d", hashed, total_candidates)

    duplicates = {
        digest: paths
        for digest, paths in hash_map.items()
        if len(paths) >= 2
    }

    logger.debug(
        "Pass 2 (hash filter): %d duplicate groups found.",
        len(duplicates),
    )
    return duplicates


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def find_duplicates(
    source_path: str,
    recursive: bool = True,
) -> DuplicateResult:
    """
    Scan ``source_path`` for duplicate files using the two-pass strategy.

    Parameters
    ----------
    source_path : str
        Absolute or relative path to the directory to scan.
    recursive : bool, optional
        Scan subdirectories recursively (default: True).

    Returns
    -------
    DuplicateResult
        Contains all duplicate groups and summary statistics.

    Raises
    ------
    ValueError
        If source_path does not exist or is not a directory.

    Notes
    -----
    * This function is read-only — it never moves or deletes files.
    * The caller (main.py / cleaner.py) decides which copies to remove.
    * Zero-byte files: all empty files share the same hash (the SHA-256
      of an empty byte string).  They are reported as duplicates so the
      user can review them.
    """
    source = Path(source_path).resolve()

    if not source.exists():
        raise ValueError(f"Source path does not exist: {source}")
    if not source.is_dir():
        raise ValueError(f"Source path is not a directory: {source}")

    logger.info("Starting duplicate scan: %s (recursive=%s)", source, recursive)

    # ------------------------------------------------------------------ #
    # Pass 1 — Collect & size-filter                                       #
    # ------------------------------------------------------------------ #
    all_files    = _collect_files(source, recursive)
    size_buckets = _bucket_by_size(all_files)

    if not size_buckets:
        logger.info("No size collisions found — directory has no duplicates.")
        return DuplicateResult(total_files=len(all_files))

    # ------------------------------------------------------------------ #
    # Pass 2 — Hash survivors only                                         #
    # ------------------------------------------------------------------ #
    duplicate_groups = _bucket_by_hash(size_buckets)

    # ------------------------------------------------------------------ #
    # Build result                                                          #
    # ------------------------------------------------------------------ #
    duplicate_count = sum(len(paths) for paths in duplicate_groups.values())

    wasted_bytes = 0
    for digest, paths in duplicate_groups.items():
        try:
            file_size    = paths[0].stat().st_size
            # (count - 1) copies are "wasted" — one must be kept
            wasted_bytes += file_size * (len(paths) - 1)
        except OSError:
            pass    # File may have been removed between scans

    result = DuplicateResult(
        groups          = dict(duplicate_groups),
        total_files     = len(all_files),
        duplicate_count = duplicate_count,
        wasted_bytes    = wasted_bytes,
    )

    logger.info("Duplicate scan complete. %s", result)
    return result


def format_duplicate_report(result: DuplicateResult) -> str:
    """
    Render a human-readable duplicate report for CLI display.

    Parameters
    ----------
    result : DuplicateResult
        The output of find_duplicates().

    Returns
    -------
    str
        A multi-line formatted report string, ready to print().

    Example output
    --------------
        ══════════════════════════════════════════
        DUPLICATE FILE REPORT
        ══════════════════════════════════════════
        Scanned : 142 files
        Groups  : 3 duplicate groups
        Copies  : 7 duplicate files
        Wasted  : 24.31 MB reclaimable

        ── Group 1 ─ SHA256: a3f9...c12e ──────
          [KEEP?]  /downloads/photo.jpg        (2.1 MB)
          [DUPE]   /downloads/photo_copy.jpg   (2.1 MB)

        ── Group 2 ─ SHA256: 88cd...f401 ──────
          ...
    """
    if not result.groups:
        return (
            "No duplicates found.\n"
            f"(Scanned {result.total_files} files)"
        )

    border = "═" * 50
    lines: list[str] = [
        border,
        "  DUPLICATE FILE REPORT",
        border,
        f"  Scanned : {result.total_files} files",
        f"  Groups  : {result.group_count} duplicate group(s)",
        f"  Copies  : {result.duplicate_count} duplicate files",
        f"  Wasted  : {result.wasted_bytes / (1024*1024):.2f} MB reclaimable",
        "",
    ]

    for idx, (digest, paths) in enumerate(result.groups.items(), start=1):
        short_hash = f"{digest[:4]}...{digest[-4:]}"
        lines.append(f"  ── Group {idx}  SHA256: {short_hash} {'─'*20}")

        for i, path in enumerate(paths):
            try:
                size_kb = path.stat().st_size / 1024
                label   = "[KEEP?]" if i == 0 else "[DUPE] "
                lines.append(f"    {label}  {path}  ({size_kb:.1f} KB)")
            except OSError:
                lines.append(f"    [GONE]   {path}  (file no longer accessible)")

        lines.append("")

    lines.append(border)
    return "\n".join(lines)
