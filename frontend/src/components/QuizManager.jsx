import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from './Shell.jsx';
import { LoadMore, pageUrl } from './Pagination.jsx';

function blankQuestion() {
  return {
    prompt: '',
    points: 10,
    options: [
      { label: '', isCorrect: true },
      { label: '', isCorrect: false },
      { label: '', isCorrect: false },
    ],
  };
}

function QuizBuilder({ quiz, lessons, onCancel, onSaved }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(quiz?.title ?? '');
  const [lessonId, setLessonId] = useState(quiz?.lessonId ?? '');
  const [status, setStatus] = useState(quiz?.status ?? 'PUBLISHED');
  const [attemptLimit, setAttemptLimit] = useState(quiz?.attemptLimit == null ? '' : String(quiz.attemptLimit));
  const [questions, setQuestions] = useState(() => quiz
    ? quiz.questions.map((question) => ({
      prompt: question.prompt,
      points: question.points,
      options: question.options.map((option) => ({ label: option.label, isCorrect: option.isCorrect })),
    }))
    : [blankQuestion()]);

  const save = useMutation({
    mutationFn: (body) => api(quiz ? `/quizzes/${quiz.id}` : '/quizzes', {
      method: quiz ? 'PATCH' : 'POST',
      body,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['quizzes'] }),
        queryClient.invalidateQueries({ queryKey: ['lessons'] }),
      ]);
      onSaved();
    },
  });

  function updateQuestion(questionIndex, changes) {
    setQuestions((current) => current.map((question, index) => (
      index === questionIndex ? { ...question, ...changes } : question
    )));
  }

  function updateOption(questionIndex, optionIndex, changes) {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      return {
        ...question,
        options: question.options.map((option, currentOption) => (
          currentOption === optionIndex ? { ...option, ...changes } : option
        )),
      };
    }));
  }

  function chooseCorrect(questionIndex, optionIndex) {
    setQuestions((current) => current.map((question, index) => (
      index === questionIndex
        ? { ...question, options: question.options.map((option, currentOption) => ({
          ...option,
          isCorrect: currentOption === optionIndex,
        })) }
        : question
    )));
  }

  return (
    <form className="card stack" onSubmit={(event) => {
      event.preventDefault();
      save.mutate({
        title,
        lessonId: lessonId || null,
        status,
        attemptLimit: attemptLimit === '' ? null : Number(attemptLimit),
        questions: questions.map((question) => ({ ...question, points: Number(question.points) })),
      });
    }}>
      <h3>{quiz ? 'Edit quiz' : 'New quiz'}</h3>
      <ErrorList error={save.error} />
      <Field label="Title">
        <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={140} />
      </Field>
      <Field label="Attach to lesson">
        <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
          <option value="">No lesson</option>
          {lessons.data?.pages.flatMap((page) => page.items).map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </Field>
      <LoadMore query={lessons} label="lessons" />
      <div className="row wrap">
        <Field label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Attempt limit (leave blank for unlimited)">
          <input
            type="number"
            min="1"
            max="20"
            value={attemptLimit}
            onChange={(event) => setAttemptLimit(event.target.value)}
          />
        </Field>
      </div>
      {questions.map((question, questionIndex) => (
        <fieldset key={questionIndex} className="card stack">
          <legend>Question {questionIndex + 1}</legend>
          <Field label="Question prompt">
            <input
              value={question.prompt}
              onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
              required
              minLength={3}
              maxLength={1000}
            />
          </Field>
          <Field label="Points">
            <input
              type="number"
              min="1"
              max="100"
              value={question.points}
              onChange={(event) => updateQuestion(questionIndex, { points: event.target.value })}
              required
            />
          </Field>
          <p className="muted">Choose exactly one correct answer.</p>
          {question.options.map((option, optionIndex) => (
            <div className="row wrap" key={optionIndex}>
              <Field label={`Answer ${optionIndex + 1}`}>
                <input
                  value={option.label}
                  onChange={(event) => updateOption(questionIndex, optionIndex, { label: event.target.value })}
                  required
                  maxLength={300}
                />
              </Field>
              <label className="choice">
                <input
                  type="radio"
                  name={`correct-${questionIndex}`}
                  checked={option.isCorrect}
                  onChange={() => chooseCorrect(questionIndex, optionIndex)}
                />
                <span>Correct</span>
              </label>
            </div>
          ))}
          {questions.length > 1 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}
            >
              Remove question
            </button>
          )}
        </fieldset>
      ))}
      {questions.length < 20 && (
        <button type="button" className="secondary" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>
          Add question
        </button>
      )}
      <div className="row">
        <button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : quiz ? 'Save quiz' : 'Create quiz'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function QuizCard({ quiz, lessons }) {
  const [editing, setEditing] = useState(false);
  const details = useQuery({
    queryKey: ['quiz', quiz.id],
    queryFn: () => api(`/quizzes/${quiz.id}`),
    enabled: editing,
  });

  return (
    <li className="card stack">
      <div className="spread">
        <div>
          <h3>{quiz.title}</h3>
          <p className="muted">
            {quiz.status.toLowerCase()} · {quiz.questionsCount} questions · {quiz.attemptsCount} attempts
            {quiz.lessonTitle ? ` · ${quiz.lessonTitle}` : ''}
          </p>
        </div>
        {quiz.canEdit && !editing && (
          <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit quiz</button>
        )}
      </div>
      {!quiz.canEdit && quiz.attemptsCount > 0 && <p className="muted">Locked after the first attempt to preserve recorded scores.</p>}
      {editing && (
        <QueryState query={details}>
          {(data) => <QuizBuilder quiz={data} lessons={lessons} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />}
        </QueryState>
      )}
    </li>
  );
}

export function QuizManager({ lessons }) {
  const [creating, setCreating] = useState(false);
  const quizzes = useInfiniteQuery({
    queryKey: ['quizzes'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/quizzes', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <section className="stack">
      <div className="spread">
        <h2>Manage quizzes</h2>
        {!creating && <button type="button" onClick={() => setCreating(true)}>New quiz</button>}
      </div>
      {creating && <QuizBuilder lessons={lessons} onCancel={() => setCreating(false)} onSaved={() => setCreating(false)} />}
      <QueryState query={quizzes}>
        {() => (
          <ul className="list">
            {quizzes.data.pages.flatMap((page) => page.items).map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} lessons={lessons} />
            ))}
          </ul>
        )}
      </QueryState>
      <LoadMore query={quizzes} label="quizzes" />
    </section>
  );
}
