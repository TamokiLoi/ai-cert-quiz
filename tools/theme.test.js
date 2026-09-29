'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'ai-cert-quiz.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';

test('light theme defines light backgrounds and readable status colors for quiz cells', () => {
  const lightTheme = css.match(/body\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1] || '';
  for (const token of [
    '--tag-bg: #e7e9f5',
    '--qnav-cell-bg: #e8eaf2',
    '--qnav-answered-bg: #dce1ed',
    '--option-letter-bg: #e7e9f5',
  ]) assert.ok(lightTheme.includes(token), `missing ${token}`);
  assert.match(lightTheme, /--qnav-correct-text:\s*#166534/);
  assert.match(lightTheme, /--qnav-wrong-text:\s*#b42318/);
});

test('theme-sensitive quiz cells, labels, and legends use theme tokens', () => {
  assert.match(css, /\.tag\s*\{[^}]*background:\s*var\(--tag-bg\)/s);
  assert.match(css, /\.qnav-cell\s*\{[^}]*background:\s*var\(--qnav-cell-bg\)/s);
  assert.match(css, /\.qnav-cell\.answered\s*\{[^}]*background:\s*var\(--qnav-answered-bg\)/);
  assert.match(css, /\.qnav-legend \.lg-todo i\s*\{\s*background:\s*var\(--qnav-cell-bg\)/);
  assert.match(css, /\.option \.letter\s*\{[^}]*background:\s*var\(--option-letter-bg\)/s);
});

test('theme toggle updates the document color scheme and browser toolbar color', () => {
  assert.match(html, /document\.documentElement\.dataset\.theme\s*=\s*S\.theme/);
  assert.match(html, /themeColor\.content\s*=\s*S\.theme\s*===\s*'light'\s*\?\s*'#eef0f7'\s*:\s*'#0f1220'/);
  assert.match(css, /html\[data-theme="light"\]\s*\{\s*color-scheme:\s*light/s);
});
