#!/usr/bin/env node
// Validate data.json trước khi merge dữ liệu câu hỏi mới.
// Usage: node tools/validate-data.js [path/to/data.json]

const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2] || path.join(__dirname, '..', 'data.json');

let raw;
try {
  raw = fs.readFileSync(dataPath, 'utf8');
} catch (e) {
  console.error(`Không đọc được file: ${dataPath}\n${e.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`JSON không hợp lệ: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
  err('data.tracks phải là mảng non-empty');
}
const trackIds = new Set((data.tracks || []).map((t) => t.id));
(data.tracks || []).forEach((t, i) => {
  if (!t.id) err(`tracks[${i}] thiếu id`);
  if (!t.label) warn(`tracks[${i}] (${t.id}) thiếu label`);
});

if (!Array.isArray(data.exams) || data.exams.length === 0) {
  err('data.exams phải là mảng non-empty');
  printReportAndExit();
}

const examIds = new Set();
let totalQuestions = 0;
const seenQuestionText = new Map(); // text -> [examId#qid, ...] toàn cục, chỉ để cảnh báo

data.exams.forEach((exam, ei) => {
  const examTag = exam.id || `exams[${ei}]`;

  if (!exam.id) err(`${examTag}: thiếu id`);
  else if (examIds.has(exam.id)) err(`exam id trùng lặp: "${exam.id}"`);
  else examIds.add(exam.id);

  if (!exam.track) err(`${examTag}: thiếu track`);
  else if (!trackIds.has(exam.track)) err(`${examTag}: track "${exam.track}" không tồn tại trong data.tracks`);

  if (!exam.title) warn(`${examTag}: thiếu title`);

  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    err(`${examTag}: questions phải là mảng non-empty`);
    return;
  }

  if (typeof exam.count === 'number' && exam.count !== exam.questions.length) {
    warn(`${examTag}: count khai báo (${exam.count}) != số câu thực tế (${exam.questions.length})`);
  }

  const qIds = new Set();

  exam.questions.forEach((q, qi) => {
    const qTag = `${examTag}#${q.id !== undefined ? q.id : `[idx ${qi}]`}`;
    totalQuestions++;

    // --- id ---
    if (q.id === undefined || q.id === null || q.id === '') {
      err(`${qTag}: thiếu id`);
    } else {
      const key = String(q.id);
      if (qIds.has(key)) err(`${qTag}: id trùng lặp trong cùng exam`);
      else qIds.add(key);
    }

    // --- question text ---
    if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
      err(`${qTag}: thiếu nội dung câu hỏi (question)`);
    } else {
      const norm = q.question.trim().toLowerCase();
      if (!seenQuestionText.has(norm)) seenQuestionText.set(norm, []);
      seenQuestionText.get(norm).push(qTag);
    }

    // --- type ---
    if (q.type !== 'single' && q.type !== 'multiple') {
      err(`${qTag}: type "${q.type}" không hợp lệ (phải là "single" hoặc "multiple")`);
    }

    // --- options ---
    const optKeys = new Set();
    if (!Array.isArray(q.options) || q.options.length < 2) {
      err(`${qTag}: options phải là mảng có ít nhất 2 phần tử`);
    } else {
      q.options.forEach((o, oi) => {
        if (!o.key) err(`${qTag}: options[${oi}] thiếu key`);
        else if (optKeys.has(o.key)) err(`${qTag}: options key trùng lặp "${o.key}"`);
        else optKeys.add(o.key);
        if (!o.text || typeof o.text !== 'string' || !o.text.trim()) {
          err(`${qTag}: options[${oi}] (key=${o.key}) thiếu text`);
        }
      });
    }

    // --- correct ---
    // Schema thật: câu "single" lưu correct dạng string ("A"), câu "multiple" lưu dạng mảng (["A","B"]).
    // App tự chuẩn hóa string -> mảng khi load (xem makeItem() trong ai-cert-quiz.html), nên ở đây
    // chỉ coi là lỗi khi thiếu hẳn, hoặc sai kiểu so với type đã khai báo.
    if (q.correct === undefined || q.correct === null || q.correct === '' ||
        (Array.isArray(q.correct) && q.correct.length === 0)) {
      err(`${qTag}: thiếu correct`);
    } else {
      const correctArr = Array.isArray(q.correct) ? q.correct : [q.correct];
      const dupCheck = new Set();
      correctArr.forEach((k) => {
        if (typeof k !== 'string') { err(`${qTag}: correct chứa giá trị không phải string (${JSON.stringify(k)})`); return; }
        if (dupCheck.has(k)) warn(`${qTag}: correct chứa key trùng lặp "${k}"`);
        dupCheck.add(k);
        if (optKeys.size && !optKeys.has(k)) {
          err(`${qTag}: correct chứa key "${k}" không tồn tại trong options`);
        }
      });
      if (q.type === 'single' && Array.isArray(q.correct)) {
        warn(`${qTag}: type=single nhưng correct lưu dạng mảng (${JSON.stringify(q.correct)}) thay vì string — khác pattern chung của dataset`);
      }
      if (q.type === 'single' && correctArr.length !== 1) {
        warn(`${qTag}: type=single nhưng correct có ${correctArr.length} đáp án`);
      }
      if (q.type === 'multiple' && !Array.isArray(q.correct)) {
        err(`${qTag}: type=multiple nhưng correct lưu dạng string thay vì mảng`);
      }
      if (q.type === 'multiple' && correctArr.length < 2) {
        warn(`${qTag}: type=multiple nhưng correct chỉ có ${correctArr.length} đáp án`);
      }
    }

    // --- explanation ---
    if (!q.explanation || !String(q.explanation).trim()) {
      warn(`${qTag}: thiếu explanation`);
    }

    // --- optExp ---
    if (q.optExp && typeof q.optExp === 'object') {
      Object.keys(q.optExp).forEach((k) => {
        if (optKeys.size && !optKeys.has(k)) {
          warn(`${qTag}: optExp có key "${k}" không khớp option nào`);
        }
      });
    }

    // --- disputed ---
    if (q.disputed) {
      const d = q.disputed;
      if (!Array.isArray(d.altAnswer) || d.altAnswer.length === 0) {
        err(`${qTag}: disputed.altAnswer phải là mảng non-empty`);
      } else {
        d.altAnswer.forEach((k) => {
          if (optKeys.size && !optKeys.has(k)) {
            err(`${qTag}: disputed.altAnswer chứa key "${k}" không tồn tại trong options`);
          }
        });
      }
      if (!d.vs) warn(`${qTag}: disputed thiếu "vs" (nguồn đối chiếu)`);
      if (!d.reason) warn(`${qTag}: disputed thiếu "reason"`);
    }
  });
});

if (typeof data.totalQuestions === 'number' && data.totalQuestions !== totalQuestions) {
  warn(`data.totalQuestions khai báo (${data.totalQuestions}) != tổng số câu thực tế (${totalQuestions})`);
}

// Câu hỏi trùng nội dung giữa các exam khác nhau (thường là dấu hiệu convert lỗi/duplicate)
for (const [, locs] of seenQuestionText) {
  if (locs.length > 1) {
    warn(`Câu hỏi trùng nội dung ở ${locs.length} chỗ: ${locs.join(', ')}`);
  }
}

function printReportAndExit() {
  report();
}

function report() {
  console.log(`\nKiểm tra: ${dataPath}`);
  console.log(`Tổng số câu hỏi: ${totalQuestions}\n`);

  if (errors.length) {
    console.log(`❌ ${errors.length} lỗi:`);
    errors.forEach((m) => console.log('  - ' + m));
  } else {
    console.log('✅ Không có lỗi cấu trúc.');
  }

  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} cảnh báo:`);
    warnings.forEach((m) => console.log('  - ' + m));
  }

  console.log('');
  process.exit(errors.length ? 1 : 0);
}

report();
