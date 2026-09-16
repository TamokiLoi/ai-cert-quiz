#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Convert data/claude/index{1,2,3}.html (exam-os study exports) into the
question JSON schema used by data.json (see tools/validate-data.js).

Usage: python tools/convert-claude-index.py
Writes data/claude/index1.json, index2.json, index3.json.
"""
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "data" / "claude"

FILES = [
    ("index1.html", "index1.json", "claude-index1", "Claude CCA-F Bổ sung 1"),
    ("index2.html", "index2.json", "claude-index2", "Claude CCA-F Bổ sung 2"),
    ("index3.html", "index3.json", "claude-index3", "Claude CCA-F Bổ sung 3"),
]


def clean_text(node):
    if node is None:
        return ""
    text = node.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def section_text(h4):
    """Collect text of all siblings after an <h4> until the next <h4>."""
    parts = []
    for sib in h4.next_siblings:
        name = getattr(sib, "name", None)
        if name == "h4":
            break
        if name is None:
            continue
        parts.append(clean_text(sib))
    return "\n".join(p for p in parts if p)


def parse_wrong_options(h4_vi_sao_sai):
    """Parse the '5. Vì sao các phương án khác sai?' <ul><li><strong>X. text:</strong> explain</li></ul>."""
    result = {}
    if h4_vi_sao_sai is None:
        return result
    ul = h4_vi_sao_sai.find_next_sibling("ul")
    if ul is None:
        return result
    for li in ul.find_all("li", recursive=False):
        strong = li.find("strong")
        if not strong:
            continue
        m = re.match(r"^\s*([A-D])\.", strong.get_text(strip=True))
        if not m:
            continue
        key = m.group(1)
        li_text = clean_text(li)
        strong_text = clean_text(strong)
        explain = li_text[len(strong_text):].strip(" : ")
        result[key] = explain
    return result


def parse_feedback(feedback_div):
    h4s = feedback_div.find_all("h4")
    sections = {}
    for h4 in h4s:
        title = clean_text(h4)
        sections[title] = h4

    context = ""
    why_correct = ""
    mnemonic = ""
    wrong_map = {}

    for title, h4 in sections.items():
        if title.startswith("1."):
            context = section_text(h4)
        elif title.startswith("4."):
            why_correct = section_text(h4)
        elif title.startswith("5."):
            wrong_map = parse_wrong_options(h4)
        elif title.startswith("6."):
            mnemonic = section_text(h4)

    return context, why_correct, wrong_map, mnemonic


def parse_file(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    questions = []
    forms = soup.select("form.exam-os-question-card")
    for form in forms:
        correct_labels = (form.get("data-correct-labels") or "").split()
        required_count = int(form.get("data-required-selection-count") or 1)
        feedback_id = form.get("data-study-feedback-id")

        content_div = form.select_one(".exam-os-question-content")
        question_text = "\n\n".join(
            clean_text(p) for p in content_div.find_all("p")
        ) if content_div else ""

        options = []
        for label in form.select(".exam-os-options label"):
            key = label.get("data-option-label")
            text_span = label.select_one(".exam-os-option-content")
            options.append({"key": key, "text": clean_text(text_span)})
        options.sort(key=lambda o: o["key"])

        q_type = "multiple" if required_count > 1 or len(correct_labels) > 1 else "single"
        correct = correct_labels if q_type == "multiple" else (correct_labels[0] if correct_labels else "")

        context = why_correct = mnemonic = ""
        wrong_map = {}
        if feedback_id:
            feedback_div = soup.find(id=feedback_id)
            if feedback_div:
                context, why_correct, wrong_map, mnemonic = parse_feedback(feedback_div)

        opt_exp = {}
        for opt in options:
            k = opt["key"]
            if k in correct_labels:
                opt_exp[k] = why_correct
            elif k in wrong_map:
                opt_exp[k] = wrong_map[k]

        q = {
            "id": len(questions) + 1,
            "question": question_text,
            "type": q_type,
            "options": options,
            "correct": correct,
            "explanation": why_correct,
            "optExp": opt_exp,
        }
        if context:
            q["context"] = context
        if mnemonic:
            q["mnemonic"] = mnemonic
        questions.append(q)

    return questions


def main():
    for src_name, out_name, exam_id, title in FILES:
        src_path = SRC_DIR / src_name
        if not src_path.exists():
            print(f"SKIP (not found): {src_path}")
            continue
        questions = parse_file(src_path)
        exam = {
            "id": exam_id,
            "track": "Claude",
            "title": title,
            "subtitle": "Claude CCA-F — chuyển đổi từ " + src_name + " (có giải thích chi tiết)",
            "source": src_name,
            "count": len(questions),
            "hasExplanation": True,
            "questions": questions,
        }
        out_path = SRC_DIR / out_name
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(exam, f, ensure_ascii=False, indent=2)
        print(f"{src_name}: {len(questions)} questions -> {out_path}")


if __name__ == "__main__":
    main()
