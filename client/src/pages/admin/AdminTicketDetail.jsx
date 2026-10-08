import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Topbar, badgeClass, timeAgo, fmtDate } from '../../components/common';
import { ticketsApi, adminApi, getSocket } from '../../services/api';
import { useAuth } from '../../components/AuthContext';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = ['Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export default function AdminTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [regenBusy, setRegenBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  const load = () => ticketsApi.get(id).then((res) => {
    setTicket(res.data.ticket);
    setDraft((d) => d || res.data.ticket.aiDraft || '');
  });

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
    const socket = getSocket();
    socket.emit('ticket:join', id);
    const refresh = () => load().catch(() => {});
    socket.on('ticket:message', refresh);
    socket.on('ticket:updated', refresh);
    return () => {
      socket.off('ticket:message', refresh);
      socket.off('ticket:updated', refresh);
      socket.emit('ticket:leave', id);
    };
  }, [id]);

  const patch = async (data) => {
    const res = await adminApi.updateTicket(id, data);
    setTicket(res.data.ticket);
  };

  const regenerate = async () => {
    setRegenBusy(true);
    try {
      const res = await adminApi.regenerateDraft(id);
      setDraft(res.data.aiDraft);
      setTicket((t) => ({ ...t, aiMeta: res.data.aiMeta }));
    } finally {
      setRegenBusy(false);
    }
  };

  const sendDraft = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await ticketsApi.reply(id, draft.trim());
      setTicket(res.data.ticket);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const res = await adminApi.addNote(id, note.trim());
    setTicket(res.data.ticket);
    setNote('');
  };

  const assignToMe = () => patch({ assignedTo: user.name });

  if (loading) return <div className="app-shell"><Topbar /><div className="loading">Loading…</div></div>;
  if (!ticket) return <div className="app-shell"><Topbar /><div className="empty">Ticket not found.</div></div>;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/admin">📊 Dashboard</Link>
          <Link to="/admin/queue" className="active">🎫 Ticket Queue</Link>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem', alignItems: 'center' }}>
            <span className={`badge ${badgeClass(ticket.status)}`}>{ticket.status}</span>
            <span className={`badge ${badgeClass(ticket.priority)}`}>{ticket.priority}</span>
            <span className="badge category">{ticket.category}</span>
            {ticket.aiMeta?.fallbackUsed
              ? <span className="badge fallback">⚠️ AI fallback (rule-based)</span>
              : ticket.aiMeta?.model && <span className="badge ai">🤖 {ticket.aiMeta.model}</span>}
          </div>
          <h2>{ticket.ticketNo} — {ticket.subject}</h2>
          <div style={{ fontSize: '0.9rem', color: '#6b6259', margin: '0.4rem 0' }}>
            👤 {ticket.author?.name} ({ticket.author?.email}, {ticket.author?.city || '—'})
            {ticket.assignedTo ? ` · Assigned to ${ticket.assignedTo}` : ' · Unassigned'}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.6rem' }}>{ticket.description}</p>

          {ticket.book && (
            <div style={{ marginTop: '1rem', background: '#f7f5f0', padding: '0.8rem', borderRadius: '8px', fontSize: '0.88rem' }}>
              <strong>📖 {ticket.book.title}</strong> · {ticket.book.status} · ISBN {ticket.book.isbn || '—'} ·
              Sold {ticket.book.copiesSold} · Royalty ₹{(ticket.book.royaltyEarned || 0).toLocaleString('en-IN')} earned /
              ₹{(ticket.book.royaltyPaid || 0).toLocaleString('en-IN')} paid /
              ₹{(ticket.book.royaltyPending || 0).toLocaleString('en-IN')} pending ·
              Last payout {fmtDate(ticket.book.lastRoyaltyPayoutDate)}
            </div>
          )}

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>Status</label>
              <select value={ticket.status} onChange={(e) => patch({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Assigned</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={ticket.assignedTo || ''} onChange={(e) => patch({ assignedTo: e.target.value })} placeholder="Admin name" />
                <button className="btn small secondary" onClick={assignToMe}>Me</button>
              </div>
            </div>
            <div className="form-group">
              <label>Category {ticket.categoryOverridden && '(overridden)'}</label>
              <select value={ticket.category} onChange={(e) => patch({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Priority {ticket.priorityOverridden && '(overridden)'}</label>
              <select value={ticket.priority} onChange={(e) => patch({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="ai-draft-box">
          <h4>🤖 AI-Drafted Response {ticket.aiMeta?.fallbackUsed && '(rule-based fallback — edit carefully)'}</h4>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="AI draft will appear here…" />
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn" onClick={sendDraft} disabled={sending || !draft.trim()}>
              {sending ? 'Sending…' : '✉️ Send to Author'}
            </button>
            <button className="btn secondary" onClick={regenerate} disabled={regenBusy}>
              {regenBusy ? 'Regenerating…' : '🔄 Regenerate'}
            </button>
          </div>
          {ticket.aiMeta?.promptTokens > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#6b6259', marginTop: '0.5rem' }}>
              Tokens used: {ticket.aiMeta.promptTokens} in / {ticket.aiMeta.completionTokens} out
            </div>
          )}
        </div>

        <div className="card">
          <h3>Conversation</h3>
          <div className="msg-list">
            {ticket.messages.length === 0 && <div style={{ color: '#6b6259' }}>No replies yet.</div>}
            {ticket.messages.map((m, i) => (
              <div key={i} className={`msg ${m.senderRole}`}>
                <div className="who">{m.senderRole === 'admin' ? `🛠️ ${m.senderName}` : `👤 ${m.senderName}`}</div>
                {m.text}
                <div className="time">{timeAgo(m.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>📝 Internal Notes <span style={{ fontWeight: 400, fontSize: '0.82rem', color: '#6b6259' }}>(never visible to author)</span></h3>
          {ticket.internalNotes.map((n, i) => (
            <div key={i} className="note-box">
              {n.text}
              <div className="who">{n.createdBy} · {timeAgo(n.createdAt)}</div>
            </div>
          ))}
          <div className="reply-box">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" />
            <button className="btn secondary" onClick={addNote}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
