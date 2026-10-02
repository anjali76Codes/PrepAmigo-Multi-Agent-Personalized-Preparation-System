import pytest

from tools.relevance import canonical_url, relevance, title_key, topic_terms, youtube_video_id

# real off-topic results from a reviewed plan, and real on-topic ones
OFF_TOPIC = [
    ("Pre-Sales Engineering", "GUIDE (Guiding an Improved Dementia Experience) Model"),
    ("Pre-Sales Engineering", "Voting Assistance Guide"),
    ("Pre-Sales Engineering", "APR Design Guide Overview"),
    ("Pre-Sales Engineering", "Documentation | Apache Airflow"),
    ("Claude", "Book"),
    ("Claude", "Google Books: Find, Preview, and Read Books Online."),
    ("Claude", "Apple Books - App Store"),
]
ON_TOPIC = [
    ("Pre-Sales Engineering", "The Ultimate Presales Reading List for 2026"),
    ("Pre-Sales Engineering", "Pre-sales Engineering: Everything You Need to Know"),
    ("Pre-Sales Engineering", "SALES ENGINEER EXPLAINS: What is PRESALES?"),
    ("Claude", "The Claude Code Handbook: A Professional Introduction"),
    ("Enterprise Integration", "What are Enterprise Integration Patterns?"),
]


@pytest.mark.parametrize(("topic", "title"), OFF_TOPIC)
def test_off_topic_results_score_below_the_default_threshold(topic, title):
    assert relevance(topic, title) < 0.5


@pytest.mark.parametrize(("topic", "title"), ON_TOPIC)
def test_on_topic_results_pass(topic, title):
    assert relevance(topic, title) >= 0.5


def test_snippet_counts_toward_relevance():
    assert relevance("Dynamic Programming", "CLRS", "Algorithms text with a dynamic programming chapter") == 1.0


def test_short_terms_only_match_whole_words():
    assert relevance("AI", "Maintaining a garden") == 0  # no "ai" inside "maintaining"
    assert relevance("AI", "AI agents explained") == 1


def test_topic_terms_join_hyphenated_compounds_and_skip_stopwords():
    assert topic_terms("Pre-Sales Engineering for the Enterprise") == ["presales", "engineering", "enterprise"]


@pytest.mark.parametrize("url", [
    "https://www.youtube.com/watch?v=r2vYObllqJU",
    "https://www.youtube.com/watch?v=r2vYObllqJU&vl=en",
    "https://youtu.be/r2vYObllqJU",
    "https://m.youtube.com/watch?v=r2vYObllqJU&t=42s",
])
def test_one_video_one_key(url):
    assert canonical_url(url) == "youtube:r2vYObllqJU"
    assert youtube_video_id(url) == "r2vYObllqJU"


def test_tracking_parameters_fragments_and_trailing_slashes_are_ignored():
    assert canonical_url("https://www.example.com/docs/?utm_source=x#intro") == canonical_url("https://example.com/docs")


def test_meaningful_query_parameters_are_kept():
    a = canonical_url("https://www.ibm.com/docs/en/app-connect?topic=flows")
    b = canonical_url("https://www.ibm.com/docs/en/app-connect?topic=install")
    assert a != b


def test_title_key_ignores_case_and_punctuation():
    assert title_key("Claude AI Tutorial for Beginners (Step-by-Step)") == title_key("claude ai tutorial for beginners: step by step")
