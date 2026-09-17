#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fact-check claude-index162 (162 Claude Certified Architect / CCA-F
questions) against Gemini's knowledge, batched to keep call count low.

Read-only: writes a report for human review, does NOT touch data.json.
Usage: python tools/gemini_check_claude162.py [--key2|--key3] [--model NAME]
"""
import argparse
import json
import time

parser = argparse.ArgumentParser()
parser.add_argument("--key2", action="store_true")
parser.add_argument("--key3", action="store_true")
parser.add_argument("--key4", action="store_true", help="lakemanga.info@gmail.com")
parser.add_argument("--key5", action="store_true", help="tamokiloijp@gmail.com")
parser.add_argument("--key6", action="store_true", help="vothihon248@gmail.com")
parser.add_argument("--model", default="gemini-3.6-flash")
parser.add_argument("--batch-size", type=int, default=8)
args = parser.parse_args()

if args.key2:
    KEY_NAME = "GEMINI_API_KEY_OLD_LOINGUYENLAMTHANH"
elif args.key3:
    KEY_NAME = "GEMINI_API_KEY_LOINLT1991"
elif args.key4:
    KEY_NAME = "GEMINI_API_KEY_LAKEMANGA"
elif args.key5:
    KEY_NAME = "GEMINI_API_KEY_TAMOKILOIJP"
elif args.key6:
    KEY_NAME = "GEMINI_API_KEY_VOTHIHON"
else:
    KEY_NAME = "GEMINI_API_KEY"

with open("D:/Work/japanese-extension/_scratch/.env.gemini", encoding="utf-8") as f:
    api_key = None
    for line in f:
        if line.startswith(KEY_NAME + "="):
            api_key = line.strip().split("=", 1)[1]
assert api_key, f"key {KEY_NAME} not found"

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)
MODEL = args.model

WORKLIST_FILE = "D:/Work/ai-cert-quiz/tools/_claude162_worklist.json"
REPORT_FILE = "D:/Work/ai-cert-quiz/tools/_claude162_gemini_report.json"
PROGRESS_FILE = "D:/Work/ai-cert-quiz/tools/_claude162_gemini_progress.json"

with open(WORKLIST_FILE, encoding="utf-8") as f:
    worklist = json.load(f)

try:
    with open(PROGRESS_FILE, encoding="utf-8") as f:
        progress = json.load(f)
except FileNotFoundError:
    progress = {}


def qkey(item):
    return f"{item['examId']}#{item['id']}"


def fmt_question(item):
    lines = [f"[{qkey(item)}] ({item['type']}) {item['question']}"]
    correct = item['correct'] if isinstance(item['correct'], list) else [item['correct']]
    for o in item['options']:
        mark = " <-- hiện đang đánh dấu ĐÚNG" if o['key'] in correct else ""
        lines.append(f"  {o['key']}. {o['text']}{mark}")
    if item['explanation']:
        lines.append(f"  Giải thích hiện có: {item['explanation']}")
    return "\n".join(lines)


PROMPT_HEADER = """Bạn là chuyên gia chứng chỉ Claude Certified Architect - Foundations (CCA-F) của Anthropic,
nắm rõ Claude API (Messages API, tool use, prompt caching, extended thinking), agentic loop/architecture,
multi-agent/subagent orchestration, MCP (Model Context Protocol), và Claude Code.
Dưới đây là các câu hỏi tình huống (scenario-based), mỗi câu đã có đáp án hiện tại được đánh dấu "hiện đang đánh dấu ĐÚNG".
Nhiệm vụ: kiểm tra xem đáp án hiện tại có ĐÚNG theo tài liệu chính thức/hành vi thực tế của Claude API và các best practice
mà Anthropic công bố (docs.anthropic.com) không.

Trả lời DUY NHẤT bằng JSON array, mỗi phần tử có dạng:
{"key": "<examId>#<id>", "agree": true/false, "should_be": ["A","B"], "confidence": "high"/"medium"/"low", "reason": "giải thích ngắn gọn bằng tiếng Việt, có nêu cơ chế/tài liệu cụ thể nếu có"}

- "agree": true nếu đáp án hiện tại đúng, false nếu sai hoặc thiếu/thừa lựa chọn.
- "should_be": bộ đáp án bạn cho là đúng (dùng khi agree=false; nếu agree=true thì lặp lại đáp án hiện tại).
- Đây là câu hỏi tình huống dạng "cách nào TỐT NHẤT/hiệu quả nhất" nên có thể nhiều đáp án đều hợp lý ở mức độ nào đó —
  chỉ đánh agree=false khi bạn thực sự chắc chắn đáp án hiện tại sai hoặc có đáp án khác rõ ràng tốt hơn theo
  cơ chế kỹ thuật thực tế của Claude API/Anthropic, không đoán mò hay chỉ vì thấy "cũng hợp lý".
- Không thêm text nào ngoài JSON array.

Các câu hỏi:
"""

todo = [item for item in worklist if qkey(item) not in progress]
print(f"Total {len(worklist)}, already done {len(worklist) - len(todo)}, todo {len(todo)}", flush=True)

batches = [todo[i:i + args.batch_size] for i in range(0, len(todo), args.batch_size)]


def parse_json_array(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return json.loads(text)


def is_daily_quota_error(err):
    return "RESOURCE_EXHAUSTED" in err and "PerDay" in err


consecutive_quota_hits = 0
for bi, batch in enumerate(batches):
    prompt = PROMPT_HEADER + "\n\n".join(fmt_question(item) for item in batch)

    ok = False
    last_err = None
    hit_daily_quota = False
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            results = parse_json_array(response.text)
            got_keys = {r.get("key") for r in results}
            expected_keys = {qkey(item) for item in batch}
            missing = expected_keys - got_keys
            if missing:
                print(f"  batch {bi}: MISSING keys in response: {missing}", flush=True)
            for r in results:
                if r.get("key") in expected_keys:
                    progress[r["key"]] = r
            print(f"[batch {bi+1}/{len(batches)}] OK ({len(results)} results)", flush=True)
            ok = True
            break
        except Exception as e:
            last_err = str(e)
            if is_daily_quota_error(last_err):
                hit_daily_quota = True
                print(f"[batch {bi+1}/{len(batches)}] DAILY QUOTA HIT", flush=True)
                break
            print(f"[batch {bi+1}/{len(batches)}] attempt {attempt} FAILED: {e}", flush=True)
            time.sleep(15)

    if hit_daily_quota:
        consecutive_quota_hits += 1
        if consecutive_quota_hits >= 3:
            print("STOPPING: daily quota exhausted for this key.", flush=True)
            break
        continue
    consecutive_quota_hits = 0

    if not ok:
        print(f"  batch {bi}: gave up after retries: {last_err}", flush=True)

    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    time.sleep(4)

with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
    json.dump(progress, f, ensure_ascii=False, indent=2)

disagreements = [v for v in progress.values() if v.get("agree") is False]
with open(REPORT_FILE, "w", encoding="utf-8") as f:
    json.dump({
        "total_checked": len(progress),
        "total_worklist": len(worklist),
        "disagreements": disagreements,
    }, f, ensure_ascii=False, indent=2)

print(f"DONE. checked {len(progress)}/{len(worklist)}, disagreements flagged: {len(disagreements)}", flush=True)
print(f"Report: {REPORT_FILE}", flush=True)
