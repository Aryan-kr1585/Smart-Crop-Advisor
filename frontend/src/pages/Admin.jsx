import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from '../components/Shell.jsx';
import { LoadMore, pageUrl } from '../components/Pagination.jsx';
import { EditableLesson, EditableTask } from '../components/ContentEditors.jsx';
import { QuizManager } from '../components/QuizManager.jsx';

export function AdminHome({ section }) {
  const schools = useInfiniteQuery({
    queryKey: ['schools'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/schools', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: section === 'overview',
  });
  const users = useInfiniteQuery({
    queryKey: ['users'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/users', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: section === 'people',
  });
  const tasks = useInfiniteQuery({
    queryKey: ['tasks'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/tasks', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: section === 'content',
  });
  const lessons = useInfiniteQuery({
    queryKey: ['lessons'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/lessons', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: section === 'content',
  });
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['schools'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
  }

  const saveUser = useMutation({
    mutationFn: ({ id, body }) => api(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { setError(null); refresh(); },
    onError: setError,
  });

  if (section === 'overview') {
    return (
      <div className="stack">
        <p className="kicker">Admin</p>
        <h1>School setup</h1>
        <ErrorList error={error} />
        {message && <p className="banner" role="status">{message}</p>}
        <form className="card stack" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            await api('/schools', { method: 'POST', body: { name: form.get('name'), region: form.get('region') || undefined } });
            setMessage('School created.');
            setError(null);
            event.target.reset();
            refresh();
          } catch (err) { setError(err); }
        }}>
          <h2>New school</h2>
          <Field label="Name"><input name="name" required minLength={2} /></Field>
          <Field label="Region"><input name="region" /></Field>
          <button type="submit">Create school</button>
        </form>
        <QueryState query={schools}>
          {() => schools.data.pages.flatMap((page) => page.items).map((school) => (
            <SchoolClasses key={school.id} school={school} onError={setError} onDone={(text) => { setMessage(text); refresh(); }} />
          ))}
        </QueryState>
        <LoadMore query={schools} label="schools" />
      </div>
    );
  }

  if (section === 'people') {
    return (
      <div className="stack">
        <h1>People</h1>
        <ErrorList error={error} />
        <QueryState query={users}>
          {() => (
            <ul className="list">
              {users.data.pages.flatMap((page) => page.items).map((person) => (
                <li key={person.id} className="card stack">
                  <strong>{person.displayName}</strong>
                  <p className="muted">{person.email}</p>
                  <div className="row wrap">
                    <label className="field">
                      <span>Role</span>
                      <select
                        value={person.role}
                        onChange={(event) => saveUser.mutate({ id: person.id, body: { role: event.target.value } })}
                      >
                        <option value="STUDENT">Student</option>
                        <option value="TEACHER">Teacher</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        value={person.status}
                        onChange={(event) => saveUser.mutate({ id: person.id, body: { status: event.target.value } })}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        <LoadMore query={users} label="people" />
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Content and engagement</h1>
      <ErrorList error={error} />
      {message && <p className="banner" role="status">{message}</p>}
      <form className="card stack" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await api('/badges', {
            method: 'POST',
            body: {
              name: form.get('name'),
              description: form.get('description'),
              criteria: { type: form.get('type'), threshold: Number(form.get('threshold')) },
            },
          });
          setMessage('Badge created.');
          setError(null);
          event.target.reset();
        } catch (err) { setError(err); }
      }}>
        <h2>New badge</h2>
        <Field label="Name"><input name="name" required minLength={2} /></Field>
        <Field label="Description"><input name="description" required minLength={4} /></Field>
        <Field label="Rule">
          <select name="type" defaultValue="POINTS_AT_LEAST">
            <option value="POINTS_AT_LEAST">Eco-points at least</option>
            <option value="APPROVED_SUBMISSIONS">Approved submissions</option>
            <option value="QUIZZES_PASSED">Quizzes passed</option>
          </select>
        </Field>
        <Field label="Threshold"><input name="threshold" type="number" min="1" defaultValue="1" required /></Field>
        <button type="submit">Create badge</button>
      </form>
      <form className="card stack" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const taskIds = form.getAll('taskIds');
        try {
          await api('/challenges', {
            method: 'POST',
            body: {
              title: form.get('title'),
              description: form.get('description'),
              startsAt: new Date(form.get('startsAt')).toISOString(),
              endsAt: new Date(form.get('endsAt')).toISOString(),
              status: 'ACTIVE',
              taskIds,
            },
          });
          setMessage('Challenge created.');
          setError(null);
        } catch (err) { setError(err); }
      }}>
        <h2>New challenge</h2>
        <Field label="Title"><input name="title" required minLength={3} /></Field>
        <Field label="Description"><textarea name="description" required minLength={4} /></Field>
        <Field label="Starts"><input name="startsAt" type="datetime-local" required /></Field>
        <Field label="Ends"><input name="endsAt" type="datetime-local" required /></Field>
        <fieldset>
          <legend>Tasks</legend>
          {tasks.data?.pages.flatMap((page) => page.items).map((task) => (
            <label key={task.id} className="choice">
              <input type="checkbox" name="taskIds" value={task.id} />
              <span>{task.title}</span>
            </label>
          ))}
        </fieldset>
        <LoadMore query={tasks} label="tasks" />
        <button type="submit">Create challenge</button>
      </form>
      <section className="stack">
        <QuizManager lessons={lessons} />
      </section>
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
      <section className="stack">
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
      </section>
    </div>
  );
}

function SchoolClasses({ school, onError, onDone }) {
  const classes = useInfiniteQuery({
    queryKey: ['classes', school.id],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/schools/${school.id}/classes`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const users = useInfiniteQuery({
    queryKey: ['users', school.id],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/users?schoolId=${encodeURIComponent(school.id)}`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const classItems = classes.data?.pages.flatMap((page) => page.items) ?? [];
  const userItems = users.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="card stack">
      <h2>{school.name}</h2>
      <p className="muted">{school.region || 'Region not set'}</p>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await api(`/schools/${school.id}/classes`, {
            method: 'POST',
            body: { name: form.get('name'), academicYear: form.get('academicYear') || undefined },
          });
          onDone('Class created.');
          event.target.reset();
        } catch (err) { onError(err); }
      }}>
        <Field label="Class name"><input name="name" required /></Field>
        <Field label="Academic year"><input name="academicYear" placeholder="2026-27" /></Field>
        <button type="submit">Add class</button>
      </form>
      <QueryState query={classes}>
        {() => classItems.length === 0 ? <p className="muted">No classes have been created for this school yet.</p> : classItems.map((item) => (
          <form key={item.id} className="stack" onSubmit={async (event) => {
            event.preventDefault();
            const userId = new FormData(event.currentTarget).get('userId');
            try {
              await api(`/classes/${item.id}/members`, { method: 'POST', body: { userIds: [userId] } });
              onDone(`Added to ${item.name}.`);
            } catch (err) { onError(err); }
          }}>
            <h3>{item.name}</h3>
            <Field label="Add an existing account">
              <select name="userId" required defaultValue="">
                <option value="" disabled>Choose a person</option>
                {userItems.map((person) => (
                  <option key={person.id} value={person.id}>{person.displayName} ({person.role.toLowerCase()})</option>
                ))}
              </select>
            </Field>
            <button type="submit" className="secondary">Add to class</button>
          </form>
        ))}
      </QueryState>
      {users.isLoading && <p className="status" role="status">Loading people…</p>}
      {users.isError && <ErrorList error={users.error} />}
      <LoadMore query={classes} label="classes" />
      <LoadMore query={users} label="people" />
    </section>
  );
}
