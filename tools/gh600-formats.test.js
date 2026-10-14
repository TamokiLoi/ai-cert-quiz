'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const exam = data.exams.find(item => item.id === 'gh600-fastshipper');
const html = fs.readFileSync(path.join(root, 'ai-cert-quiz.html'), 'utf8');
const helpersStart = html.indexOf('function isChoiceQuestion(q)');
const helpersEnd = html.indexOf('function updateSpecialResponse(q)', helpersStart);
if (helpersStart < 0 || helpersEnd < 0) throw new Error('Could not locate pure question response helpers in ai-cert-quiz.html');
const helperSource = html.slice(helpersStart, helpersEnd) + `
globalThis.questionHelpers = { responseReady, responseIsCorrect, responsePartial, normalizedBlank, formatAnswer, formatCorrectAnswer };
`;
const context = { setEq: (a, b) => a.length === b.length && a.every(value => b.includes(value)) };
vm.runInNewContext(helperSource, context);
const helpers = context.questionHelpers;

test('GH-600 imports all 87 items and each previously unsupported interaction type', () => {
  assert.ok(exam);
  const counts = exam.questions.reduce((out, question) => {
    out[question.type] = (out[question.type] || 0) + 1;
    return out;
  }, {});
  assert.deepEqual(counts, { single: 42, multiple: 19, ordering: 5, fill_blank: 12, matching: 9 });
});

test('ordering answers must include every item and match the exact sequence', () => {
  const q = exam.questions.find(question => question.type === 'ordering');
  assert.equal(helpers.responseReady(q, q.correctOrder), true);
  assert.equal(helpers.responseIsCorrect(q, q.correctOrder), true);
  const reversed = q.correctOrder.slice().reverse();
  assert.equal(helpers.responseIsCorrect(q, reversed), false);
  assert.equal(helpers.responsePartial(q, reversed), reversed.some((key, i) => q.correctOrder[i] === key));
});

test('fill-in answers trim and normalize Unicode while preserving case-sensitive values', () => {
  const q = exam.questions.find(question => question.type === 'fill_blank' && question.correct[0] === 'HTML');
  assert.equal(helpers.responseReady(q, [' HTML  ']), true);
  assert.equal(helpers.responseIsCorrect(q, [' HTML  ']), true);
  assert.equal(helpers.responseIsCorrect(q, ['html']), false);
  assert.equal(helpers.normalizedBlank('  Cafe\u0301  '), 'Café');
});

test('matching answers require a one-to-one mapping and grade against the answer key', () => {
  const q = exam.questions.find(question => question.type === 'matching');
  const correct = q.correctPairs.map(pair => `${pair.left}:${pair.right}`);
  assert.equal(helpers.responseReady(q, correct), true);
  assert.equal(helpers.responseIsCorrect(q, correct), true);
  const duplicateLeft = correct.slice();
  duplicateLeft[1] = `${q.leftItems[0].key}:${q.options[1].key}`;
  assert.equal(helpers.responseReady(q, duplicateLeft), false);
  const wrong = correct.slice();
  wrong[0] = `${q.correctPairs[0].left}:${q.correctPairs[1].right}`;
  wrong[1] = `${q.correctPairs[1].left}:${q.correctPairs[0].right}`;
  assert.equal(helpers.responseIsCorrect(q, wrong), false);
  assert.match(helpers.formatCorrectAnswer(q), / → /);
});
