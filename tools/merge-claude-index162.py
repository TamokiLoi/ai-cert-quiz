#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Merge data/claude/index{1,2,3}.json (162 questions total) into data.json
as a single new exam, inserted at the front of the Claude track's exam list
(and of DATA.exams overall) so it shows first in the app's exam picker.

Usage: python tools/merge-claude-index162.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data.json"
SRC_FILES = ["index1.json", "index2.json", "index3.json"]

NEW_EXAM_ID = "claude-index162"


def norm_q(s):
    s = str(s).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    merged_questions = []
    for name in SRC_FILES:
        with open(ROOT / "data" / "claude" / name, "r", encoding="utf-8") as f:
            exam = json.load(f)
        for q in exam["questions"]:
            q = dict(q)
            q["id"] = len(merged_questions) + 1
            merged_questions.append(q)

    new_exam = {
        "id": NEW_EXAM_ID,
        "track": "Claude",
        "title": "🆕 Claude — 162 câu mới nhất",
        "subtitle": "Gộp từ index1+2+3.html — giải thích tiếng Việt chi tiết từng đáp án",
        "source": "index1.html + index2.html + index3.html",
        "count": len(merged_questions),
        "hasExplanation": True,
        "questions": merged_questions,
    }

    # Guard against re-running: replace if already present instead of duplicating.
    data["exams"] = [e for e in data["exams"] if e.get("id") != NEW_EXAM_ID]
    data["exams"].insert(0, new_exam)

    total = sum(len(e["questions"]) for e in data["exams"])
    seen = set()
    unique = 0
    for e in data["exams"]:
        for q in e["questions"]:
            k = norm_q(q["question"])
            if k not in seen:
                seen.add(k)
                unique += 1

    data["totalQuestions"] = total
    data["uniqueQuestions"] = unique

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Inserted exam '{NEW_EXAM_ID}' with {len(merged_questions)} questions at top of exams list.")
    print(f"totalQuestions = {total}, uniqueQuestions = {unique}")


if __name__ == "__main__":
    main()
