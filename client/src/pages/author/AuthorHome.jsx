import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Topbar, fmtDate } from '../../components/common';
import { booksApi, ticketsApi } from '../../services/api';

export default function AuthorHome() {
  const [books, setBooks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([booksApi.list(), ticketsApi.list()])
      .then(([b, t]) => {
        setBooks(b.data.books);
        setTickets(t.data.tickets);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPending = books.reduce((s, b) => s + (b.royaltyPending || 0), 0);
  const openTickets = tickets.filter((t) => ['Open', 'In Progress'].includes(t.status)).length;

  if (loading) return <div className="app-shell"><Topbar /><div className="loading">Loading…</div></div>;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/" className="active">📖 My Books</Link>
          <Link to="/tickets">🎫 My Tickets {openTickets > 0 && `(${openTickets})`}</Link>
          <Link to="/tickets/new">➕ New Query</Link>
        </div>

        <div className="grid cols-3" style={{ marginBottom: '1.5rem' }}>
          <div className="card stat"><div className="num">{books.length}</div><div className="lbl">Published Books</div></div>
          <div className="card stat"><div className="num">₹{totalPending.toLocaleString('en-IN')}</div><div className="lbl">Royalty Pending</div></div>
          <div className="card stat"><div className="num">{openTickets}</div><div className="lbl">Open Tickets</div></div>
        </div>

        {books.length === 0 && <div className="empty">No books found.</div>}

        <div className="grid cols-2">
          {books.map((b) => (
            <div className="card" key={b._id}>
              <h3>{b.title}</h3>
              <div style={{ fontSize: '0.88rem', color: '#6b6259', marginBottom: '0.5rem' }}>
                {b.genre} · ISBN {b.isbn || '—'} · {b.status}
              </div>
              <div className="book-detail-grid">
                <div className="kv"><div className="k">MRP</div><div className="v">{b.mrp ? `₹${b.mrp}` : '—'}</div></div>
                <div className="kv"><div className="k">Copies Sold</div><div className="v">{b.copiesSold}</div></div>
                <div className="kv"><div className="k">Earned</div><div className="v">₹{(b.royaltyEarned || 0).toLocaleString('en-IN')}</div></div>
                <div className="kv"><div className="k">Paid</div><div className="v">₹{(b.royaltyPaid || 0).toLocaleString('en-IN')}</div></div>
                <div className="kv"><div className="k">Pending</div><div className="v">₹{(b.royaltyPending || 0).toLocaleString('en-IN')}</div></div>
                <div className="kv"><div className="k">Published</div><div className="v" style={{ fontSize: '0.9rem' }}>{fmtDate(b.publicationDate)}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
