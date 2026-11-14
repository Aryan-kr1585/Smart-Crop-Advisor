import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export function Shell({ links }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <p className="brand">EcoQuest</p>
        <nav aria-label="Main">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
          ))}
        </nav>
        <div className="who">
          <p>{user?.displayName}</p>
          <p className="muted">{user?.role === 'STUDENT' ? 'Student' : user?.role === 'TEACHER' ? 'Teacher' : 'Admin'}</p>
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main id="main" className="content">
        <Outlet />
      </main>
    </div>
  );
}

export function QueryState({ query, children }) {
  if (query.isLoading) return <p className="status" role="status">Loading…</p>;
  if (query.isError) return <ErrorList error={query.error} />;
  return children(query.data);
}

export function ErrorList({ error }) {
  if (!error) return null;
  return (
    <div className="banner error" role="alert">
      <p>{error.message}</p>
      {error.details?.length > 0 && (
        <ul>
          {error.details.map((detail) => (
            <li key={`${detail.path}-${detail.message}`}>{detail.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
