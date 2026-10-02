"""
Make generated and scraped text safe to store and render everywhere.

Search snippets and model output carry characters that break things
downstream: emoji and pictographs (4-byte UTF-8, which older MySQL
`utf8` columns reject and some fonts can't draw), invisible format
characters (zero-width spaces, byte-order marks, bidi overrides),
non-breaking spaces that defeat word-wrap and string matching, control
characters that are invalid in JSON/XML, and "smart" punctuation that
shows up as mojibake when an encoding is guessed wrong.

`sanitize_text` keeps the words and removes the hazards:
  - typographic punctuation -> its ASCII equivalent (’ -> ', — -> -, … -> ...)
  - every kind of space -> a plain space; runs of spaces collapsed
  - emoji, pictographs, dingbats, arrows/box/math symbols, private-use and
    unassigned code points, control and invisible format characters -> removed
  - letters and digits of any language are kept (a resource's real title
    may not be English), in NFC form

URLs are never touched: `sanitize_data` skips URL-valued keys, since
changing a character in a link changes where it points.
"""
import re
import unicodedata
from typing import Any

_REPLACEMENTS = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"', "«": '"', "»": '"',
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
    "…": "...",
    "•": "-", "·": "-", "‣": "-", "◦": "-", "⁃": "-",
    "→": "->", "⇒": "=>", "←": "<-", "↔": "<->",
    "×": "x", "≤": "<=", "≥": ">=", "≠": "!=",
    "™": "(TM)", "®": "(R)", "©": "(C)",
}
_TRANSLATION = str.maketrans(_REPLACEMENTS)
# Unicode categories removed outright: control (except \n and \t), format
# (zero-width, BOM, bidi), surrogates, private use, unassigned, and the
# symbol classes that hold emoji, pictographs, dingbats and box drawing
_DROP_CATEGORIES = {"Cc", "Cf", "Cs", "Co", "Cn", "So", "Sk", "Me"}  # Me: enclosing marks (keycap emoji)
_KEEP_CONTROLS = {"\n", "\t"}
_SPACES = re.compile(r"[^\S\n]+")  # any run of whitespace except newlines
_BLANK_LINES = re.compile(r"\n{3,}")
_SPACE_AROUND_NEWLINE = re.compile(r" *\n *")

URL_KEYS = frozenset({"url", "link", "website", "infoLink"})


def sanitize_text(text: str) -> str:
    """`text` with unsafe characters replaced or removed (see module
    docstring). Line breaks are kept, so Markdown survives."""
    if not text:
        return text
    text = unicodedata.normalize("NFC", text).translate(_TRANSLATION)
    kept = []
    for char in text:
        if char in _KEEP_CONTROLS or char == " ":
            kept.append(char)
            continue
        category = unicodedata.category(char)
        if category == "Zs" or char in "\r\x0b\x0c  \x85":
            kept.append("\n" if char in "  \x85" else " ")
        elif category in _DROP_CATEGORIES:
            continue
        elif category == "Sm" and ord(char) > 127:
            continue  # non-ASCII math/arrow symbols not mapped above
        elif category == "Mn" and ord(char) in (0xFE0E, 0xFE0F):
            continue  # emoji variation selectors
        else:
            kept.append(char)
    text = _SPACES.sub(" ", "".join(kept))
    text = _SPACE_AROUND_NEWLINE.sub("\n", text)
    return _BLANK_LINES.sub("\n\n", text).strip()


def sanitize_data(value: Any, _key: str | None = None) -> Any:
    """`value` with every string inside it sanitized, recursively through
    dicts and lists. Strings under a URL key are returned unchanged."""
    if isinstance(value, str):
        return value if _key in URL_KEYS else sanitize_text(value)
    if isinstance(value, dict):
        return {key: sanitize_data(item, key) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_data(item, _key) for item in value]
    return value
