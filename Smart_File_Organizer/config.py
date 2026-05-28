"""
config.py — Centralized Configuration
======================================
Single source of truth for all constants used across the application.
No logic lives here — only data. This keeps every other module's
behaviour tunable from one place without touching business logic.
"""

import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Project root — resolved relative to THIS file so it works regardless of
# where the user launches the script from.
BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))

LOG_DIR: str = os.path.join(BASE_DIR, "logs")
LOG_FILE: str = os.path.join(LOG_DIR, "organizer.log")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_LEVEL: str = "DEBUG"          # Root level written to file
CONSOLE_LOG_LEVEL: str = "INFO"   # Level echoed to stdout

LOG_FORMAT: str = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)
DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"

# Max log file size before rotation (5 MB), keep 3 backups
LOG_MAX_BYTES: int = 5 * 1024 * 1024
LOG_BACKUP_COUNT: int = 3

# ---------------------------------------------------------------------------
# File-type → folder mapping
# O(1) lookup: dict is a hash map; extending coverage = add one line here.
# ---------------------------------------------------------------------------

EXTENSION_MAP: dict[str, str] = {
    # Documents
    ".pdf":   "Documents",
    ".doc":   "Documents",
    ".docx":  "Documents",
    ".txt":   "Documents",
    ".odt":   "Documents",
    ".rtf":   "Documents",
    ".md":    "Documents",
    # Spreadsheets
    ".xls":   "Spreadsheets",
    ".xlsx":  "Spreadsheets",
    ".csv":   "Spreadsheets",
    ".ods":   "Spreadsheets",
    # Presentations
    ".ppt":   "Presentations",
    ".pptx":  "Presentations",
    ".odp":   "Presentations",
    # Images
    ".jpg":   "Images",
    ".jpeg":  "Images",
    ".png":   "Images",
    ".gif":   "Images",
    ".bmp":   "Images",
    ".svg":   "Images",
    ".webp":  "Images",
    ".ico":   "Images",
    ".tiff":  "Images",
    # Videos
    ".mp4":   "Videos",
    ".mov":   "Videos",
    ".avi":   "Videos",
    ".mkv":   "Videos",
    ".wmv":   "Videos",
    ".flv":   "Videos",
    ".webm":  "Videos",
    # Audio
    ".mp3":   "Audio",
    ".wav":   "Audio",
    ".flac":  "Audio",
    ".aac":   "Audio",
    ".ogg":   "Audio",
    ".m4a":   "Audio",
    # Archives
    ".zip":   "Archives",
    ".tar":   "Archives",
    ".gz":    "Archives",
    ".rar":   "Archives",
    ".7z":    "Archives",
    ".bz2":   "Archives",
    # Code
    ".py":    "Code",
    ".js":    "Code",
    ".ts":    "Code",
    ".html":  "Code",
    ".css":   "Code",
    ".java":  "Code",
    ".cpp":   "Code",
    ".c":     "Code",
    ".h":     "Code",
    ".json":  "Code",
    ".xml":   "Code",
    ".yaml":  "Code",
    ".yml":   "Code",
    ".sh":    "Code",
    ".bat":   "Code",
    # Executables / installers
    ".exe":   "Executables",
    ".msi":   "Executables",
    ".dmg":   "Executables",
    ".deb":   "Executables",
    ".rpm":   "Executables",
    # Fonts
    ".ttf":   "Fonts",
    ".otf":   "Fonts",
    ".woff":  "Fonts",
    ".woff2": "Fonts",
}

# Folder name for files whose extension is not in EXTENSION_MAP
MISC_FOLDER: str = "Miscellaneous"

# ---------------------------------------------------------------------------
# Duplicate Checker
# ---------------------------------------------------------------------------

# SHA-256 read chunk size (64 KB) — balances memory use vs I/O syscalls.
# Increasing this speeds up hashing on large files; decreasing it reduces
# peak memory on systems with many concurrent operations.
HASH_CHUNK_SIZE: int = 65_536   # 64 KB

# ---------------------------------------------------------------------------
# Cleaner
# ---------------------------------------------------------------------------

# Files/folders the cleaner will NEVER touch, regardless of user input.
PROTECTED_NAMES: frozenset[str] = frozenset({
    "organizer.log",
    ".gitkeep",
    ".gitignore",
    ".DS_Store",
})
