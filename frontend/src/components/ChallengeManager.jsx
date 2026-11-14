import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from './Shell.jsx';
import { LoadMore, pageUrl } from './Pagination.jsx';

function localDate(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ChallengeEditor({ challenge, tasks, schools }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const save = useMutation({
    mutationFn: (body) => api(`/challenges/${challenge.id}`, { method: 'PATCH', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['challenges', 'admin'] });
      setError(null);
      setMessage('Challenge updated.');
      setEditing(false);
    },
    onError: setError,
  });
  const challengeTaskIds = new Set(challenge.tasks.map((task) => task.id));

  return (
    <li className="card stack">
      <div className="spread">
        <div>
          <h3>{challenge.title}</h3>
          <p className="muted">{challenge.status.toLowerCase()} · {new Date(challenge.startsAt).toLocaleString()} – {new Date(challenge.endsAt).toLocaleString()}</p>
          <p>{challenge.description}</p>
          <p className="muted">{challenge.tasks.map((task) => task.title).join(', ') || 'No linked tasks'}</p>
        </div>
        {!editing && <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit challenge</button>}
      </div>
      {message && <p className="banner" role="status">{message}</p>}
      {editing && (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          save.mutate({
            title: form.get('title'),
            description: form.get('description'),
            startsAt: new Date(form.get('startsAt')).toISOString(),
            endsAt: new Date(form.get('endsAt')).toISOString(),
            status: form.get('status'),
            schoolId: form.get('schoolId') || null,
            taskIds: form.getAll('taskIds'),
          });
        }}>
          <ErrorList error={error} />
          <Field label="Title"><input name="title" defaultValue={challenge.title} required minLength={3} maxLength={140} /></Field>
          <Field label="Description"><textarea name="description" defaultValue={challenge.description} required minLength={4} maxLength={2000} /></Field>
          <div className="row wrap">
            <Field label="Starts"><input name="startsAt" type="datetime-local" defaultValue={localDate(challenge.startsAt)} required /></Field>
            <Field label="Ends"><input name="endsAt" type="datetime-local" defaultValue={localDate(challenge.endsAt)} required /></Field>
          </div>
          <div className="row wrap">
            <Field label="Status">
              <select name="status" defaultValue={challenge.status}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ENDED">Ended</option>
              </select>
            </Field>
            <Field label="School scope (blank means all schools)">
              <select name="schoolId" defaultValue={challenge.schoolId ?? ''}>
                <option value="">All schools</option>
                {challenge.schoolId && !schools.data?.pages.some((page) => page.items.some((school) => school.id === challenge.schoolId)) && (
                  <option value={challenge.schoolId}>Current school</option>
                )}
                {schools.data?.pages.flatMap((page) => page.items).map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend>Tasks (select at least one)</legend>
            {challenge.tasks.filter((task) => !tasks.data?.pages.some((page) => page.items.some((item) => item.id === task.id))).map((task) => (
              <input key={task.id} type="hidden" name="taskIds" value={task.id} />
            ))}
            {tasks.data?.pages.flatMap((page) => page.items).map((task) => (
              <label key={task.id} className="choice">
                <input type="checkbox" name="taskIds" value={task.id} defaultChecked={challengeTaskIds.has(task.id)} />
                <span>{task.title}</span>
              </label>
            ))}
          </fieldset>
          <LoadMore query={tasks} label="tasks" />
          <div className="row">
            <button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save challenge'}</button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

export function ChallengeManager({ tasks, schools }) {
  const challenges = useInfiniteQuery({
    queryKey: ['challenges', 'admin'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/challenges', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <section className="stack">
      <h2>Manage challenges</h2>
      <QueryState query={challenges}>
        {() => (
          <ul className="list">
            {challenges.data.pages.flatMap((page) => page.items).map((challenge) => (
              <ChallengeEditor key={challenge.id} challenge={challenge} tasks={tasks} schools={schools} />
            ))}
          </ul>
        )}
      </QueryState>
      <LoadMore query={challenges} label="challenges" />
      <LoadMore query={schools} label="schools" />
    </section>
  );
}
