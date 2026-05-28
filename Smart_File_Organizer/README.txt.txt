SMART FILE ORGANIZER & AUTOMATION TOOL

DESCRIPTION:
A professional Python-based automation utility designed to streamline file management, enhance organization, and perform system maintenance.

FEATURES:
- Automatic Organization: Files are sorted into categories (Images, Documents, Videos, etc.) based on extensions.
- Duplicate Detection: Uses SHA-256 hashing to identify and manage duplicate files.
- Smart Cleaner: Removes temporary files and empty directories with safety checks.
- Robust Logging: Maintains a detailed audit trail of all operations via the logging module.

PROJECT STRUCTURE:
- main.py: CLI Interface
- config.py: Configuration settings
- modules/: Core logic modules (organizer.py, cleaner.py, duplicate_checker.py, logger_util.py)
- logs/: Operation history

USAGE:
1. Ensure Python is installed.
2. Navigate to the project root directory.
3. Run the application: python main.py
4. Follow the interactive menu to select your desired automation task.