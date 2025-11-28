import sys
from pathlib import Path

# Ensure project root is on sys.path so 'utils' package is importable when running pytest.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.input_parser import extract_app_and_url, normalize_url, generate_url_from_app_name


def test_with_url_and_app_name():
    task = "Create a new board in Trello at https://trello.com/myboards"
    app, url = extract_app_and_url(task)
    assert url == "https://trello.com/myboards"
    assert app.lower() == "trello"


def test_with_only_url():
    task = "Open https://example.com and take a screenshot"
    app, url = extract_app_and_url(task)
    assert url == "https://example.com"
    assert app == "Example"


def test_with_no_url_but_app():
    task = "Sign up for Slack workspace"
    app, url = extract_app_and_url(task)
    assert app.lower() == "slack"
    assert url is None


def test_empty():
    app, url = extract_app_and_url("")
    assert app is None and url is None


def test_normalize_url_with_protocol():
    assert normalize_url("https://example.com") == "https://example.com"
    assert normalize_url("http://example.com") == "http://example.com"


def test_normalize_url_without_protocol():
    assert normalize_url("example.com") == "https://example.com"
    assert normalize_url("notion.com") == "https://notion.com"


def test_generate_url_from_app_name():
    assert generate_url_from_app_name("Notion") == "https://app.notion.so"
    assert generate_url_from_app_name("Trello") == "https://trello.com"
    assert generate_url_from_app_name("Slack") == "https://app.slack.com"
    assert generate_url_from_app_name("Linear") == "https://linear.app"


def test_generate_url_from_multi_word_app():
    assert generate_url_from_app_name("Google Drive") == "https://drive.google.com"
    assert generate_url_from_app_name("Google Docs") == "https://docs.google.com"
    assert generate_url_from_app_name("Google Calendar") == "https://calendar.google.com"


def test_extract_app_from_complex_sentence():
    """Test extraction from complex sentences with prepositions."""
    task = "How to apply filter for database in notion."
    app, url = extract_app_and_url(task)
    assert app.lower() == "notion"
    assert url is None


def test_extract_app_case_insensitive():
    """Test that known apps are found case-insensitively."""
    task = "How do I create a project in JIRA?"
    app, url = extract_app_and_url(task)
    assert app.lower() == "jira"
    assert url is None


def test_extract_multi_word_app():
    """Test extraction of multi-word app names."""
    task = "Steps to organize files on Google Drive"
    app, url = extract_app_and_url(task)
    assert app.lower() == "google drive"
    assert url is None


