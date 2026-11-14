import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiBlob } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ErrorList, Field, QueryState } from '../components/Shell.jsx';

export function StudentHome() {
  const { user } = useAuth();
  const points = useQuery({ queryKey: ['points'], queryFn: () => api('/users/me/points') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/tasks') });
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => api('/lessons') });
  return (
    <div className="stack">
      <p className="kicker">Student desk</p>
      <h1>Hello, {user.displayName}</h1>
      <QueryState query={points}>
        {(data) => (
          <div className="row wrap">
            <span className="pill">{data.total} eco-points</span>
            <span className="pill">{data.level.name}</span>
            <span className="pill">{data.streak} day streak</span>
          </div>
        )}
      </QueryState>
      <div className="grid">
        <QueryState query={lessons}>
          {(data) => (
            <article className="card">
              <h2>Lessons</h2>
              <p>{data.items.length} published</p>
              <Link to="/learn/lessons">Continue reading</Link>
            </article>
          )}
        </QueryState>
        <QueryState query={tasks}>
          {(data) => (
            <article className="card">
              <h2>Open tasks</h2>
              <p>{data.items.filter((task) => task.mySubmission?.status !== 'APPROVED').length} still waiting on you</p>
              <Link to="/learn/tasks">See tasks</Link>
            </article>
          )}
        </QueryState>
      </div>
    </div>
  );
}

export function LessonList() {
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => api('/lessons') });
  return (
    <div className="stack">
      <h1>Lessons</h1>
      <QueryState query={lessons}>
        {(data) => (
          <ul className="list">
            {data.items.map((lesson) => (
              <li key={lesson.id} className="card">
                <h2>{lesson.title}</h2>
                <Link to={`/learn/lessons/${lesson.id}`}>Read</Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

export function LessonDetail() {
  const { lessonId } = useParams();
  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api(`/lessons/${lessonId}`) });
  return (
    <QueryState query={lesson}>
      {(data) => (
        <article className="stack lesson-body">
          <p className="kicker">Lesson</p>
          <h1>{data.title}</h1>
          {data.body.split('\n\n').map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
          {data.quizzes.length > 0 && (
            <div className="card">
              <h2>Check your understanding</h2>
              <ul>
                {data.quizzes.map((quiz) => (
                  <li key={quiz.id}><Link to={`/learn/quizzes/${quiz.id}`}>{quiz.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </QueryState>
  );
}

export function QuizPage() {
  const { quizId } = useParams();
  const queryClient = useQueryClient();
  const quiz = useQuery({ queryKey: ['quiz', quizId], queryFn: () => api(`/quizzes/${quizId}`) });
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const attempt = useMutation({
    mutationFn: (body) => api(`/quizzes/${quizId}/attempts`, { method: 'POST', body }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['points'] });
      queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
    },
    onError: setError,
  });

  return (
    <QueryState query={quiz}>
      {(data) => (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setResult(null);
            attempt.mutate({
              answers: data.questions.map((question) => ({
                questionId: question.id,
                optionId: answers[question.id],
              })),
            });
          }}
        >
          <p className="kicker">Quiz</p>
          <h1>{data.title}</h1>
          <p className="muted">
            Pass mark is 60%. Attempts used: {data.attemptsUsed ?? 0}
            {data.attemptLimit ? ` of ${data.attemptLimit}` : ''}. The score is calculated on the server.
          </p>
          <ErrorList error={error} />
          {data.questions.map((question, index) => (
            <fieldset key={question.id} className="card">
              <legend>Question {index + 1} of {data.questions.length}. {question.points} points.</legend>
              <p>{question.prompt}</p>
              {question.options.map((option) => (
                <label key={option.id} className="choice">
                  <input
                    type="radio"
                    name={question.id}
                    required
                    checked={answers[question.id] === option.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <button type="submit" disabled={attempt.isPending}>{attempt.isPending ? 'Submitting…' : 'Submit answers'}</button>
          {result && (
            <div className="card" role="status">
              <p className="score">{result.score} / {result.maxScore}</p>
              <p>{result.passed ? 'Passed. Eco-points were awarded once for this quiz.' : 'Not passed yet. You can try again if you have attempts left.'}</p>
            </div>
          )}
        </form>
      )}
    </QueryState>
  );
}

export function TaskList() {
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/tasks') });
  const challenges = useQuery({ queryKey: ['challenges'], queryFn: () => api('/challenges') });
  return (
    <div className="stack">
      <h1>Tasks</h1>
      <QueryState query={challenges}>
        {(data) => data.items.length > 0 && (
          <section className="card">
            <h2>Current challenge</h2>
            {data.items.map((challenge) => (
              <div key={challenge.id}>
                <h3>{challenge.title}</h3>
                <p>{challenge.description}</p>
              </div>
            ))}
          </section>
        )}
      </QueryState>
      <QueryState query={tasks}>
        {(data) => (
          <ul className="list">
            {data.items.map((task) => (
              <li key={task.id} className="card spread">
                <div>
                  <h2>{task.title}</h2>
                  <p className="muted">{task.points} eco-points · {task.mySubmission ? task.mySubmission.status.toLowerCase() : 'not submitted'}</p>
                </div>
                <Link to={`/learn/tasks/${task.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

export function Evidence({ assetId, alt = 'Submitted evidence' }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!assetId) return undefined;
    let active = true;
    let objectUrl = '';
    apiBlob(`/uploads/${assetId}`).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {
      if (active) setUrl('');
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);
  if (!assetId) return null;
  if (!url) return <p className="status" role="status">Loading image…</p>;
  return <img className="evidence" src={url} alt={alt} />;
}

export function TaskDetail() {
  const { taskId } = useParams();
  const queryClient = useQueryClient();
  const task = useQuery({ queryKey: ['task', taskId], queryFn: () => api(`/tasks/${taskId}`) });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      let assetId;
      const file = form.get('file');
      if (file && file.size) {
        const upload = new FormData();
        upload.append('file', file);
        const saved = await api('/uploads/local', { method: 'POST', form: upload });
        assetId = saved.assetId;
      }
      await api(`/tasks/${taskId}/submissions`, {
        method: 'POST',
        body: { text: form.get('text') || undefined, assetId },
      });
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      event.target.reset();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <QueryState query={task}>
      {(data) => {
        const locked = data.mySubmission && data.mySubmission.status !== 'REJECTED';
        return (
          <div className="stack">
            <p className="kicker">{data.points} eco-points</p>
            <h1>{data.title}</h1>
            {data.instructions.split('\n\n').map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
            {data.dueAt && <p className="muted">Due {new Date(data.dueAt).toLocaleString()}</p>}
            {data.mySubmission && (
              <section className="card stack">
                <h2>Your submission</h2>
                <p>Status: {data.mySubmission.status.toLowerCase()}</p>
                {data.mySubmission.text && <p>{data.mySubmission.text}</p>}
                {data.mySubmission.reviewNote && <p>Teacher note: {data.mySubmission.reviewNote}</p>}
                <Evidence assetId={data.mySubmission.assetId} />
              </section>
            )}
            {!locked && (
              <form className="card stack" onSubmit={onSubmit}>
                <h2>{data.mySubmission ? 'Submit again' : 'Submit your work'}</h2>
                <ErrorList error={error} />
                <Field label="What did you do?">
                  <textarea name="text" maxLength={4000} />
                </Field>
                <Field label="Optional photo, JPEG PNG or WebP, up to 5 MB. Do not include faces.">
                  <input name="file" type="file" accept="image/jpeg,image/png,image/webp" />
                </Field>
                <button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Submit task'}</button>
              </form>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

export function ProgressPage() {
  const points = useQuery({ queryKey: ['points'], queryFn: () => api('/users/me/points') });
  const badges = useQuery({ queryKey: ['my-badges'], queryFn: () => api('/users/me/badges') });
  const catalog = useQuery({ queryKey: ['badges'], queryFn: () => api('/badges') });
  return (
    <div className="stack">
      <h1>Eco-points</h1>
      <QueryState query={points}>
        {(data) => (
          <section className="card stack">
            <p className="score">{data.total}</p>
            <p>{data.level.name}{data.level.next ? ` · ${data.level.next.pointsToGo} points to ${data.level.next.name}` : ''}</p>
            <p>Streak: {data.streak} day{data.streak === 1 ? '' : 's'}. Today stays open until it ends.</p>
            <h2>Ledger</h2>
            {data.entries.length === 0 && <p>No points yet. Pass a quiz or get a task approved.</p>}
            <ul>
              {data.entries.map((entry) => (
                <li key={entry.id}>{entry.amount > 0 ? '+' : ''}{entry.amount} · {entry.reason}</li>
              ))}
            </ul>
          </section>
        )}
      </QueryState>
      <QueryState query={badges}>
        {(data) => (
          <section className="card">
            <h2>Badges you have</h2>
            {data.items.length === 0 && <p>None yet.</p>}
            <ul>{data.items.map((badge) => <li key={badge.badgeId}>{badge.name} — {badge.description}</li>)}</ul>
          </section>
        )}
      </QueryState>
      <QueryState query={catalog}>
        {(data) => (
          <section className="card">
            <h2>All badges</h2>
            <ul>{data.items.map((badge) => <li key={badge.id}>{badge.name} — {badge.description}</li>)}</ul>
          </section>
        )}
      </QueryState>
    </div>
  );
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState('all');
  const board = useQuery({
    queryKey: ['board', period],
    queryFn: () => api(`/leaderboard?period=${period}`),
  });
  return (
    <div className="stack">
      <div className="spread">
        <h1>Leaderboard</h1>
        <label className="field">
          <span>Period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">All time</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
      </div>
      <p className="muted">Names are display names for your school. Email addresses are not shown.</p>
      <QueryState query={board}>
        {(data) => (
          <>
            {data.me && <p className="pill">You are rank {data.me.rank} with {data.me.points} eco-points</p>}
            {data.items.length === 0 && <p>No students in this school yet. Ask an admin to add your class.</p>}
            <ol className="list">
              {data.items.map((row) => (
                <li key={`${row.rank}-${row.displayName}`} className="card spread">
                  <span>{row.rank}. {row.displayName}</span>
                  <strong>{row.points}</strong>
                </li>
              ))}
            </ol>
          </>
        )}
      </QueryState>
    </div>
  );
}

export function NoticesPage() {
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ['notices'], queryFn: () => api('/notifications') });
  const mark = useMutation({
    mutationFn: (id) => api(`/notifications/${id}/read`, { method: 'PATCH', body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });
  return (
    <div className="stack">
      <h1>Notices</h1>
      <QueryState query={notices}>
        {(data) => (
          <ul className="list">
            {data.items.length === 0 && <li>No notices yet.</li>}
            {data.items.map((item) => (
              <li key={item.id} className="card stack">
                <p>{noticeText(item)}</p>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                {!item.readAt && (
                  <button type="button" className="secondary" onClick={() => mark.mutate(item.id)}>Mark read</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

function noticeText(item) {
  const payload = item.payload || {};
  if (item.type === 'BADGE_EARNED') return `Badge earned: ${payload.name}. ${payload.description || ''}`;
  if (item.type === 'POINTS_AWARDED') return `+${payload.amount} eco-points. ${payload.reason}`;
  if (item.type === 'SUBMISSION_REVIEWED') {
    return `${payload.taskTitle} was ${String(payload.decision || '').toLowerCase()}.${payload.reviewNote ? ` Note: ${payload.reviewNote}` : ''}`;
  }
  return item.type;
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: (displayName) => api('/users/me', { method: 'PATCH', body: { displayName } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      setSaved(true);
      setError(null);
    },
    onError: setError,
  });
  return (
    <form
      className="panel stack"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        update.mutate(new FormData(event.currentTarget).get('displayName'));
      }}
    >
      <h1>Profile</h1>
      <p className="muted">{user.email}</p>
      <ErrorList error={error} />
      {saved && <p role="status">Name saved.</p>}
      <Field label="Display name">
        <input name="displayName" defaultValue={user.displayName} minLength={2} maxLength={80} required />
      </Field>
      <button type="submit" disabled={update.isPending}>Save</button>
    </form>
  );
}
