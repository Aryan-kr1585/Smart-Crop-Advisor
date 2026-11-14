import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, homeFor, setToken } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ErrorList, Field } from '../components/Shell.jsx';

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api('/health') });
  const { user } = useAuth();
  return (
    <div className="public">
      <header className="spread">
        <p className="brand">EcoQuest</p>
        <div className="row">
          {user ? <Link className="button" to={homeFor(user.role)}>Open your desk</Link> : (
            <>
              <Link to="/login">Log in</Link>
              <Link className="button" to="/register">Create a student account</Link>
            </>
          )}
        </div>
      </header>
      <section className="hero">
        <div>
          <p className="kicker">School environmental learning</p>
          <h1>Learn it, then do it.</h1>
          <p className="lede">
            Lessons, short quizzes, and real tasks for students. Teachers review the work.
            Eco-points and badges record what was actually approved.
          </p>
        </div>
        <aside className="panel stack">
          <h2>What you can do</h2>
          <p>Read a lesson, pass a quiz, and submit a task with a note or a photo.</p>
          <p className="muted">
            Service status: {health.isSuccess ? 'API and database are up' : health.isError ? 'API is not reachable' : 'Checking…'}
          </p>
        </aside>
      </section>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const account = await login(form.get('email'), form.get('password'));
      navigate(homeFor(account.role));
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="public">
      <p className="brand"><Link to="/">EcoQuest</Link></p>
      <form className="panel stack" onSubmit={onSubmit} style={{ maxWidth: 460 }}>
        <h1>Log in</h1>
        <ErrorList error={error} />
        <Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required minLength={8} /></Field>
        <button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Log in'}</button>
        <p>New student? <Link to="/register">Create an account</Link></p>
        {import.meta.env.DEV && (
          <p className="muted">
            Development accounts use the password EcoQuest123! — admin@ecoquest.test, teacher@ecoquest.test, student@ecoquest.test.
          </p>
        )}
      </form>
    </div>
  );
}

export function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = form.get('email');
    const password = form.get('password');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: { email, password, displayName: form.get('displayName') },
      });
      const session = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(session.accessToken);
      navigate('/learn');
      window.location.assign('/learn');
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return (
    <div className="public">
      <p className="brand"><Link to="/">EcoQuest</Link></p>
      <form className="panel stack" onSubmit={onSubmit} style={{ maxWidth: 460 }}>
        <h1>Student account</h1>
        <p className="muted">Accounts start as students. A school admin assigns your class and cannot be self-promoted.</p>
        <ErrorList error={error} />
        <Field label="Name"><input name="displayName" required minLength={2} maxLength={80} /></Field>
        <Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></Field>
        <button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
        <p>Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
