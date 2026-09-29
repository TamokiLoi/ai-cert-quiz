#!/usr/bin/env node
// Build verified per-question change records from data.json snapshots in Git.
// Usage: node tools/extract-question-release-notes.js <base-ref> <head-ref>
// Output is JSON on stdout; review it before merging into data.questionReleaseNotes.

const { execFileSync } = require('node:child_process');

const [baseRef, headRef] = process.argv.slice(2);
if (!baseRef || !headRef) {
  console.error('Usage: node tools/extract-question-release-notes.js <base-ref> <head-ref>');
  process.exit(2);
}

const maxBuffer = 64 * 1024 * 1024;
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer }).trimEnd();
}
function loadData(ref) {
  return JSON.parse(git(['show', `${ref}:data.json`]));
}
function questionMap(data) {
  const out = new Map();
  for (const exam of data.exams || []) {
    for (const question of exam.questions || []) {
      out.set(`${exam.id}#${question.id}`, { exam, question });
    }
  }
  return out;
}
function answerSnapshot(question) {
  const correct = Array.isArray(question.correct) ? question.correct : [question.correct];
  return {
    correct: question.correct,
    answers: correct.map((key) => ({
      key,
      text: (question.options || []).find((option) => option.key === key)?.text ?? null,
    })),
  };
}
function compactQuestion(question) {
  return {
    question: question.question ?? null,
    options: question.options ?? null,
    correct: answerSnapshot(question),
    explanation: question.explanation ?? null,
  };
}
function questionCode(id) {
  const raw = String(id);
  return /^\d+$/.test(raw) ? `Q${raw}` : raw;
}
function createRecord({ commit, exam, question, type, oldValue, newValue }) {
  return {
    id: `${commit.short}-${exam.id}-${question.id}-${type}`,
    examSetId: exam.id,
    examSetName: exam.title || null,
    questionId: question.id,
    questionCode: questionCode(question.id),
    changeType: type,
    date: commit.date || null,
    committedAt: commit.committedAt || null,
    version: commit.short ? `commit ${commit.short}` : null,
    reason: commit.subject || null,
    oldValue: oldValue === undefined ? null : oldValue,
    newValue: newValue === undefined ? null : newValue,
    sourceCommit: commit.short || null,
  };
}

const fieldTypes = [
  ['question', 'question_text'],
  ['options', 'options'],
  ['correct', 'answer_key'],
  ['explanation', 'explanation'],
  ['optExp', 'option_explanations'],
  ['context', 'context'],
  ['mnemonic', 'mnemonic'],
  ['disputed', 'dispute_metadata'],
  ['answerFixed', 'answer_metadata'],
];

const baseData = loadData(baseRef);
const commits = git([
  'log', '--reverse', '--format=%H%x09%h%x09%ad%x09%cI%x09%s', '--date=short', `${baseRef}..${headRef}`, '--', 'data.json',
]).split('\n').filter(Boolean).map((line) => {
  const [hash, short, date, committedAt, ...subjectParts] = line.split('\t');
  return { hash, short, date, committedAt, subject: subjectParts.join('\t') };
});

let previousData = baseData;
const records = [];
for (const commit of commits) {
  const currentData = loadData(commit.hash);
  const before = questionMap(previousData);
  const after = questionMap(currentData);

  for (const [key, current] of after) {
    const old = before.get(key);
    if (!old) {
      records.push(createRecord({
        commit,
        exam: current.exam,
        question: current.question,
        type: 'question_added',
        oldValue: null,
        newValue: compactQuestion(current.question),
      }));
      continue;
    }
    for (const [field, type] of fieldTypes) {
      const oldValue = old.question[field] === undefined ? null : old.question[field];
      const newValue = current.question[field] === undefined ? null : current.question[field];
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
      const oldSnapshot = field === 'correct' ? answerSnapshot(old.question) : oldValue;
      const newSnapshot = field === 'correct' ? answerSnapshot(current.question) : newValue;
      records.push(createRecord({
        commit,
        exam: current.exam,
        question: current.question,
        type,
        oldValue: oldSnapshot,
        newValue: newSnapshot,
      }));
    }
  }

  for (const [key, old] of before) {
    if (after.has(key)) continue;
    records.push(createRecord({
      commit,
      exam: old.exam,
      question: old.question,
      type: 'question_removed',
      oldValue: compactQuestion(old.question),
      newValue: null,
    }));
  }
  previousData = currentData;
}

const commitAt = (ref) => git(['rev-parse', '--short', ref]);
process.stdout.write(JSON.stringify({
  coverage: {
    fromCommit: commitAt(baseRef),
    throughCommit: commitAt(headRef),
    note: `Only data.json changes between ${baseRef} and ${headRef} are included. History before ${baseRef} is not inferred.`,
  },
  notes: records,
}, null, 2) + '\n');
