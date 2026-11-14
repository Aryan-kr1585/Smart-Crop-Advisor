import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from './Shell.jsx';

export function EditableLesson({ lesson }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ['lesson', lesson.id],
    queryFn: () => api(`/lessons/${lesson.id}`),
    enabled: editing,
  });
  const update = useMutation({
    mutationFn: (body) => api(`/lessons/${lesson.id}`, { method: 'PATCH', body }),
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons'] }),
        queryClient.invalidateQueries({ queryKey: ['lesson', lesson.id] }),
      ]);
    },
  });

  return (
    <li className="card stack">
      <div className="spread">
        <div>
          <h3>{lesson.title}</h3>
          <p className="muted">{lesson.status.toLowerCase()}</p>
        </div>
        {lesson.canEdit && !editing && (
          <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit lesson</button>
        )}
      </div>
      {editing && (
        <div className="stack">
          <QueryState query={details}>
            {(data) => (
              <form className="stack" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                update.mutate({
                  title: form.get('title'),
                  body: form.get('body'),
                  status: form.get('status'),
                });
              }}>
                <ErrorList error={update.error} />
                <Field label="Title"><input name="title" defaultValue={data.title} required minLength={3} maxLength={140} /></Field>
                <Field label="Lesson text"><textarea name="body" defaultValue={data.body} required minLength={10} maxLength={20000} /></Field>
                <Field label="Status">
                  <select name="status" defaultValue={data.status}>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </Field>
                <button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save lesson'}</button>
              </form>
            )}
          </QueryState>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel edit</button>
        </div>
      )}
    </li>
  );
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function EditableTask({ task }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (body) => api(`/tasks/${task.id}`, { method: 'PATCH', body }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <li className="card stack">
      <div className="spread">
        <div>
          <h3>{task.title}</h3>
          <p className="muted">{task.status.toLowerCase()} · {task.points} eco-points</p>
        </div>
        {task.canEdit && !editing && (
          <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit task</button>
        )}
      </div>
      {editing && (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const dueAt = form.get('dueAt');
          update.mutate({
            title: form.get('title'),
            instructions: form.get('instructions'),
            points: Number(form.get('points')),
            status: form.get('status'),
            dueAt: dueAt ? new Date(dueAt).toISOString() : null,
            requiresReview: form.get('requiresReview') === 'on',
          });
        }}>
          <ErrorList error={update.error} />
          <Field label="Title"><input name="title" defaultValue={task.title} required minLength={3} maxLength={140} /></Field>
          <Field label="Instructions"><textarea name="instructions" defaultValue={task.instructions} required minLength={10} maxLength={8000} /></Field>
          <Field label="Eco-points"><input name="points" type="number" min="0" max="500" defaultValue={task.points} required /></Field>
          <Field label="Due date"><input name="dueAt" type="datetime-local" defaultValue={localDateTime(task.dueAt)} /></Field>
          <Field label="Status">
            <select name="status" defaultValue={task.status}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <label className="choice">
            <input name="requiresReview" type="checkbox" defaultChecked={task.requiresReview} />
            <span>Require teacher review before awarding points</span>
          </label>
          <div className="row">
            <button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save task'}</button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
