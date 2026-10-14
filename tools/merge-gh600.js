#!/usr/bin/env node
// Merge the normalized GH-600 bank into data.json.
// Usage: node tools/merge-gh600.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data.json');
const bankPath = path.join(root, 'data', 'gh600', 'questions.json');
const examId = 'gh600-fastshipper';

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
if (!Array.isArray(bank.questions) || bank.questions.length !== 87) {
  throw new Error(`Expected 87 normalized GH-600 questions, found ${bank.questions?.length ?? 'none'}.`);
}

const exam = {
  id: examId,
  track: 'GHC',
  certificationId: 'GH-600',
  title: 'GH-600 — 87 câu hỏi luyện tập',
  subtitle: 'fastestShipper/gh600-study · 42 chọn một, 19 chọn nhiều, 26 câu tương tác',
  source: 'fastestShipper/gh600-study @ 475a9a0',
  count: bank.questions.length,
  hasExplanation: true,
  questions: bank.questions,
};

data.exams = data.exams.filter(item => item.id !== examId);
const gh300Indexes = data.exams
  .map((item, index) => item.track === 'GHC' && (!item.certificationId || item.certificationId === 'GH-300') ? index : -1)
  .filter(index => index >= 0);
const insertAt = gh300Indexes.length ? gh300Indexes[gh300Indexes.length - 1] + 1 : data.exams.length;
data.exams.splice(insertAt, 0, exam);

const normQuestion = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
data.totalQuestions = data.exams.reduce((sum, item) => sum + item.questions.length, 0);
data.uniqueQuestions = new Set(data.exams.flatMap(item => item.questions.map(q => normQuestion(q.question)))).size;
data.generatedAt = new Date().toISOString();
fs.writeFileSync(dataPath, JSON.stringify(data), 'utf8');
console.log(`Inserted '${examId}' with ${exam.questions.length} questions.`);
console.log(`totalQuestions = ${data.totalQuestions}, uniqueQuestions = ${data.uniqueQuestions}`);
