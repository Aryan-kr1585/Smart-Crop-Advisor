import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const ids = {
  school: '11111111-1111-4111-8111-111111111111',
  class: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
  teacher: '44444444-4444-4444-8444-444444444444',
  student: '55555555-5555-4555-8555-555555555555',
  student2: '66666666-6666-4666-8666-666666666666',
  lesson1: '77777777-7777-4777-8777-777777777777',
  lesson2: '88888888-8888-4888-8888-888888888888',
  quiz: '99999999-9999-4999-8999-999999999999',
  task1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  task2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  badge1: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  badge2: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  badge3: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  challenge: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
};

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@ecoquest.test' } });
  if (existing) {
    console.log('Seed already applied');
    return;
  }

  const passwordHash = await bcrypt.hash('EcoQuest123!', 12);
  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.school.create({
    data: {
      id: ids.school,
      name: 'Green Valley Public School',
      region: 'Pune',
    },
  });

  await prisma.class.create({
    data: {
      id: ids.class,
      schoolId: ids.school,
      name: 'Grade 8 A',
      academicYear: '2026-27',
    },
  });

  const people = [
    { id: ids.admin, email: 'admin@ecoquest.test', displayName: 'Demo Admin', role: 'ADMIN' },
    { id: ids.teacher, email: 'teacher@ecoquest.test', displayName: 'Demo Teacher', role: 'TEACHER' },
    { id: ids.student, email: 'student@ecoquest.test', displayName: 'Demo Student', role: 'STUDENT' },
    { id: ids.student2, email: 'student2@ecoquest.test', displayName: 'Demo Student Two', role: 'STUDENT' },
  ];

  for (const person of people) {
    await prisma.user.create({
      data: { ...person, passwordHash, schoolId: ids.school, status: 'ACTIVE' },
    });
    if (person.role !== 'ADMIN') {
      await prisma.classMembership.create({
        data: { userId: person.id, classId: ids.class },
      });
    }
  }

  await prisma.lesson.create({
    data: {
      id: ids.lesson1,
      title: 'Why the trees outside school matter',
      status: 'PUBLISHED',
      publishedAt: now,
      authorId: ids.teacher,
      body: [
        'A tree in a schoolyard does more than cast shade. It cools the ground, gives birds a place to stop, and shows students a living system they can watch through the year.',
        'Start by noticing one tree. What is its bark like? Does it drop leaves? Which insects visit the flowers? Writing those observations is already environmental learning.',
        'Caring for a sapling is a long task. Water it in the first dry weeks, keep the base free of plastic, and do not expect it to look finished in a month. The point is to stay with it.',
      ].join('\n\n'),
    },
  });

  await prisma.lesson.create({
    data: {
      id: ids.lesson2,
      title: 'Sorting waste at home',
      status: 'PUBLISHED',
      publishedAt: now,
      authorId: ids.teacher,
      body: [
        'Mixed waste is hard to recycle. A simple home habit is three streams: wet food scraps, dry paper and plastic that are clean, and items that are unsafe or unusable and must go to the regular bin.',
        'Rinse a bottle before it goes into dry waste. Keep food scraps out of plastic bags when your area collects wet waste separately.',
        'This lesson is about a habit you can finish today. The matching task asks you to try it for one day and describe what you sorted.',
      ].join('\n\n'),
    },
  });

  await prisma.quiz.create({
    data: {
      id: ids.quiz,
      lessonId: ids.lesson2,
      title: 'Waste sorting check',
      status: 'PUBLISHED',
      attemptLimit: 3,
      authorId: ids.teacher,
      questions: {
        create: [
          {
            prompt: 'Which item belongs with wet waste?',
            position: 1,
            points: 10,
            options: {
              create: [
                { label: 'Vegetable peels', position: 1, isCorrect: true },
                { label: 'A rinsed glass bottle', position: 2, isCorrect: false },
                { label: 'A used battery', position: 3, isCorrect: false },
              ],
            },
          },
          {
            prompt: 'Why rinse a plastic bottle before recycling it?',
            position: 2,
            points: 10,
            options: {
              create: [
                { label: 'Food left inside contaminates the dry stream', position: 1, isCorrect: true },
                { label: 'Water makes plastic heavier to sell', position: 2, isCorrect: false },
                { label: 'Bottles cannot be stored unless they are wet', position: 3, isCorrect: false },
              ],
            },
          },
          {
            prompt: 'What is a fair way to think about a new sapling?',
            position: 3,
            points: 10,
            options: {
              create: [
                { label: 'It needs care over many weeks, not a single photo', position: 1, isCorrect: true },
                { label: 'It is finished once it is planted', position: 2, isCorrect: false },
                { label: 'Only large forests count as environmental work', position: 3, isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      id: ids.task1,
      title: 'Sort household waste for one day',
      instructions: 'Separate wet scraps, clean dry recyclables, and residual waste for one day. Describe what you sorted and anything that was confusing. A photo is optional and should not show faces or addresses.',
      status: 'PUBLISHED',
      points: 20,
      requiresReview: true,
      authorId: ids.teacher,
      dueAt: inThirtyDays,
    },
  });

  await prisma.task.create({
    data: {
      id: ids.task2,
      title: 'Care for a plant this week',
      instructions: 'Water a school, home, or street sapling, or start seeds in a reused container. Describe what you did and how you will keep it going. Do not include other people in photos.',
      status: 'PUBLISHED',
      points: 30,
      requiresReview: true,
      authorId: ids.teacher,
      dueAt: inThirtyDays,
    },
  });

  await prisma.badge.createMany({
    data: [
      {
        id: ids.badge1,
        name: 'First action',
        description: 'One task submission approved by a teacher.',
        criteria: { type: 'APPROVED_SUBMISSIONS', threshold: 1 },
      },
      {
        id: ids.badge2,
        name: 'Quiz sprout',
        description: 'Pass at least one quiz.',
        criteria: { type: 'QUIZZES_PASSED', threshold: 1 },
      },
      {
        id: ids.badge3,
        name: 'Forty eco-points',
        description: 'Reach 40 eco-points from approved learning and tasks.',
        criteria: { type: 'POINTS_AT_LEAST', threshold: 40 },
      },
    ],
  });

  await prisma.challenge.create({
    data: {
      id: ids.challenge,
      title: 'Campus green week',
      description: 'Complete both starter tasks during this month.',
      status: 'ACTIVE',
      startsAt: now,
      endsAt: inThirtyDays,
      schoolId: ids.school,
      tasks: { create: [{ taskId: ids.task1 }, { taskId: ids.task2 }] },
    },
  });

  console.log('Seeded demo school, accounts, lessons, quiz, tasks, badges, and challenge');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
