"""Text that is safe to store and render: no emoji, invisible characters
or typographic punctuation; words in any language kept; URLs untouched."""
import pytest

from tools.text_sanitize import sanitize_data, sanitize_text


@pytest.mark.parametrize("raw, clean", [
    ("Beginner\u2019s Guide \u2014 Claude\u00a0AI \u2728\U0001F680 done", "Beginner's Guide - Claude AI done"),
    ("a\u200bb\ufeffc \u202eevil", "abc evil"),                       # zero-width, BOM, bidi override
    ("\u201cquoted\u201d \u2026 \u2022 item \u2192 next", '"quoted" ... - item -> next'),
    ("flag \U0001F1EE\U0001F1F3 keycap 1\ufe0f\u20e3 end", "flag keycap 1 end"),
    ("null\x00byte and\x07bell", "nullbyte andbell"),
    ("C++ & C# <tag> a_b 50% $5 x <= y", "C++ & C# <tag> a_b 50% $5 x <= y"),  # ordinary ASCII is untouched
    ("", ""),
])
def test_unsafe_characters_are_replaced_or_removed(raw, clean):
    assert sanitize_text(raw) == clean


def test_letters_of_any_language_are_kept():
    assert sanitize_text("Caf\u00e9 r\u00e9sum\u00e9 \u65e5\u672c\u8a9e") == "Caf\u00e9 r\u00e9sum\u00e9 \u65e5\u672c\u8a9e"


def test_markdown_line_structure_survives():
    text = "## Overview\n\n\n\nLine  two\t here \n- **Bold**: x\r\nnext"
    assert sanitize_text(text) == "## Overview\n\nLine two here\n- **Bold**: x\nnext"


def test_nested_data_is_sanitized_except_urls():
    data = {"title": "A \u2014 B \U0001F525", "url": "https://x.example/a\u2014b", "n": 3,
            "items": [{"snippet": "it\u2019s", "link": "https://y.example/\u2019"}]}

    assert sanitize_data(data) == {"title": "A - B", "url": "https://x.example/a\u2014b", "n": 3,
                                   "items": [{"snippet": "it's", "link": "https://y.example/\u2019"}]}
