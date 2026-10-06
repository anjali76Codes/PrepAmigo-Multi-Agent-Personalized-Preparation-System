"""Study material (agents/study_material.py) and the assessment / flashcard
agents built on it: one validated model call per 3-4 day chunk."""
import asyncio
import json
from datetime import date

from langchain_core.messages import AIMessage

import agents.study_material as study
from agents.assessment_agent import AssessmentAgent
from agents.flashcard_agent import FlashcardAgent
from agents.planner_agent import PlannerAgent
from test_planner_agent import GAPS, MODULES, ChunkLLM

GOOD_QUESTION = {"question": "What does a hash map trade for O(1) lookups?",
                 "options": ["Memory", "Ordering", "Both", "Neither"], "answer": "C",
                 "explanation": "It uses extra memory and gives up key order.", "difficulty": "Medium",
                 "concept": "Hash maps"}
GOOD_CARD = {"front": "Load factor", "back": "Entries divided by buckets.", "difficulty": "easy",
             "concept": "Hash maps", "tags": ["hashing"]}


def material(n_questions=8, n_cards=6, extra_questions=(), extra_cards=()):
    questions = [{**GOOD_QUESTION, "question": f"{GOOD_QUESTION['question']} ({i})"} for i in range(n_questions)]
    cards = [{**GOOD_CARD, "front": f"{GOOD_CARD['front']} {i}"} for i in range(n_cards)]
    return json.dumps({"questions": [*questions, *extra_questions], "cards": [*cards, *extra_cards]})


class ScriptedLLM:
    """Answers each call with the next scripted reply (an exception raises)."""

    def __init__(self, *replies):
        self.replies, self.prompts = list(replies), []

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        return AIMessage(content=reply)


def days(n, start=1):
    return [{"day_number": start + i, "topic_title": f"Hashing day {start + i}",
             "topic_description": "Hash tables and their trade-offs.", "objectives": [f"Explain idea {i}"],
             "references": [{"title": "Hash tables guide", "url": "https://x.example"}],
             "concepts": ["Hash maps", "Collisions"]} for i in range(n)]


def run(coro):
    return asyncio.run(coro)


# ---- chunking ---------------------------------------------------------------

def test_any_sprint_length_is_cut_into_chunks_of_3_to_4_days():
    """[0:3] and [3:7] dropped days 8+ and made nothing for a 2-day sprint."""
    sizes = lambda n: [len(c) for c in study.chunk_days(days(n))]  # noqa: E731
    assert sizes(7) == [4, 3] and sizes(6) == [3, 3] and sizes(10) == [4, 3, 3]
    assert sizes(2) == [2] and sizes(1) == [1] and sizes(0) == []


# ---- validation -----------------------------------------------------------

def test_answers_are_normalised_to_the_letter_the_quiz_grades_against():
    by_text = {**GOOD_QUESTION, "answer": "Both"}  # the model gave the option text
    lettered = {**GOOD_QUESTION, "question": "Which is a collision strategy?",
                "options": ["A) Chaining", "B) Sorting", "C) Paging", "D) Caching"], "answer": "a"}
    questions, _ = study._validated({"questions": [by_text, lettered], "cards": []})
    assert [q.answer for q in questions] == ["C", "A"]
    assert questions[1].options[0] == "Chaining"  # the quiz shows its own letters
    assert questions[0].difficulty == "medium"


def test_invalid_items_are_dropped_not_the_whole_chunk():
    bad = [{**GOOD_QUESTION, "options": ["a", "b", "c"]},                  # 3 options
           {**GOOD_QUESTION, "options": ["a", "a", "b", "c"]},             # repeated option
           {**GOOD_QUESTION, "answer": "E"},                               # no such option
           {**GOOD_QUESTION, "explanation": ""},                           # no explanation
           GOOD_QUESTION, GOOD_QUESTION]                                   # a duplicate
    questions, cards = study._validated({"questions": bad, "cards": [GOOD_CARD, {"front": "", "back": "x"}]})
    assert len(questions) == 1 and len(cards) == 1


def test_a_trailing_comma_is_repaired_without_touching_text():
    reply = r'{"questions": [], "cards": [{"front": "List [1,2,]", "back": "say \"a,}\" ok",},],}'
    card = study._parse(reply)["cards"][0]
    assert card["front"] == "List [1,2,]" and card["back"] == 'say "a,}" ok'


# ---- generation -----------------------------------------------------------

def test_one_call_per_chunk_returns_both_questions_and_cards():
    llm = ScriptedLLM(material())
    chunks = run(study.generate_for_sprint(days(7), llm=llm))

    assert [c.day_numbers for c in chunks] == [[1, 2, 3, 4], [5, 6, 7]]
    assert all(c.status == "ok" and len(c.questions) == 8 and len(c.cards) == 6 for c in chunks)
    assert len(llm.prompts) == 2


def test_the_prompt_is_grounded_in_the_days_and_the_users_knowledge():
    llm = ScriptedLLM(material())
    run(study.generate_for_sprint(days(3), {"weak": ["Collisions"], "mastered": ["Arrays"]}, llm=llm))
    prompt = llm.prompts[0]
    assert "Hash tables and their trade-offs." in prompt and "Hash tables guide" in prompt
    assert '"Hash maps", "Collisions"' in prompt
    assert 'weak in: ["Collisions"]' in prompt and 'mastered: ["Arrays"]' in prompt


def test_an_unusable_answer_is_retried_once_with_a_corrective_instruction(monkeypatch):
    forgotten = []
    monkeypatch.setattr(study, "forget_response", lambda response: forgotten.append(response))
    llm = ScriptedLLM("Here are your questions!", material())

    [chunk] = run(study.generate_for_sprint(days(3), llm=llm))

    assert chunk.status == "ok" and len(llm.prompts) == 2
    assert "previous answer was not usable" in llm.prompts[1]
    assert forgotten  # the bad answer is not replayed from the cache


def test_a_partial_answer_survives_a_failed_retry():
    llm = ScriptedLLM(material(n_questions=2, n_cards=1), RuntimeError("model down"))
    [chunk] = run(study.generate_for_sprint(days(3), llm=llm))
    assert chunk.status == "partial" and len(chunk.questions) == 2 and len(chunk.cards) == 1


def test_a_chunk_that_never_works_reports_failed_instead_of_an_empty_list():
    [chunk] = run(study.generate_for_sprint(days(3), llm=ScriptedLLM(RuntimeError("model down"))))
    assert chunk.status == "failed" and chunk.error == "model down"


def test_a_queued_chunk_does_not_time_out_while_it_waits_for_a_slot(monkeypatch):
    """28 calls at once on a one-at-a-time Ollama timed out in the queue."""
    import dataclasses

    monkeypatch.setattr(study, "settings", dataclasses.replace(study.settings, llm_max_concurrency=1,
                                                               llm_provider="ollama", planner_llm="default"))
    monkeypatch.setattr(study, "CALL_TIMEOUT_SECONDS", 0.15)

    class SlowLLM(ScriptedLLM):
        async def ainvoke(self, prompt, config=None):
            await asyncio.sleep(0.1)  # each call fits its timeout; three in a row do not
            return await super().ainvoke(prompt, config)

    chunks = run(study.generate_for_sprint(days(10), llm=SlowLLM(material())))
    assert [c.status for c in chunks] == ["ok", "ok", "ok"]


# ---- the plan-level agents ----------------------------------------------------

def _plan(total_days=45):
    return run(PlannerAgent(llm=ChunkLLM()).build_plan(
        MODULES, GAPS, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=total_days))


def test_every_sprint_chunk_gets_lettered_questions_and_concept_tagged_cards():
    plan = _plan()
    chunks = sum(len(study.chunk_days(s["sprint_days"])) for s in plan["nested_plan"]["sprints"])

    quiz_llm, card_llm = ScriptedLLM(material()), ScriptedLLM(material())
    assessment = run(AssessmentAgent(llm=quiz_llm).generate_assessment(plan))
    flashcards = run(FlashcardAgent(llm=card_llm).generate_flashcards(plan))

    assert len(quiz_llm.prompts) == len(card_llm.prompts) == chunks == 14
    assert len(assessment["questions"]) == 8 * chunks and len(flashcards["cards"]) == 6 * chunks
    assert {q["correct_answer"] for q in assessment["questions"]} <= set("ABCD")
    assert all(q["concept"] == "Hash maps" for q in assessment["questions"])


def test_plan_days_carry_their_topics_key_concepts():
    plan = _plan(10)
    claude_day = next(d for d in plan["sprint_days"] if d["topic_title"].startswith("Claude"))
    assert claude_day["concepts"][:2] == ["Prompt Engineering", "Tool Use"]
