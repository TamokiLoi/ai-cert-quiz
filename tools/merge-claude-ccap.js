#!/usr/bin/env node
// Merge data/claude/ccap/{1..5}.json into data.json as the Claude Pro / CCAP exam.
// Usage: node tools/merge-claude-ccap.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data.json');
const sourcePaths = [1, 2, 3, 4, 5].map((n) => path.join(root, 'data', 'claude', 'ccap', `${n}.json`));
const examId = 'claude-ccap';

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const claudeTrack = data.tracks.find((track) => track.id === 'Claude');
if (claudeTrack) claudeTrack.label = 'Claude';
const sourceQuestions = sourcePaths.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
if (sourceQuestions.length !== 64) {
  throw new Error(`Expected 64 CCAP questions, found ${sourceQuestions.length}`);
}

const questions = sourceQuestions.map((q) => {
  const correctKeys = q.result.map((answer) => answer.key);
  return {
    id: q.question_number,
    question: q.question,
    type: q.type === 'multi' ? 'multiple' : 'single',
    options: q.answer.map(({ key, text }) => ({ key, text })),
    correct: q.type === 'multi' ? correctKeys : correctKeys[0],
    explanation: q.note,
  };
});

const exam = {
  id: examId,
  track: 'Claude',
  certLevel: 'pro',
  title: 'Claude Pro (CCAP) — 64 câu',
  subtitle: 'Bộ luyện tập CCAP · có giải thích cho từng câu',
  source: 'data/claude/ccap/1.json–5.json',
  count: questions.length,
  hasExplanation: true,
  questions,
};

// Replace an earlier conversion if present, and place this exam next to the other Claude sets.
data.exams = data.exams.filter((item) => item.id !== examId);
const claudeIndex = data.exams.findIndex((item) => item.id === 'claude-index162');
data.exams.splice(claudeIndex < 0 ? 0 : claudeIndex + 1, 0, exam);

// Match the app's established canonical question-text normalization.
const normQuestion = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
data.totalQuestions = data.exams.reduce((sum, item) => sum + item.questions.length, 0);
data.uniqueQuestions = new Set(data.exams.flatMap((item) => item.questions.map((q) => normQuestion(q.question)))).size;
data.generatedAt = new Date().toISOString();

fs.writeFileSync(dataPath, JSON.stringify(data));
console.log(`Inserted '${examId}' with ${questions.length} questions.`);
console.log(`totalQuestions = ${data.totalQuestions}, uniqueQuestions = ${data.uniqueQuestions}`);
