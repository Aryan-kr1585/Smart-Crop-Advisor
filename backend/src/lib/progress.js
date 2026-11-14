import { prisma } from './prisma.js';
import { badgeEarned, PASS_RATIO } from './scoring.js';

export async function awardPoints(tx, entry) {
  if (!entry.amount) return null;
  try {
    return await tx.pointLedger.create({ data: entry });
  } catch (error) {
    if (error.code === 'P2002') return null;
    throw error;
  }
}

export async function userStats(tx, userId) {
  const [pointsAgg, approvedSubmissions, attempts, ledgerDates] = await Promise.all([
    tx.pointLedger.aggregate({ where: { userId }, _sum: { amount: true } }),
    tx.submission.count({ where: { userId, status: 'APPROVED' } }),
    tx.quizAttempt.findMany({ where: { userId }, select: { quizId: true, score: true, maxScore: true } }),
    tx.pointLedger.findMany({ where: { userId, amount: { gt: 0 } }, select: { createdAt: true } }),
  ]);
  const quizzesPassed = new Set(
    attempts
      .filter((attempt) => attempt.maxScore > 0 && attempt.score / attempt.maxScore >= PASS_RATIO)
      .map((attempt) => attempt.quizId),
  ).size;
  return {
    points: pointsAgg._sum.amount ?? 0,
    approvedSubmissions,
    quizzesPassed,
    activeDates: ledgerDates.map((row) => row.createdAt),
  };
}

export async function evaluateBadges(tx, userId) {
  const [badges, owned, stats, user] = await Promise.all([
    tx.badge.findMany({ where: { active: true } }),
    tx.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    userStats(tx, userId),
    tx.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } }),
  ]);
  const ownedIds = new Set(owned.map((row) => row.badgeId));
  const granted = [];
  for (const badge of badges) {
    if (ownedIds.has(badge.id) || !badgeEarned(badge.criteria, stats)) continue;
    await tx.userBadge.create({
      data: { userId, badgeId: badge.id, source: String(badge.criteria?.type ?? 'criteria') },
    });
    if (user?.notificationsEnabled) {
      await tx.notification.create({
        data: {
          userId,
          type: 'BADGE_EARNED',
          payload: { badgeId: badge.id, name: badge.name, description: badge.description },
        },
      });
    }
    granted.push(badge);
  }
  return { granted, stats };
}

export async function writeAudit(tx, { actorId, action, entityType, entityId, metadata }) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata: metadata ?? undefined },
  });
}
