"""
main.py — Smart File Organiser & Automation Tool
=================================================
Interactive CLI entry point.  Coordinates all modules but contains
zero business logic — every operation is delegated to the modules/ package.

Responsibilities of this file
------------------------------
  1. Bootstrap logging (once, before any other import uses it).
  2. Present a numbered menu and route user choices.
  3. Collect and validate user input (paths, confirmations).
  4. Enforce the preview → confirm → execute contract for every
     destructive action.
  5. Handle KeyboardInterrupt (Ctrl+C) and top-level exceptions
     gracefully — the application never dumps a raw traceback.

What does NOT live here
-----------------------
  * File-move logic          → modules/organizer.py
  * Hashing / dupe detection → modules/duplicate_checker.py
  * Deletion logic           → modules/cleaner.py
  * Extension mapping        → config.py

Run
---
    python main.py
"""

import os
import sys
from pathlib import Path
from typing import Optional

# ── Bootstrap logging FIRST so every subsequent import can log ────
from modules.logger_util import setup_logging, get_logger
setup_logging()
logger = get_logger(__name__)

# ── Module imports (logging is live by now) ───────────────────────
from modules.organizer        import organize_directory, get_directory_preview
from modules.duplicate_checker import find_duplicates, format_duplicate_report, DuplicateResult
from modules.cleaner          import (
    delete_duplicates, remove_empty_folders,
    get_folder_stats, CleanResult,
)


# ─────────────────────────────────────────────────────────────────
# Display constants
# ─────────────────────────────────────────────────────────────────

APP_NAME    = "Smart File Organiser & Automation Tool"
APP_VERSION = "1.0.0"
DIVIDER     = "─" * 56
HEAVY_DIV   = "═" * 56


# ─────────────────────────────────────────────────────────────────
# UI helpers
# ─────────────────────────────────────────────────────────────────

def _clear() -> None:
    """Clear the terminal screen (cross-platform)."""
    os.system("cls" if os.name == "nt" else "clear")


def _header() -> None:
    """Print the application banner."""
    print(f"\n{HEAVY_DIV}")
    print(f"  {APP_NAME}")
    print(f"  v{APP_VERSION}")
    print(HEAVY_DIV)


def _print_menu() -> None:
    """Render the main menu options."""
    print(f"\n{DIVIDER}")
    print("  MAIN MENU")
    print(DIVIDER)
    print("  [1]  Organise Files into Category Folders")
    print("  [2]  Scan for Duplicate Files")
    print("  [3]  Delete Duplicate Files")
    print("  [4]  Remove Empty Folders")
    print("  [5]  View Folder Statistics")
    print("  [6]  Exit")
    print(DIVIDER)


def _prompt(message: str) -> str:
    """
    Read a line from stdin, stripping surrounding whitespace.
    Returns an empty string on EOF (non-interactive / piped input).
    """
    try:
        return input(message).strip()
    except EOFError:
        return ""


def _get_path_from_user(prompt_text: str = "Enter directory path") -> Optional[Path]:
    """
    Prompt the user for a directory path and validate it.

    Returns
    -------
    Path
        A resolved, existing directory path.
    None
        If the user enters nothing or provides an invalid path.
    """
    raw = _prompt(f"\n  {prompt_text}: ").strip().strip("'\"")

    if not raw:
        print("  [!] No path entered.")
        return None

    path = Path(raw).resolve()

    if not path.exists():
        print(f"  [!] Path does not exist: {path}")
        logger.warning("User supplied non-existent path: %s", path)
        return None

    if not path.is_dir():
        print(f"  [!] Path is not a directory: {path}")
        logger.warning("User supplied a file path instead of directory: %s", path)
        return None

    return path


def _confirm_action(prompt_text: str = "Proceed?") -> bool:
    """
    Require the user to type the word 'yes' (case-insensitive) to confirm
    a destructive action.  Anything else — including just pressing Enter —
    is treated as a cancellation.

    This is Layer 3 of the safety architecture.  Returning True is the
    only way delete_duplicates(confirmed=True) is ever called.

    Returns
    -------
    bool  — True only if the user typed 'yes'.
    """
    answer = _prompt(f"\n  {prompt_text} [type 'yes' to confirm]: ")
    if answer.lower() == "yes":
        return True
    print("  [✗] Action cancelled.")
    logger.info("User cancelled action: %s", prompt_text)
    return False


def _pause() -> None:
    """Wait for the user to press Enter before returning to the menu."""
    _prompt("\n  Press Enter to return to the menu...")


def _print_result_summary(label: str, result: object) -> None:
    """Print a coloured-text-free summary line for any result dataclass."""
    print(f"\n  {DIVIDER}")
    print(f"  {label}")
    print(f"  {result}")
    print(f"  {DIVIDER}")


# ─────────────────────────────────────────────────────────────────
# Menu action handlers
# Each function handles ONE menu item end-to-end:
#   validate input → preview → confirm → execute → summarise
# ─────────────────────────────────────────────────────────────────

def _action_organise() -> None:
    """[1] Organise files into category subfolders."""
    print(f"\n{DIVIDER}")
    print("  ORGANISE FILES")
    print(DIVIDER)

    target = _get_path_from_user("Directory to organise")
    if target is None:
        _pause()
        return

    # ── Preview ──────────────────────────────────────────────────
    print(f"\n  Scanning: {target} …")
    preview = get_directory_preview(str(target))

    if not preview:
        print("  [✓] Nothing to organise — no files found (or all protected).")
        _pause()
        return

    total_to_move = sum(len(v) for v in preview.values())
    print(f"\n  Preview — {total_to_move} file(s) will be moved:\n")
    for category in sorted(preview):
        files = preview[category]
        print(f"    {category:<22} ← {len(files)} file(s)")
        for name in sorted(files)[:5]:          # show first 5 per category
            print(f"       • {name}")
        if len(files) > 5:
            print(f"       … and {len(files) - 5} more")

    # ── Confirm ───────────────────────────────────────────────────
    if not _confirm_action(f"Move {total_to_move} file(s) into category folders?"):
        _pause()
        return

    # ── Execute ───────────────────────────────────────────────────
    print("\n  Organising …")
    try:
        result = organize_directory(str(target))
    except ValueError as exc:
        print(f"  [!] Error: {exc}")
        logger.error("organize_directory failed: %s", exc)
        _pause()
        return

    _print_result_summary("ORGANISATION COMPLETE", result)
    _pause()


def _action_scan_duplicates() -> Optional[DuplicateResult]:
    """
    [2] Scan a directory for duplicates and display the report.

    Returns
    -------
    DuplicateResult or None
        Returns the result so option [3] can reuse it without rescanning.
    """
    print(f"\n{DIVIDER}")
    print("  SCAN FOR DUPLICATE FILES")
    print(DIVIDER)

    target = _get_path_from_user("Directory to scan")
    if target is None:
        _pause()
        return None

    recursive_ans = _prompt("\n  Include subdirectories? [Y/n]: ")
    recursive     = recursive_ans.lower() not in ("n", "no")

    print(f"\n  Scanning{' recursively' if recursive else ''}: {target} …")

    try:
        result = find_duplicates(str(target), recursive=recursive)
    except ValueError as exc:
        print(f"  [!] Error: {exc}")
        logger.error("find_duplicates failed: %s", exc)
        _pause()
        return None

    report = format_duplicate_report(result)
    print(f"\n{report}")

    _print_result_summary("SCAN COMPLETE", result)
    _pause()
    return result


def _action_clean_duplicates(last_scan: Optional[DuplicateResult] = None) -> None:
    """
    [3] Delete duplicate files.

    If a DuplicateResult from option [2] is available it is reused
    (avoiding a redundant re-scan).  Otherwise a fresh scan is run first.
    """
    print(f"\n{DIVIDER}")
    print("  DELETE DUPLICATE FILES")
    print(DIVIDER)

    # ── Obtain a DuplicateResult ──────────────────────────────────
    if last_scan is not None and last_scan.group_count > 0:
        reuse = _prompt(
            "\n  A duplicate scan result is already loaded. "
            "Re-use it? [Y/n]: "
        )
        if reuse.lower() in ("n", "no"):
            last_scan = None

    if last_scan is None:
        target = _get_path_from_user("Directory to scan for duplicates")
        if target is None:
            _pause()
            return

        print(f"\n  Scanning: {target} …")
        try:
            last_scan = find_duplicates(str(target))
        except ValueError as exc:
            print(f"  [!] Error: {exc}")
            logger.error("find_duplicates failed in clean action: %s", exc)
            _pause()
            return

    if last_scan.group_count == 0:
        print("  [✓] No duplicate groups found — nothing to delete.")
        _pause()
        return

    # ── Forced dry-run preview BEFORE confirmation ────────────────
    print(f"\n  Preview — what WOULD be deleted:\n")
    dry = delete_duplicates(last_scan, confirmed=False, dry_run=True)
    for line in dry.details:
        print(f"    {line}")

    mb_estimate = last_scan.wasted_bytes / (1024 * 1024)
    print(f"\n  Estimated space to recover: {mb_estimate:.2f} MB")

    # ── Confirm ───────────────────────────────────────────────────
    if not _confirm_action(
        f"Permanently delete {dry.deleted} duplicate file(s)?"
    ):
        _pause()
        return

    # ── Execute ───────────────────────────────────────────────────
    print("\n  Deleting duplicates …")
    live = delete_duplicates(last_scan, confirmed=True, dry_run=False)

    _print_result_summary("DUPLICATE CLEANUP COMPLETE", live)
    _pause()


def _action_remove_empty_folders() -> None:
    """[4] Scan and remove empty subdirectories."""
    print(f"\n{DIVIDER}")
    print("  REMOVE EMPTY FOLDERS")
    print(DIVIDER)

    target = _get_path_from_user("Directory to clean up")
    if target is None:
        _pause()
        return

    # ── Dry-run preview ───────────────────────────────────────────
    print(f"\n  Scanning: {target} …")
    dry = remove_empty_folders(str(target), dry_run=True)

    if dry.deleted == 0:
        print("  [✓] No empty folders found.")
        _pause()
        return

    print(f"\n  Preview — {dry.deleted} empty folder(s) would be removed:\n")
    for line in dry.details:
        print(f"    {line}")

    # ── Confirm ───────────────────────────────────────────────────
    if not _confirm_action(f"Remove {dry.deleted} empty folder(s)?"):
        _pause()
        return

    # ── Execute ───────────────────────────────────────────────────
    print("\n  Removing empty folders …")
    live = remove_empty_folders(str(target), dry_run=False)

    _print_result_summary("FOLDER CLEANUP COMPLETE", live)
    _pause()


def _action_folder_stats() -> None:
    """[5] Display statistics for a chosen directory."""
    print(f"\n{DIVIDER}")
    print("  FOLDER STATISTICS")
    print(DIVIDER)

    target = _get_path_from_user("Directory to inspect")
    if target is None:
        _pause()
        return

    print(f"\n  Calculating stats for: {target} …\n")
    stats = get_folder_stats(str(target))

    print(f"  {'Total files':<26}  {stats.total_files}")
    print(f"  {'Total subfolders':<26}  {stats.total_folders}")
    print(f"  {'Total size':<26}  {stats.total_mb:.2f} MB  "
          f"({stats.total_bytes:,} bytes)")
    print(f"  {'Empty folders':<26}  {stats.empty_folders}")
    print(f"\n  {DIVIDER}")
    logger.info("Folder stats for %s: %s", target, stats)
    _pause()


# ─────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────

def main() -> None:
    """
    Application entry point.

    Runs the interactive menu loop until the user chooses Exit or
    sends Ctrl+C / Ctrl+D.  All exceptions are caught at the loop
    level so a single failed operation never terminates the process.
    """
    logger.info("Application started. v%s", APP_VERSION)
    _clear()
    _header()

    # Persists the last DuplicateResult so option [3] can skip rescanning.
    last_scan: Optional[DuplicateResult] = None

    while True:
        try:
            _print_menu()
            choice = _prompt("  Select option [1-6]: ")

            if choice == "1":
                _clear()
                _action_organise()
                last_scan = None    # directory changed; invalidate cache

            elif choice == "2":
                _clear()
                last_scan = _action_scan_duplicates()

            elif choice == "3":
                _clear()
                _action_clean_duplicates(last_scan)
                last_scan = None    # consumed; reset to avoid stale state

            elif choice == "4":
                _clear()
                _action_remove_empty_folders()

            elif choice == "5":
                _clear()
                _action_folder_stats()

            elif choice == "6":
                print("\n  Goodbye! Audit trail saved to logs/organizer.log\n")
                logger.info("Application exited normally by user.")
                sys.exit(0)

            else:
                print(f"\n  [!] '{choice}' is not a valid option. Please enter 1–6.")

        except KeyboardInterrupt:
            # Ctrl+C mid-prompt: return to menu cleanly instead of crashing
            print("\n\n  [!] Interrupted. Returning to menu…")
            logger.info("KeyboardInterrupt caught — returning to menu.")

        except Exception as exc:
            # Catch-all: log the full traceback but keep the app alive
            print(f"\n  [!] Unexpected error: {exc}")
            print("  The error has been logged. Returning to menu.")
            logger.exception("Unhandled exception in main loop: %s", exc)


# ─────────────────────────────────────────────────────────────────
# Entry guard
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    main()
