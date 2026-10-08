import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Topbar, timeAgo } from '../../components/common';
import { adminApi } from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const countFor = (arr, key) => arr?.find((x) => x._id === key)?.count || 0;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/admin" className="active">📊 Dashboard</Link>
          <Link to="/admin/queue">🎫 Ticket Queue</Link>
        </div>

        {loading && <div className="loading">Loading…</div>}
        {stats && (
          <>
            <div className="grid cols-3" style={{ marginBottom: '1.5rem' }}>
              <div className="card stat"><div className="num">{stats.total}</div><div className="lbl">Total Tickets</div></div>
              <div className="card stat"><div className="num">{countFor(stats.byStatus, 'Open')}</div><div className="lbl">Open</div></div>
              <div className="card stat"><div className="num">{countFor(stats.byPriority, 'Critical') + countFor(stats.byPriority, 'High')}</div><div className="lbl">Critical + High</div></div>
            </div>

            <div className="card">
              <h3>⚠️ Oldest Unresolved — needs attention</h3>
              {stats.oldestOpen.length === 0 && <p style={{ color: '#6b6259' }}>Queue is clear. Nice work!</p>}
              {stats.oldestOpen.map((t) => (
                <Link key={t._id} to={`/admin/tickets/${t._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="ticket-row">
                    <div className="grow">
                      <div className="subject">{t.ticketNo} — {t.subject}</div>
                      <div className="meta">{t.author?.name} · waiting {timeAgo(t.createdAt)}</div>
                    </div>
                    <span className={`badge ${t.priority.toLowerCase()}`}>{t.priority}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
