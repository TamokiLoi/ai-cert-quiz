# AI Cert Quiz v1.0.1 — Question Release Notes

This retrospective list covers question-data changes verifiable in `data.json` from `cd893b4` through `9ec8a2f`. Earlier question history is unavailable in the tracked data and is not inferred. Commit references below identify the source records.

## Claude — 162-question set (`claude-index162`)

- Added Q1–Q162 (`0ca27b5`, 2026-09-16).
- Answer keys: Q44 B→A and Q49 A→C (`cffdf4b`, 2026-09-17); Q57 D→C and Q74 C→D (`63ef123`, 2026-09-25).
- Explanations and per-option explanations updated for Q44, Q49, Q57, and Q74; context/mnemonic fields also changed for those questions (`cffdf4b`, `63ef123`).

## Claude — CCA-F Practice Quiz 1 (`claude-foundations-1`)

- Q39 answer key C→A; explanation and per-option explanations updated (`63ef123`, 2026-09-25).

## Claude — CCA-F Interactive Quiz (`claude-interactive`)

- Q43 answer key C→D; explanation and per-option explanations updated. Q65 explanation and per-option explanations updated (`63ef123`, 2026-09-25).

## GitHub Copilot — GH-300 Exam 1 (`ghc-exam1`)

- Q12 C→B; Q103 A/B/D→A/D/E (`49d0944`, 2026-09-17).
- Q115 changed A/D/E→A/B/D (`6de9b1f`), then A/B/D→A/D/E (`49d0944`); the second commit states it reverses the earlier fix.
- Explanations and per-option explanations updated for Q12, Q103, and Q115 (`49d0944`).

## GitHub Copilot — GH-300 Practice 02 (`ghc-practice02`)

- Q29 changed A/C/D→A/B/D (`6de9b1f`), then A/B/D→A/C/D (`49d0944`).
- Explanation and per-option explanations updated (`49d0944`, 2026-09-17).

## GitHub Copilot — GH-300 Exam 2 (`ghc-exam2`)

- Q54 wording corrected by removing “(Choose 2)” from a single-answer question (`62a1dcc`, 2026-09-14).

## GitHub Copilot — GH-300-New-Microsoft (`ghc-new-microsoft`)

- Restored Vietnamese diacritics in explanations for Q1–Q60 (`a86f7cf`, 2026-08-25).
