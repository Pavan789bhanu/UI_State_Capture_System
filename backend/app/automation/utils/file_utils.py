"""File related helper functions.

This module provides small helpers for encoding images and dumping
JSON files. Keeping these in a separate module keeps other parts of
the code clean and free from boilerplate.
"""

from __future__ import annotations

import base64
import json
from typing import Any

def encode_image(image_path: str) -> str:
    """Return the base64 encoding of an image.

    Args:
        image_path: Path to the image to encode.

    Returns:
        A base64 encoded string.
    """
    with open(image_path, "rb") as image_file:
        data = image_file.read()
        return base64.b64encode(data).decode("utf-8")


def save_json(data: Any, filepath: str) -> None:
    """Write a Python object to a JSON file.

    Args:
        data: The data to serialize. Must be JSON serializable.
        filepath: The file on disk to write.
    """
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)