import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { ErrorList, Field, QueryState } from './Shell.jsx';

function BadgeRow({ badge }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (body) => api(`/badges/${badge.id}`, { method: 'PATCH', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['badges'] });
      setEditing(false);
    },
  });
  return (
    <li className="card stack">
      {!editing ? (
        <div className="spread">
          <div>
            <h3>{badge.name} {!badge.active && <span className="muted">(inactive)</span>}</h3>
            <p>{badge.description}</p>
            <p className="muted">{badge.criteria.type.replaceAll('_', ' ').toLowerCase()} · threshold {badge.criteria.threshold} · {badge.awardsCount} awards</p>
          </div>
          <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit badge</button>
        </div>
      ) : (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const body = {
            name: form.get('name'),
            description: form.get('description'),
            active: form.get('active') === 'on',
          };
          if (badge.canEditCriteria) {
            body.criteria = { type: form.get('type'), threshold: Number(form.get('threshold')) };
          }
          save.mutate(body);
        }}>
          <ErrorList error={save.error} />
          <Field label="Name"><input name="name" defaultValue={badge.name} required minLength={2} maxLength={80} /></Field>
          <Field label="Description"><textarea name="description" defaultValue={badge.description} required minLength={4} maxLength={300} /></Field>
          <label className="choice">
            <input type="checkbox" name="active" defaultChecked={badge.active} />
            <span>Active and available for new awards</span>
          </label>
          {badge.canEditCriteria ? (
            <div className="row wrap">
              <Field label="Award rule">
                <select name="type" defaultValue={badge.criteria.type}>
                  <option value="POINTS_AT_LEAST">Eco-points at least</option>
                  <option value="APPROVED_SUBMISSIONS">Approved submissions</option>
                  <option value="QUIZZES_PASSED">Quizzes passed</option>
                </select>
              </Field>
              <Field label="Threshold"><input name="threshold" type="number" min="1" max="100000" defaultValue={badge.criteria.threshold} required /></Field>
            </div>
          ) : <p className="muted">Award criteria are locked after the first grant.</p>}
          <div className="row">
            <button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save badge'}</button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

export function BadgeManager() {
  const badges = useQuery({ queryKey: ['badges', 'admin'], queryFn: () => api('/badges') });
  return (
    <section className="stack">
      <h2>Manage badges</h2>
      <QueryState query={badges}>
        {() => badges.data.items.length ? (
          <ul className="list">{badges.data.items.map((badge) => <BadgeRow key={badge.id} badge={badge} />)}</ul>
        ) : <p className="muted">No badges have been created yet.</p>}
      </QueryState>
    </section>
  );
}
