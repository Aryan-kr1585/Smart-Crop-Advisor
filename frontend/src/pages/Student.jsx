import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiBlob, setToken } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ErrorList, Field, QueryState } from '../components/Shell.jsx';
import { LoadMore, pageUrl } from '../components/Pagination.jsx';

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
              <p>{data.items.length}{data.nextCursor ? '+' : ''} published lessons available</p>
              <Link to="/learn/lessons">Continue reading</Link>
            </article>
          )}
        </QueryState>
        <QueryState query={tasks}>
          {(data) => (
            <article className="card">
              <h2>Open tasks</h2>
              <p>{data.items.filter((task) => task.mySubmission?.status !== 'APPROVED').length}{data.nextCursor ? '+' : ''} tasks still waiting on you</p>
              <Link to="/learn/tasks">See tasks</Link>
            </article>
          )}
        </QueryState>
      </div>
    </div>
  );
}

export function LessonList() {
  const lessons = useInfiniteQuery({
    queryKey: ['lessons', 'list'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/lessons', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <div className="stack">
      <h1>Lessons</h1>
      <QueryState query={lessons}>
        {() => (
          <ul className="list">
            {lessons.data.pages.flatMap((page) => page.items).map((lesson) => (
              <li key={lesson.id} className="card">
                <h2>{lesson.title}</h2>
                <Link to={`/learn/lessons/${lesson.id}`}>Read</Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <LoadMore query={lessons} label="lessons" />
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
  const tasks = useInfiniteQuery({
    queryKey: ['tasks', 'list'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/tasks', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const challenges = useInfiniteQuery({
    queryKey: ['challenges'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/challenges', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <div className="stack">
      <h1>Tasks</h1>
      <QueryState query={challenges}>
        {() => {
          const items = challenges.data.pages.flatMap((page) => page.items);
          return items.length > 0 && (
          <section className="card">
            <h2>Current challenge</h2>
            {items.map((challenge) => (
              <div key={challenge.id}>
                <h3>{challenge.title}</h3>
                <p>{challenge.description}</p>
              </div>
            ))}
          </section>
          );
        }}
      </QueryState>
      <LoadMore query={challenges} label="challenges" />
      <QueryState query={tasks}>
        {() => (
          <ul className="list">
            {tasks.data.pages.flatMap((page) => page.items).map((task) => (
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
      <LoadMore query={tasks} label="tasks" />
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
  const points = useInfiniteQuery({
    queryKey: ['points', 'ledger'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/users/me/points', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const badges = useQuery({ queryKey: ['my-badges'], queryFn: () => api('/users/me/badges') });
  const catalog = useQuery({ queryKey: ['badges'], queryFn: () => api('/badges') });
  return (
    <div className="stack">
      <h1>Eco-points</h1>
      <QueryState query={points}>
        {() => {
          const summary = points.data.pages[0];
          const entries = points.data.pages.flatMap((page) => page.entries);
          return (
          <section className="card stack">
            <p className="score">{summary.total}</p>
            <p>{summary.level.name}{summary.level.next ? ` · ${summary.level.next.pointsToGo} points to ${summary.level.next.name}` : ''}</p>
            <p>Streak: {summary.streak} day{summary.streak === 1 ? '' : 's'}. Today stays open until it ends.</p>
            <h2>Ledger</h2>
            {entries.length === 0 && <p>No points yet. Pass a quiz or get a task approved.</p>}
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>{entry.amount > 0 ? '+' : ''}{entry.amount} · {entry.reason}</li>
              ))}
            </ul>
          </section>
          );
        }}
      </QueryState>
      <LoadMore query={points} label="ledger entries" />
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
  const board = useInfiniteQuery({
    queryKey: ['board', period],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl(`/leaderboard?period=${period}`, pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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
        {() => {
          const summary = board.data.pages[0];
          const items = board.data.pages.flatMap((page) => page.items);
          return (
          <>
            {summary.me && <p className="pill">You are rank {summary.me.rank} with {summary.me.points} eco-points</p>}
            {items.length === 0 && <p>No students in this school yet. Ask an admin to add your class.</p>}
            <ol className="list">
              {items.map((row) => (
                <li key={`${row.rank}-${row.displayName}`} className="card spread">
                  <span>{row.rank}. {row.displayName}</span>
                  <strong>{row.points}</strong>
                </li>
              ))}
            </ol>
          </>
          );
        }}
      </QueryState>
      <LoadMore query={board} label="students" />
    </div>
  );
}

export function NoticesPage() {
  const queryClient = useQueryClient();
  const notices = useInfiniteQuery({
    queryKey: ['notices'],
    initialPageParam: null,
    queryFn: ({ pageParam }) => api(pageUrl('/notifications', pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const mark = useMutation({
    mutationFn: (id) => api(`/notifications/${id}/read`, { method: 'PATCH', body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });
  return (
    <div className="stack">
      <h1>Notices</h1>
      <QueryState query={notices}>
        {() => {
          const items = notices.data.pages.flatMap((page) => page.items);
          return (
          <ul className="list">
            {items.length === 0 && <li>No notices yet.</li>}
            {items.map((item) => (
              <li key={item.id} className="card stack">
                <p>{noticeText(item)}</p>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                {!item.readAt && (
                  <button type="button" className="secondary" onClick={() => mark.mutate(item.id)}>Mark read</button>
                )}
              </li>
            ))}
          </ul>
          );
        }}
      </QueryState>
      <LoadMore query={notices} label="notices" />
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [privacyError, setPrivacyError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    <div className="stack">
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
      <section className="panel stack">
        <h2>Your data</h2>
        <p>Download a JSON copy of your profile, activity, submissions, points, badges, and notices.</p>
        <ErrorList error={privacyError} />
        <button type="button" className="secondary" onClick={async () => {
          setPrivacyError(null);
          try {
            const blob = await apiBlob('/users/me/export');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ecoquest-data.json';
            link.click();
            URL.revokeObjectURL(url);
          } catch (err) { setPrivacyError(err); }
        }}>Download my data</button>
      </section>
      <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault();
        setPrivacyError(null);
        setDeleting(true);
        const confirmation = new FormData(event.currentTarget).get('confirmation');
        try {
          await api('/users/me', { method: 'DELETE', body: { confirmation } });
          setToken(null);
          queryClient.clear();
          navigate('/', { replace: true });
        } catch (err) {
          setPrivacyError(err);
          setDeleting(false);
        }
      }}>
        <h2>Delete account</h2>
        <p>We remove your account identifiers, class memberships, notices, badge grants, submission text, and uploaded evidence. Score and audit history is retained under an anonymized record.</p>
        <Field label="Type DELETE MY ACCOUNT to confirm">
          <input name="confirmation" autoComplete="off" required pattern="DELETE MY ACCOUNT" />
        </Field>
        <button type="submit" className="danger" disabled={deleting}>{deleting ? 'Deleting…' : 'Delete my account'}</button>
      </form>
    </div>
  );
}
