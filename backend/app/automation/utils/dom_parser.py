"""DOM parsing helpers.

This module uses BeautifulSoup to convert a raw HTML string into a
more manageable summary. By extracting button labels, input field
identifiers and visible text, we give the LLM a concise view of the
current UI without overwhelming it with markup.
"""

from __future__ import annotations

from bs4 import BeautifulSoup
from typing import Dict, List


def parse_dom(dom_html: str) -> Dict[str, List[str] | str]:
    """Parse the DOM and return a summary of key elements.

    Args:
        dom_html: The page's raw HTML.

    Returns:
        A dictionary containing lists of button texts, input field
        identifiers and a snippet of the full text content.
    """
    soup = BeautifulSoup(dom_html, "html.parser")

    # Gather clickable elements by their visible text. We include
    # <button> tags and anchors (<a>) but skip links with no text.
    button_texts: List[str] = []
    for tag in soup.find_all(["button", "a"]):
        text = tag.get_text(strip=True)
        if text:
            button_texts.append(text[:50])  # truncate long labels

    # Gather names of form fields. This looks at placeholders, aria
    # labels or name attributes. Only include short strings.
    input_labels: List[str] = []
    for inp in soup.find_all(["input", "textarea"]):
        label = inp.get("placeholder") or inp.get("aria-label") or inp.get("name")
        if label:
            input_labels.append(label[:50])

    # Extract a snippet of the visible text on the page. This helps the
    # LLM understand what content is currently displayed. We limit it to
    # avoid excessive prompt length.
    raw_text = soup.get_text(" ", strip=True)[:1200]

    # Deduplicate lists while preserving order.
    deduped_buttons = list(dict.fromkeys(button_texts))
    deduped_inputs = list(dict.fromkeys(input_labels))

    return {
        "buttons": deduped_buttons,
        "inputs": deduped_inputs,
        "raw_text": raw_text,
    }