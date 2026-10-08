import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Topbar, badgeClass, timeAgo } from '../../components/common';
import { ticketsApi } from '../../services/api';

export default function AuthorTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketsApi.list()
      .then((res) => setTickets(res.data.tickets))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/">📖 My Books</Link>
          <Link to="/tickets" className="active">🎫 My Tickets</Link>
          <Link to="/tickets/new">➕ New Query</Link>
        </div>

        {loading && <div className="loading">Loading tickets…</div>}
        {!loading && tickets.length === 0 && (
          <div className="empty">
            <p>No tickets yet.</p>
            <p style={{ marginTop: '0.5rem' }}><Link to="/tickets/new">Raise your first query →</Link></p>
          </div>
        )}
        {tickets.map((t) => (
          <Link key={t._id} to={`/tickets/${t._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ticket-row">
              <div className="grow">
                <div className="subject">{t.ticketNo} — {t.subject}</div>
                <div className="meta">
                  {t.book?.title || 'General / Account'} · {t.messages.length} replies · {timeAgo(t.updatedAt)}
                </div>
              </div>
              <div className="badges">
                <span className={`badge ${badgeClass(t.status)}`}>{t.status}</span>
                <span className={`badge ${badgeClass(t.priority)}`}>{t.priority}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
