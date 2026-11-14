import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, homeFor } from '../lib/api.js';
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
        <p><Link to="/forgot-password">Forgot your password?</Link></p>
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

export function ForgotPassword() {
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [developmentResetUrl, setDevelopmentResetUrl] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setMessage('');
    setDevelopmentResetUrl('');
    setPending(true);
    try {
      const form = new FormData(event.currentTarget);
      const result = await api('/auth/password-reset-requests', {
        method: 'POST', body: { email: form.get('email') },
      });
      setMessage(result.message);
      setDevelopmentResetUrl(result.developmentResetUrl ?? '');
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
        <h1>Reset your password</h1>
        <p className="muted">Enter your account email. If it matches an active account, we’ll send a reset link.</p>
        <ErrorList error={error} />
        {message && <p className="banner" role="status">{message}</p>}
        {developmentResetUrl && <p><a href={developmentResetUrl}>Open local development reset link</a></p>}
        <Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field>
        <button type="submit" disabled={pending}>{pending ? 'Requesting…' : 'Send reset link'}</button>
        <p><Link to="/login">Back to log in</Link></p>
      </form>
    </div>
  );
}

export function ResetPassword() {
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setMessage('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    if (form.get('password') !== form.get('confirmPassword')) {
      setError(new Error('The passwords do not match.'));
      setPending(false);
      return;
    }
    try {
      const result = await api('/auth/password-resets', {
        method: 'POST', body: { token, password: form.get('password') },
      });
      setMessage(result.message);
      formElement.reset();
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
        <h1>Choose a new password</h1>
        <ErrorList error={error} />
        {message && <p className="banner" role="status">{message} <Link to="/login">Log in</Link></p>}
        {!token && <p className="banner error" role="alert">This reset link is missing its token. Request a new link.</p>}
        <Field label="New password"><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></Field>
        <Field label="Confirm password"><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></Field>
        <button type="submit" disabled={pending || !token}>{pending ? 'Saving…' : 'Set new password'}</button>
        <p><Link to="/forgot-password">Request another reset link</Link></p>
      </form>
    </div>
  );
}

export function Register() {
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
    const email = form.get('email');
    const password = form.get('password');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: { email, password, displayName: form.get('displayName') },
      });
      await login(email, password);
      navigate('/learn');
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
