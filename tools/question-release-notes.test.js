'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ReleaseNotes = require('../question-release-notes');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'));

function note(examSetId, questionId, extra = {}) {
  return {
    examSetId,
    examSetName: `Set ${examSetId}`,
    questionId,
    questionCode: `Q${questionId}`,
    changeType: 'answer_key',
    date: '2026-09-25',
    version: 'commit abc1234',
    reason: 'Verified change',
    oldValue: 'A',
    newValue: 'B',
    ...extra,
  };
}

test('filters all notes or only the selected exam set', () => {
  const notes = [note('set-a', 81), note('set-b', 81), note('set-a', 12)];
  const ids = new Set(['set-a', 'set-b']);
  assert.equal(ReleaseNotes.filterNotes(notes, 'ALL', ids).length, 3);
  assert.deepEqual(ReleaseNotes.filterNotes(notes, 'set-a', ids), [notes[0], notes[2]]);
});

test('groups and identifies identical question codes separately by exam set', () => {
  const first = note('set-a', 81);
  const second = note('set-b', 81);
  const groups = ReleaseNotes.groupNotes([first, second]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.examSetId), ['set-a', 'set-b']);
  assert.notEqual(ReleaseNotes.noteIdentity(first), ReleaseNotes.noteIdentity(second));
});

test('retains incomplete history and reports unverified fields without treating null old value as missing', () => {
  const incomplete = {
    examSetName: 'Unlinked set',
    questionId: 81,
    questionCode: 'Q81',
    changeType: 'question_added',
    date: '2026-09-25',
    version: 'commit abc1234',
    reason: null,
    oldValue: null,
    newValue: 'New question text',
  };
  const ids = new Set(['set-a']);
  assert.equal(ReleaseNotes.filterNotes([incomplete], 'ALL', ids).length, 1);
  assert.equal(ReleaseNotes.filterNotes([incomplete], '__UNVERIFIED__', ids).length, 1);
  const missing = ReleaseNotes.missingFields(incomplete, ids);
  assert.ok(missing.includes('examSetId'));
  assert.ok(missing.includes('reason'));
  assert.ok(!missing.includes('oldValue'));
  assert.match(ReleaseNotes.missingNotice(missing), /^Chưa xác minh:/);
  assert.match(ReleaseNotes.missingNotice(missing), /bộ đề \(examSetId\)/);
  const groups = ReleaseNotes.groupNotes([incomplete]);
  assert.equal(groups[0].examSetId, null);
  assert.equal(groups[0].examSetName, 'Unlinked set');
});

test('keeps malformed records visible in the unverified view instead of dropping them', () => {
  const malformed = null;
  assert.deepEqual(ReleaseNotes.filterNotes([malformed], 'ALL'), [malformed]);
  assert.deepEqual(ReleaseNotes.filterNotes([malformed], '__UNVERIFIED__'), [malformed]);
  assert.equal(ReleaseNotes.missingNotice(ReleaseNotes.missingFields(malformed)), 'Chưa xác minh: bản ghi không hợp lệ');
});

test('flags a note whose exam set id does not exist in the loaded data', () => {
  const orphan = note('removed-set', 7);
  const missing = ReleaseNotes.missingFields(orphan, new Set(['set-a']));
  assert.ok(missing.includes('examSetId (unknown set)'));
  assert.equal(ReleaseNotes.filterNotes([orphan], '__UNVERIFIED__', new Set(['set-a'])).length, 1);
});

test('retrospective answer corrections preserve their verified exam-set scope and before/after values', () => {
  const find = (examSetId, questionId, sourceCommit) => data.questionReleaseNotes.find((entry) =>
    entry.examSetId === examSetId && entry.questionId === questionId &&
    entry.sourceCommit === sourceCommit && entry.changeType === 'answer_key');
  const q57 = find('claude-index162', 57, '63ef123');
  const q74 = find('claude-index162', 74, '63ef123');
  assert.deepEqual(q57.oldValue.correct, 'D');
  assert.deepEqual(q57.newValue.correct, 'C');
  assert.deepEqual(q74.oldValue.correct, 'C');
  assert.deepEqual(q74.newValue.correct, 'D');
  assert.equal(q57.date, '2026-09-25');
  assert.equal(q57.reason, 'Audit Claude quiz answers and sync data');
  assert.equal(data.questionReleaseNotesCoverage.fromCommit, 'cd893b4');
});

test('all stored history records link to a question in the declared exam set', () => {
  const examById = new Map(data.exams.map((exam) => [exam.id, new Set(exam.questions.map((q) => String(q.id)))]));
  assert.ok(data.questionReleaseNotes.length > 0);
  for (const entry of data.questionReleaseNotes) {
    assert.deepEqual(ReleaseNotes.missingFields(entry, new Set(examById.keys())), []);
    assert.ok(examById.get(entry.examSetId)?.has(String(entry.questionId)), entry.id);
  }
});
