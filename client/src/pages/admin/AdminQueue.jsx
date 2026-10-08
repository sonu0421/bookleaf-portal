import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Topbar, badgeClass, timeAgo } from '../../components/common';
import { ticketsApi, getSocket } from '../../services/api';

const STATUSES = ['', 'Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = ['', 'Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'];
const PRIORITIES = ['', 'Critical', 'High', 'Medium', 'Low'];

export default function AdminQueue() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });

  const load = () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    ticketsApi.list(params)
      .then((res) => setTickets(res.data.tickets))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    // Real-time: new tickets pop into the queue without refresh
    const socket = getSocket();
    const onNew = () => load();
    socket.on('ticket:created', onNew);
    return () => socket.off('ticket:created', onNew);
  }, []);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/admin">📊 Dashboard</Link>
          <Link to="/admin/queue" className="active">🎫 Ticket Queue</Link>
        </div>

        <div className="filters">
          <select value={filters.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <select value={filters.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c || 'All categories'}</option>)}
          </select>
          <select value={filters.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p || 'All priorities'}</option>)}
          </select>
          <input
            placeholder="Search subject / ticket no…"
            value={filters.search}
            onChange={set('search')}
            style={{ minWidth: '200px' }}
          />
        </div>

        {loading && <div className="loading">Loading…</div>}
        {!loading && tickets.length === 0 && <div className="empty">No tickets match these filters.</div>}
        {tickets.map((t) => (
          <Link key={t._id} to={`/admin/tickets/${t._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ticket-row">
              <div className="grow">
                <div className="subject">{t.ticketNo} — {t.subject}</div>
                <div className="meta">
                  {t.author?.name} · {t.book?.title || 'General'} · {t.messages.length} replies · {timeAgo(t.createdAt)}
                  {t.assignedTo && ` · 👤 ${t.assignedTo}`}
                </div>
              </div>
              <div className="badges">
                <span className={`badge ${badgeClass(t.status)}`}>{t.status}</span>
                <span className={`badge ${badgeClass(t.priority)}`}>{t.priority}</span>
                <span className="badge category">{t.category}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
