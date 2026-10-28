const test = require('node:test');
const assert = require('node:assert/strict');
const { parseIntent, isOnTopic, stem } = require('../extension/src/intent.js');

test('parseIntent drops filler words and numbers', () => {
  assert.deepEqual(parseIntent('I want to learn React hooks'), ['react', 'hook']);
  assert.deepEqual(parseIntent('calculus 2 tutorial for beginners'), ['calculu']);
  assert.deepEqual(parseIntent('how to'), []);
});

test('parseIntent merges comma-separated extras', () => {
  assert.deepEqual(parseIntent('React hooks', 'useEffect, PedroTech'), ['react', 'hook', 'useeffect', 'pedrotech']);
});

test('stem joins common inflections', () => {
  assert.equal(stem('coding'), stem('code'));
  assert.equal(stem('hooks'), stem('hook'));
  assert.equal(stem('studies'), stem('study'));
  assert.equal(stem('machines'), stem('machine'));
});

test('on-topic titles from a real "react hooks" search pass', () => {
  const k = parseIntent('React hooks');
  assert.ok(isOnTopic(k, 'All React Hooks Explained - React Hooks Tutorial 2025 PedroTech'));
  assert.ok(isOnTopic(k, 'useState Hook in ReactJS'));
  assert.ok(isOnTopic(k, 'React Supabase CRUD Tutorial | Supabase Beginner Tutorial'));
});

test('off-topic titles are caught', () => {
  const k = parseIntent('React hooks');
  assert.equal(isOnTopic(k, 'Funniest Cat Videos of 2025 | Try Not To Laugh'), false);
  assert.equal(isOnTopic(k, 'I Survived 100 Days in Minecraft MrBeast'), false);
});

test('abbreviations and longer forms meet via prefix', () => {
  assert.ok(isOnTopic(parseIntent('calc'), 'Calculus 1 Full Course'));
  assert.ok(isOnTopic(parseIntent('mathematics'), 'Math Antics - Fractions'));
  assert.ok(isOnTopic(parseIntent('nodejs'), 'Node.js Crash Course'));
});

test('short tokens only match exactly', () => {
  assert.equal(isOnTopic(parseIntent('art'), 'Writing a great article'), false);
  assert.ok(isOnTopic(parseIntent('c++'), 'C++ pointers in 10 minutes'));
});

test('channel names count as part of the text', () => {
  assert.ok(isOnTopic(parseIntent('3blue1brown'), 'But what is a neural network? 3Blue1Brown'));
});

test('no usable keywords means no filtering', () => {
  assert.ok(isOnTopic([], 'anything at all'));
  assert.ok(isOnTopic(parseIntent('learn how to'), 'Funny cats'));
});

test('accents and case are ignored', () => {
  assert.ok(isOnTopic(parseIntent('Café latte art'), 'CAFE LATTE tips from a barista'));
});
