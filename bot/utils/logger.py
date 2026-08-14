"""Structured logging for AHOY.

Technical logs go to stdout / ahoy.log. User-facing messages never contain
stack traces or internal identifiers.
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler


def setup_logging(level: str = "INFO") -> logging.Logger:
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(getattr(logging, level, logging.INFO))
    root.handlers.clear()

    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(formatter)
    root.addHandler(stream)

    try:
        file_handler = RotatingFileHandler(
            "ahoy.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
    except OSError:  # read-only filesystem - stdout only
        pass

    logging.getLogger("discord").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    return logging.getLogger("ahoy")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"ahoy.{name}")
