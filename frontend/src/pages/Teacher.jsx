import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from '../components/Shell.jsx';
import { Evidence } from './Student.jsx';

export function TeachHome() {
  const classes = useQuery({ queryKey: ['my-school'], queryFn: () => api('/schools') });
  const reviews = useQuery({ queryKey: ['reviews', 'PENDING'], queryFn: () => api('/submissions?status=PENDING') });
  const students = useQuery({ queryKey: ['students'], queryFn: () => api('/users') });
  return (
    <div className="stack">
      <p className="kicker">Teacher desk</p>
      <h1>Your classes</h1>
      <div className="grid">
        <QueryState query={reviews}>
          {(data) => <article className="card"><h2>Waiting for review</h2><p className="score">{data.items.length}</p></article>}
        </QueryState>
        <QueryState query={students}>
          {(data) => <article className="card"><h2>Students you can see</h2><p className="score">{data.items.length}</p></article>}
        </QueryState>
      </div>
      <QueryState query={classes}>
        {(data) => <p className="muted">{data.items[0] ? data.items[0].name : 'No school assigned yet.'}</p>}
      </QueryState>
      <ClassRoster />
    </div>
  );
}

function ClassRoster() {
  const schools = useQuery({ queryKey: ['my-school'], queryFn: () => api('/schools') });
  const schoolId = schools.data?.items?.[0]?.id;
  const classes = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => api(`/schools/${schoolId}/classes`),
    enabled: Boolean(schoolId),
  });
  const classId = classes.data?.items?.[0]?.id;
  const students = useQuery({
    queryKey: ['students', classId],
    queryFn: () => api(`/users?classId=${classId}`),
    enabled: Boolean(classId),
  });
  return (
    <section className="card stack">
      <h2>{classes.data?.items?.[0]?.name || 'Class'}</h2>
      <QueryState query={students}>
        {(data) => (
          <ul>{data.items.map((student) => <li key={student.id}>{student.displayName}</li>)}</ul>
        )}
      </QueryState>
    </section>
  );
}

export function TeachContent() {
  const queryClient = useQueryClient();
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => api('/lessons') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/tasks') });
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  async function createLesson(event) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await api('/lessons', {
        method: 'POST',
        body: { title: form.get('title'), body: form.get('body'), status: 'PUBLISHED' },
      });
      setMessage('Lesson published.');
      event.target.reset();
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    } catch (err) {
      setError(err);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const due = form.get('dueAt');
      await api('/tasks', {
        method: 'POST',
        body: {
          title: form.get('title'),
          instructions: form.get('instructions'),
          points: Number(form.get('points')),
          status: 'PUBLISHED',
          dueAt: due ? new Date(due).toISOString() : undefined,
          requiresReview: true,
        },
      });
      setMessage('Task published.');
      event.target.reset();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      setError(err);
    }
  }

  async function createQuiz(event) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const lessonId = form.get('lessonId');
    try {
      await api('/quizzes', {
        method: 'POST',
        body: {
          title: form.get('title'),
          lessonId: lessonId || null,
          status: 'PUBLISHED',
          attemptLimit: 3,
          questions: [
            {
              prompt: form.get('prompt'),
              points: 10,
              options: [1, 2, 3].map((index) => ({
                label: form.get(`option${index}`),
                isCorrect: form.get('correct') === String(index),
              })),
            },
          ],
        },
      });
      setMessage('Quiz published.');
      event.target.reset();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="stack">
      <h1>Lessons and tasks</h1>
      {message && <p className="banner" role="status">{message}</p>}
      <ErrorList error={error} />
      <form className="card stack" onSubmit={createLesson}>
        <h2>New lesson</h2>
        <Field label="Title"><input name="title" required minLength={3} /></Field>
        <Field label="Body"><textarea name="body" required minLength={10} /></Field>
        <button type="submit">Publish lesson</button>
      </form>
      <form className="card stack" onSubmit={createQuiz}>
        <h2>New one-question quiz</h2>
        <Field label="Title"><input name="title" required minLength={3} /></Field>
        <Field label="Attach to lesson">
          <select name="lessonId" defaultValue="">
            <option value="">None</option>
            {lessons.data?.items?.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
          </select>
        </Field>
        <Field label="Question"><input name="prompt" required minLength={3} /></Field>
        <Field label="Option 1"><input name="option1" required /></Field>
        <Field label="Option 2"><input name="option2" required /></Field>
        <Field label="Option 3"><input name="option3" required /></Field>
        <Field label="Correct option">
          <select name="correct" defaultValue="1">
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
            <option value="3">Option 3</option>
          </select>
        </Field>
        <button type="submit">Publish quiz</button>
      </form>
      <form className="card stack" onSubmit={createTask}>
        <h2>New task</h2>
        <Field label="Title"><input name="title" required minLength={3} /></Field>
        <Field label="Instructions"><textarea name="instructions" required minLength={10} /></Field>
        <Field label="Eco-points"><input name="points" type="number" min="0" max="500" defaultValue="10" required /></Field>
        <Field label="Due date"><input name="dueAt" type="datetime-local" /></Field>
        <button type="submit">Publish task</button>
      </form>
      <section>
        <h2>Published tasks</h2>
        <QueryState query={tasks}>
          {(data) => <ul>{data.items.map((task) => <li key={task.id}>{task.title} · {task.points} points</li>)}</ul>}
        </QueryState>
      </section>
    </div>
  );
}

export function ReviewPage() {
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ['reviews'], queryFn: () => api('/submissions') });
  const [error, setError] = useState(null);
  const review = useMutation({
    mutationFn: ({ id, decision, reviewNote }) => api(`/submissions/${id}/review`, {
      method: 'POST',
      body: { decision, reviewNote: reviewNote || undefined },
    }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: setError,
  });

  return (
    <div className="stack">
      <h1>Submission review</h1>
      <ErrorList error={error} />
      <QueryState query={reviews}>
        {(data) => (
          <ul className="list">
            {data.items.length === 0 && <li>Nothing in the queue.</li>}
            {data.items.map((item) => (
              <li key={item.id} className="card stack">
                <h2>{item.task.title}</h2>
                <p>{item.student.displayName} · {item.status.toLowerCase()} · {item.task.points} eco-points</p>
                {item.text && <p>{item.text}</p>}
                <Evidence assetId={item.assetId} alt={`Evidence submitted by ${item.student.displayName}`} />
                {item.status === 'PENDING' && (
                  <ReviewActions
                    onApprove={() => review.mutate({ id: item.id, decision: 'APPROVED' })}
                    onReject={(reviewNote) => review.mutate({ id: item.id, decision: 'REJECTED', reviewNote })}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

function ReviewActions({ onApprove, onReject }) {
  const [note, setNote] = useState('');
  return (
    <div className="stack">
      <Field label="Note, required if you reject">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="row">
        <button type="button" onClick={onApprove}>Approve</button>
        <button type="button" className="danger" onClick={() => onReject(note)}>Reject</button>
      </div>
    </div>
  );
}
