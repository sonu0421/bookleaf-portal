import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
}

export function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="brand">📚 Book<span>Leaf</span> Support</div>
      <div className="userbox">
        <span>{user?.name} ({user?.role})</span>
        <button onClick={logout}>Logout</button>
      </div>
    </header>
  );
}

export function badgeClass(value) {
  return value.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
