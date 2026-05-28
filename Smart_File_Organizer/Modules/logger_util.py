"""
modules/logger_util.py — Centralized Logging Bootstrap
========================================================
Configures the application-wide logger exactly ONCE.  Every other module
obtains a child logger via:

    from modules.logger_util import get_logger
    logger = get_logger(__name__)

Using __name__ automatically namespaces each logger
(e.g. "modules.organizer", "modules.cleaner"), making log lines
self-identifying without any extra bookkeeping.

Design decisions
----------------
* RotatingFileHandler   — caps log file at LOG_MAX_BYTES, keeps
                          LOG_BACKUP_COUNT rolling backups. Prevents
                          unbounded disk growth on long-running jobs.
* StreamHandler         — mirrors INFO+ to stdout so the user sees
                          real-time progress without opening the log file.
* _CONFIGURED guard     — calling setup_logging() more than once is a
                          no-op, safe for unit-test environments that
                          import multiple modules.

Complexity
----------
* setup_logging()  → O(1)  — fixed number of handlers attached once.
* get_logger()     → O(1)  — logging.getLogger() is a dict lookup
                              internally (CPython implementation).
* Each log write   → O(log n) amortized — buffered I/O + rotation check.
"""

import logging
import logging.handlers
import os
import sys

# Guard flag — ensures handlers are attached only once even if this module
# is imported by multiple submodules in the same process.
_CONFIGURED: bool = False


def setup_logging() -> None:
    """
    Bootstrap the root logger with a RotatingFileHandler and a
    StreamHandler.  Should be called once from main.py before any
    other import that uses get_logger().

    Raises
    ------
    OSError
        If the log directory cannot be created (e.g. permission denied).
        We let this propagate because the application cannot run safely
        without an audit trail.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    # Inline import keeps config changes local to one place.
    from config import (
        LOG_DIR,
        LOG_FILE,
        LOG_FORMAT,
        DATE_FORMAT,
        LOG_LEVEL,
        CONSOLE_LOG_LEVEL,
        LOG_MAX_BYTES,
        LOG_BACKUP_COUNT,
    )

    # ------------------------------------------------------------------ #
    # 1. Ensure the logs/ directory exists
    # ------------------------------------------------------------------ #
    os.makedirs(LOG_DIR, exist_ok=True)

    # ------------------------------------------------------------------ #
    # 2. Build a shared formatter used by both handlers
    # ------------------------------------------------------------------ #
    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

    # ------------------------------------------------------------------ #
    # 3. Rotating file handler — full DEBUG detail to disk
    # ------------------------------------------------------------------ #
    file_handler = logging.handlers.RotatingFileHandler(
        filename=LOG_FILE,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.DEBUG))
    file_handler.setFormatter(formatter)

    # ------------------------------------------------------------------ #
    # 4. Console (stream) handler — INFO+ so the terminal stays clean
    # ------------------------------------------------------------------ #
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(
        getattr(logging, CONSOLE_LOG_LEVEL.upper(), logging.INFO)
    )
    console_handler.setFormatter(formatter)

    # ------------------------------------------------------------------ #
    # 5. Wire handlers onto the root logger
    # ------------------------------------------------------------------ #
    root_logger = logging.getLogger()           # Root catches everything
    root_logger.setLevel(logging.DEBUG)         # Let handlers decide level
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    _CONFIGURED = True

    # First log line — confirms logger is live and shows the log path.
    root_logger.info(
        "Logging initialised. Audit trail → %s", os.path.abspath(LOG_FILE)
    )


def get_logger(name: str) -> logging.Logger:
    """
    Return a named child logger.

    Parameters
    ----------
    name : str
        Conventionally pass __name__ from the calling module so the
        logger hierarchy mirrors the package structure.

    Returns
    -------
    logging.Logger
        A Logger instance whose records propagate up to the root logger
        (and therefore to both handlers configured in setup_logging).

    Example
    -------
    >>> from modules.logger_util import get_logger
    >>> logger = get_logger(__name__)
    >>> logger.info("File moved: %s", filepath)
    """
    if not _CONFIGURED:
        # Defensive: if a module calls get_logger before main.py calls
        # setup_logging, bootstrap silently so nothing crashes.
        setup_logging()

    return logging.getLogger(name)
