export const PASS_RATIO = 0.6;

export const LEVELS = [
  { level: 1, name: 'Seedling', min: 0 },
  { level: 2, name: 'Sprout', min: 40 },
  { level: 3, name: 'Sapling', min: 100 },
  { level: 4, name: 'Grove', min: 200 },
  { level: 5, name: 'Canopy', min: 400 },
];

export function scoreAttempt(questions, answers) {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  let score = 0;
  let maxScore = 0;
  const results = [];

  for (const question of questions) {
    maxScore += question.points;
    const correct = question.options.find((option) => option.isCorrect);
    const selected = answerByQuestion.get(question.id);
    const correctAnswer = Boolean(correct && selected === correct.id);
    if (correctAnswer) score += question.points;
    results.push({
      questionId: question.id,
      selectedOptionId: selected ?? null,
      correct: correctAnswer,
      correctOptionId: correct?.id ?? null,
    });
  }

  return {
    score,
    maxScore,
    passed: maxScore > 0 && score / maxScore >= PASS_RATIO,
    results,
  };
}

export function levelFor(points) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.min) current = level;
  }
  const next = LEVELS.find((level) => level.min > current.min) ?? null;
  return {
    level: current.level,
    name: current.name,
    min: current.min,
    next: next ? { level: next.level, name: next.name, min: next.min, pointsToGo: next.min - points } : null,
  };
}

export function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftDay(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return utc.toISOString().slice(0, 10);
}

export function streakFromDates(dates, now, timeZone = 'Asia/Kolkata') {
  const keys = new Set(dates.map((value) => dayKey(new Date(value), timeZone)));
  let cursor = dayKey(now, timeZone);
  if (!keys.has(cursor)) cursor = shiftDay(cursor, -1);
  let count = 0;
  while (keys.has(cursor)) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function badgeEarned(criteria, stats) {
  if (!criteria || typeof criteria !== 'object') return false;
  const threshold = Number(criteria.threshold ?? 1);
  if (!Number.isFinite(threshold)) return false;
  if (criteria.type === 'POINTS_AT_LEAST') return stats.points >= threshold;
  if (criteria.type === 'APPROVED_SUBMISSIONS') return stats.approvedSubmissions >= threshold;
  if (criteria.type === 'QUIZZES_PASSED') return stats.quizzesPassed >= threshold;
  return false;
}
