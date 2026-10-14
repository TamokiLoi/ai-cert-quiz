#!/usr/bin/env node
// Convert GH-600 question formats supported by the app from the upstream snapshot.
// Usage: node tools/import-gh600.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'data', 'gh600', 'source.json');
const extrasPath = path.join(root, 'data', 'gh600', 'extra-questions.json');
const outputPath = path.join(root, 'data', 'gh600', 'questions.json');
const SOURCE_COMMIT = '475a9a0a67a4fa197150a2014b4d5f96df2b2c45';
const supportedTypes = new Set(['multiple_choice', 'multi_select', 'drag_drop_order', 'fill_blank', 'match_pairs']);

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const extras = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
if (!Array.isArray(extras)) throw new Error('Expected extra-questions.json to contain an array.');

const flat = [];
let sourceCounter = 0;
let excludedByType = {};
const domainById = new Map();
for (const domain of source.domains || []) {
  domainById.set(domain.domain_id, domain);
  for (const objective of domain.objectives || []) {
    for (const question of objective.questions || []) {
      sourceCounter += 1;
      if (question.type === 'case_study') {
        for (const [index, subQuestion] of (question.sub_questions || []).entries()) {
          sourceCounter += 1;
          flat.push({
            question: subQuestion,
            domain,
            objective,
            sourceId: `d${domain.domain_id}-${objective.id}-${sourceCounter}-sub${index}`,
            stemPrefix: `[Case study context] ${question.stem}\n\n`,
          });
        }
      } else {
        flat.push({
          question,
          domain,
          objective,
          sourceId: `d${domain.domain_id}-${objective.id}-${sourceCounter}`,
          stemPrefix: '',
        });
      }
    }
  }
}

function splitOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    const value = String(option);
    const match = value.match(/^([A-Z])\.\s*([\s\S]*)$/);
    return match
      ? { key: match[1], text: match[2].trim() }
      : { key: String.fromCharCode(65 + index), text: value.trim() };
  });
}

function splitCorrect(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '').split(',').map(part => part.trim()).filter(Boolean);
}

function orderedItems(question, sourceId) {
  if (!Array.isArray(question.options) || !question.options.length) {
    throw new Error(`Ordering question has no options: ${sourceId}`);
  }
  const keys = question.options.map((_, index) => `I${index + 1}`);
  const answerTexts = String(question.correct || '').split(' -> ').map(part => part.trim());
  if (answerTexts.length !== question.options.length) {
    throw new Error(`Ordering answer length does not match options: ${sourceId}`);
  }
  const keyByText = new Map(question.options.map((text, index) => [String(text).trim(), keys[index]]));
  const correctOrder = answerTexts.map(text => keyByText.get(text));
  if (correctOrder.some(key => !key) || new Set(correctOrder).size !== keys.length) {
    throw new Error(`Ordering answer does not match options: ${sourceId}`);
  }
  return { options: question.options.map((text, index) => ({ key: keys[index], text: String(text).trim() })), correctOrder };
}

function matchingItems(question, sourceId) {
  if (!Array.isArray(question.pairs) || question.pairs.length < 2) {
    throw new Error(`Matching question has no pairs: ${sourceId}`);
  }
  const leftItems = question.pairs.map((pair, index) => ({ key: `L${index + 1}`, text: String(pair.left).trim() }));
  const options = question.pairs.map((pair, index) => ({ key: `R${index + 1}`, text: String(pair.right).trim() }));
  if (leftItems.some(item => !item.text) || options.some(item => !item.text)) {
    throw new Error(`Matching question has an empty pair: ${sourceId}`);
  }
  return {
    leftItems,
    options,
    correctPairs: question.pairs.map((_, index) => ({ left: leftItems[index].key, right: options[index].key })),
  };
}

function normalize(question, meta, extra = false) {
  const sourceType = question.type;
  let options = splitOptions(question.options);
  let correct = splitCorrect(question.correct);
  let details = {};
  const domainId = Number(meta.domainId ?? meta.domain?.domain_id ?? question.domainId);
  const domainTitle = meta.domainTitle ?? meta.domain?.title ?? `Domain ${domainId}`;
  const objectiveId = String(meta.objectiveId ?? meta.objective?.id ?? question.domain ?? '');
  const objectiveTitle = meta.objectiveTitle ?? meta.objective?.title ?? objectiveId;
  const mappedType = ({
    multiple_choice: 'single', multi_select: 'multiple', drag_drop_order: 'ordering',
    fill_blank: 'fill_blank', match_pairs: 'matching',
  })[sourceType];
  if (sourceType === 'drag_drop_order') {
    const ordered = orderedItems(question, meta.sourceId || question.id);
    options = ordered.options;
    correct = ordered.correctOrder;
    details.correctOrder = ordered.correctOrder;
  } else if (sourceType === 'fill_blank') {
    const answer = String(question.correct ?? '').trim();
    correct = answer ? [answer] : [];
    details.acceptedAnswers = correct.slice();
    details.caseSensitive = true;
  } else if (sourceType === 'match_pairs') {
    const matching = matchingItems(question, meta.sourceId || question.id);
    options = matching.options;
    correct = matching.correctPairs.map(pair => `${pair.left}:${pair.right}`);
    details.leftItems = matching.leftItems;
    details.correctPairs = matching.correctPairs;
  }
  if (!question.stem || (sourceType !== 'fill_blank' && !options.length) || !correct.length) {
    throw new Error(`Incomplete supported question ${meta.sourceId || question.id || '(no id)'}`);
  }
  if ((sourceType === 'multiple_choice' || sourceType === 'multi_select') && correct.some(key => !options.some(option => option.key === key))) {
    throw new Error(`Correct key does not match options for ${meta.sourceId || question.id}`);
  }
  return {
    id: meta.sourceId,
    question: `${meta.stemPrefix || ''}${question.stem}`,
    type: mappedType,
    options,
    correct: mappedType === 'single' ? correct[0] : correct,
    explanation: question.explanation || '',
    category: `D${domainId} · ${domainTitle}`,
    domainId,
    domainTitle,
    objectiveId,
    topic: objectiveTitle,
    difficulty: question.difficulty || '',
    shuffleOptions: sourceType === 'multiple_choice' || sourceType === 'multi_select' ? false : true,
    ...details,
    sourceFormat: sourceType,
    sourceQuestionId: extra ? question.id : meta.sourceId,
  };
}

const questions = [];
const counts = { single: 0, multiple: 0, ordering: 0, fill_blank: 0, matching: 0 };
for (const item of flat) {
  if (!supportedTypes.has(item.question.type)) {
    excludedByType[item.question.type] = (excludedByType[item.question.type] || 0) + 1;
    continue;
  }
  const q = normalize(item.question, {
    sourceId: item.sourceId,
    stemPrefix: item.stemPrefix,
    domain: item.domain,
    objective: item.objective,
  });
  counts[q.type] += 1;
  questions.push(q);
}
for (const question of extras) {
  if (!supportedTypes.has(question.type)) {
    excludedByType[question.type] = (excludedByType[question.type] || 0) + 1;
    continue;
  }
  const q = normalize(question, {
    sourceId: `extra-${question.id}`,
    domainId: question.domainId,
    domainTitle: question.domainTitle,
    objectiveId: question.objectiveId,
    objectiveTitle: question.objectiveTitle,
  }, true);
  counts[q.type] += 1;
  questions.push(q);
}

if (flat.length !== 73 || extras.length !== 14 || questions.length !== 87 ||
    counts.single !== 42 || counts.multiple !== 19 || counts.ordering !== 5 || counts.fill_blank !== 12 || counts.matching !== 9) {
  throw new Error(`Unexpected source totals: base=${flat.length}, extras=${extras.length}, included=${questions.length}, counts=${JSON.stringify(counts)}`);
}

const result = {
  source: 'fastestShipper/gh600-study',
  sourceCommit: SOURCE_COMMIT,
  sourceLicense: 'MIT; see UPSTREAM-LICENSE. Some upstream questions cite other sources; see README.md.',
  included: counts,
  excludedByType,
  questions,
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Wrote ${questions.length} questions to ${path.relative(root, outputPath)} (${JSON.stringify(counts)}).`);
console.log(`Unsupported formats excluded: ${JSON.stringify(excludedByType)}.`);
