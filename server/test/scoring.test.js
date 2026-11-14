import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeEarned, levelFor, scoreAttempt, streakFromDates } from '../src/lib/scoring.js';

test('scores a quiz without trusting a client score', () => {
  const questions = [
    { id: 'q1', points: 10, options: [{ id: 'a', isCorrect: false }, { id: 'b', isCorrect: true }] },
    { id: 'q2', points: 5, options: [{ id: 'c', isCorrect: true }, { id: 'd', isCorrect: false }] },
  ];
  const result = scoreAttempt(questions, [
    { questionId: 'q1', optionId: 'b' },
    { questionId: 'q2', optionId: 'd' },
  ]);
  assert.equal(result.score, 10);
  assert.equal(result.maxScore, 15);
  assert.equal(result.passed, true);
  assert.equal(result.results[1].correct, false);
});

test('a score under 60 percent does not pass', () => {
  const questions = [
    { id: 'q1', points: 10, options: [{ id: 'a', isCorrect: true }] },
    { id: 'q2', points: 10, options: [{ id: 'b', isCorrect: true }] },
  ];
  const result = scoreAttempt(questions, [
    { questionId: 'q1', optionId: 'missing' },
    { questionId: 'q2', optionId: 'b' },
  ]);
  assert.equal(result.passed, false);
});

test('levels and badge rules use trusted totals', () => {
  assert.equal(levelFor(0).name, 'Seedling');
  assert.equal(levelFor(40).name, 'Sprout');
  assert.equal(levelFor(39).next.pointsToGo, 1);
  assert.equal(badgeEarned({ type: 'POINTS_AT_LEAST', threshold: 40 }, { points: 40 }), true);
  assert.equal(badgeEarned({ type: 'APPROVED_SUBMISSIONS', threshold: 1 }, { approvedSubmissions: 0 }), false);
  assert.equal(badgeEarned({ type: 'UNKNOWN' }, { points: 100 }), false);
});

test('streak counts consecutive activity days in Asia/Kolkata and keeps today open', () => {
  const now = new Date('2026-11-14T08:00:00+05:30');
  const dates = [
    '2026-11-13T10:00:00+05:30',
    '2026-11-12T10:00:00+05:30',
  ];
  assert.equal(streakFromDates(dates, now), 2);
  assert.equal(streakFromDates(['2026-11-10T10:00:00+05:30'], now), 0);
  assert.equal(streakFromDates(['2026-11-14T07:00:00+05:30', '2026-11-13T07:00:00+05:30'], now), 2);
});
