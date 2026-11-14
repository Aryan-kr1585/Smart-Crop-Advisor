import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from '../components/Shell.jsx';
import { LoadMore, pageUrl } from '../components/Pagination.jsx';
import { EditableLesson, EditableTask } from '../components/ContentEditors.jsx';
import { QuizManager } from '../components/QuizManager.jsx';
import { Evidence } from './Student.jsx';

export function TeachHome() {
  const classes = useQuery({ queryKey: ['my-school'], queryFn: () => api('/schools') });
  const reviews = useQuery({ queryKey: ['reviews', 'PENDING'], queryFn: () => api('/submissions?status=PENDING') });
  return (
    <div className="stack">
      <p className="kicker">Teacher desk</p>
      <h1>Your classes</h1>
      <div className="grid">
        <QueryState query={reviews}>
          {(data) => <article className="card"><h2>Pending submissions</h2><p className="score">{data.totalCount}</p><p><Link to="/teach/reviews">Open review queue</Link></p></article>}
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
  const classes = useInfiniteQuery({
    queryKey: ['classes', schoolId],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/schools/${schoolId}/classes`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(schoolId),
  });
  const classItems = classes.data?.pages.flatMap((page) => page.items) ?? [];
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const classId = classItems.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : classItems[0]?.id ?? '';
  const students = useInfiniteQuery({
    queryKey: ['students', classId],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/users?classId=${encodeURIComponent(classId)}`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(classId),
  });
  const studentItems = students.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="card stack">
      <h2>Class roster</h2>
      {classItems.length > 0 && (
        <Field label="Choose a class">
          <select value={classId} onChange={(event) => {
            setSelectedClassId(event.target.value);
            setSelectedStudentId('');
          }}>
            {classItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.academicYear ? ` · ${item.academicYear}` : ''}</option>
            ))}
          </select>
        </Field>
      )}
      {schools.isError && <ErrorList error={schools.error} />}
      {!schoolId && schools.isSuccess && <p className="muted">No school assigned yet.</p>}
      {schoolId && classes.isLoading && <p className="status" role="status">Loading classes…</p>}
      {classes.isError && <ErrorList error={classes.error} />}
      {schoolId && classes.isSuccess && classItems.length === 0 && <p className="muted">No assigned classes yet.</p>}
      <LoadMore query={classes} label="classes" />
      {classId && (
        <QueryState query={students}>
          {() => (
            <>
              <ul className="list">
                {studentItems.map((student) => (
                  <li key={student.id} className="card spread">
                    <span>{student.displayName}</span>
                    <button type="button" className="secondary" onClick={() => setSelectedStudentId((current) => current === student.id ? '' : student.id)}>
                      {selectedStudentId === student.id ? 'Hide progress' : 'View progress'}
                    </button>
                  </li>
                ))}
              </ul>
              {studentItems.length === 0 && <p className="muted">No students in this class yet.</p>}
              <LoadMore query={students} label="students" />
              {selectedStudentId && studentItems.some((student) => student.id === selectedStudentId) && (
                <StudentProgress key={selectedStudentId} studentId={selectedStudentId} />
              )}
            </>
          )}
        </QueryState>
      )}
    </section>
  );
}

function StudentProgress({ studentId }) {
  const points = useInfiniteQuery({
    queryKey: ['student-progress', studentId],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/users/${studentId}/points`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <QueryState query={points}>
      {() => {
        const summary = points.data.pages[0];
        const entries = points.data.pages.flatMap((page) => page.entries);
        return (
          <section className="card stack" aria-label={`${summary.displayName} progress`}>
            <h3>{summary.displayName} progress</h3>
            <div className="row wrap">
              <span className="pill">{summary.total} eco-points</span>
              <span className="pill">{summary.level.name}</span>
            </div>
            <h4>Recent point activity</h4>
            {entries.length === 0 ? <p className="muted">No point activity yet.</p> : (
              <ul>{entries.map((entry) => (
                <li key={entry.id}>{entry.amount > 0 ? '+' : ''}{entry.amount} · {entry.reason} · {new Date(entry.createdAt).toLocaleDateString()}</li>
              ))}</ul>
            )}
            <LoadMore query={points} label="point entries" />
          </section>
        );
      }}
    </QueryState>
  );
}

export function TeachContent() {
  const queryClient = useQueryClient();
  const lessons = useInfiniteQuery({
    queryKey: ['lessons'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/lessons', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const tasks = useInfiniteQuery({
    queryKey: ['tasks'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/tasks', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  async function createLesson(event) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await api('/lessons', {
        method: 'POST',
        body: { title: form.get('title'), body: form.get('body'), status: form.get('status') },
      });
      setMessage(form.get('status') === 'PUBLISHED' ? 'Lesson published.' : 'Lesson saved as a draft.');
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
          status: form.get('status'),
          dueAt: due ? new Date(due).toISOString() : undefined,
          requiresReview: true,
        },
      });
      setMessage(form.get('status') === 'PUBLISHED' ? 'Task published.' : 'Task saved as a draft.');
      event.target.reset();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
        <Field label="Initial status">
          <select name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </Field>
        <button type="submit">Save lesson</button>
      </form>
      <section className="stack">
        <h2>Manage lessons</h2>
        <QueryState query={lessons}>
          {() => (
            <ul className="list">
              {lessons.data.pages.flatMap((page) => page.items).map((lesson) => (
                <EditableLesson key={lesson.id} lesson={lesson} />
              ))}
            </ul>
          )}
        </QueryState>
        <LoadMore query={lessons} label="lessons" />
      </section>
      <QuizManager lessons={lessons} />
      <form className="card stack" onSubmit={createTask}>
        <h2>New task</h2>
        <Field label="Title"><input name="title" required minLength={3} /></Field>
        <Field label="Instructions"><textarea name="instructions" required minLength={10} /></Field>
        <Field label="Eco-points"><input name="points" type="number" min="0" max="500" defaultValue="10" required /></Field>
        <Field label="Due date"><input name="dueAt" type="datetime-local" /></Field>
        <Field label="Initial status">
          <select name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </Field>
        <button type="submit">Save task</button>
      </form>
      <section>
        <h2>Manage tasks</h2>
        <QueryState query={tasks}>
          {() => (
            <ul className="list">
              {tasks.data.pages.flatMap((page) => page.items).map((task) => (
                <EditableTask key={task.id} task={task} />
              ))}
            </ul>
          )}
        </QueryState>
        <LoadMore query={tasks} label="tasks" />
      </section>
    </div>
  );
}

export function ReviewPage() {
  const queryClient = useQueryClient();
  const reviews = useInfiniteQuery({
    queryKey: ['reviews'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/submissions', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const [error, setError] = useState(null);
  const review = useMutation({
    mutationFn: ({ id, decision, reviewNote }) => api(`/submissions/${id}/review`, {
      method: 'POST',
      body: { decision, reviewNote: reviewNote || undefined },
    }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
    },
    onError: setError,
  });

  return (
    <div className="stack">
      <h1>Submission review</h1>
      <ErrorList error={error} />
      <QueryState query={reviews}>
        {() => {
          const items = reviews.data.pages.flatMap((page) => page.items);
          return (
          <ul className="list">
            {items.length === 0 && <li>Nothing in the queue.</li>}
            {items.map((item) => (
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
          );
        }}
      </QueryState>
      <LoadMore query={reviews} label="submissions" />
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
