(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuestionReleaseNotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const REQUIRED_FIELDS = [
    'examSetId', 'examSetName', 'questionId', 'questionCode', 'changeType',
    'date', 'version', 'reason', 'oldValue', 'newValue',
  ];

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }

  function missingFields(note, knownExamSetIds) {
    if (!note || typeof note !== 'object' || Array.isArray(note)) return ['record'];
    const missing = REQUIRED_FIELDS.filter((key) => {
      if (key === 'oldValue' || key === 'newValue') return !hasOwn(note, key);
      const value = note[key];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (knownExamSetIds && note.examSetId && !knownExamSetIds.has(String(note.examSetId))) {
      missing.push('examSetId (unknown set)');
    }
    return missing;
  }

  function filterNotes(notes, selectedExamSetId, knownExamSetIds) {
    const list = Array.isArray(notes) ? notes : [];
    if (!selectedExamSetId || selectedExamSetId === 'ALL') return list.slice();
    if (selectedExamSetId === '__UNVERIFIED__') {
      return list.filter((note) => missingFields(note, knownExamSetIds).some((field) =>
        field === 'record' || field === 'examSetId' || field === 'examSetId (unknown set)'));
    }
    return list.filter((note) => String(note && note.examSetId) === String(selectedExamSetId));
  }

  function groupNotes(notes) {
    const groups = new Map();
    (Array.isArray(notes) ? notes : []).forEach((note) => {
      const examSetId = note && note.examSetId ? String(note.examSetId) : '';
      const key = examSetId ? `exam:${examSetId}` : '__unverified__';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          examSetId: examSetId || null,
          examSetName: (note && note.examSetName) || (examSetId ? `Bộ đề (${examSetId})` : 'Bộ đề chưa xác minh'),
          notes: [],
        });
      }
      groups.get(key).notes.push(note);
    });
    return Array.from(groups.values());
  }

  function noteIdentity(note) {
    return `${note && note.examSetId ? note.examSetId : '__unverified__'}#${
      note && (note.questionCode || note.questionId) !== undefined
        ? (note.questionCode || note.questionId)
        : '__unknown_question__'
    }`;
  }

  function hasValue(note, key) {
    return hasOwn(note, key);
  }

  function missingNotice(fields) {
    if (!fields || !fields.length) return '';
    const labels = {
      record: 'bản ghi không hợp lệ',
      examSetId: 'bộ đề (examSetId)',
      'examSetId (unknown set)': 'bộ đề không tồn tại trong dữ liệu hiện tại',
      examSetName: 'tên bộ đề',
      questionId: 'questionId',
      questionCode: 'mã câu hỏi',
      changeType: 'loại thay đổi',
      date: 'ngày',
      version: 'phiên bản/commit',
      reason: 'lý do',
      oldValue: 'nội dung cũ',
      newValue: 'nội dung mới',
    };
    return `Chưa xác minh: ${fields.map((field) => labels[field] || field).join(', ')}`;
  }

  return { REQUIRED_FIELDS, missingFields, filterNotes, groupNotes, noteIdentity, hasValue, missingNotice };
});
