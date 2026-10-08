import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Topbar, badgeClass, timeAgo } from '../../components/common';
import { ticketsApi, getSocket } from '../../services/api';
import { useAuth } from '../../components/AuthContext';

export default function AuthorTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => ticketsApi.get(id).then((res) => setTicket(res.data.ticket));

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));

    // Real-time: join ticket room, listen for new messages / updates
    const socket = getSocket();
    socket.emit('ticket:join', id);
    const onMessage = () => load().catch(() => {});
    const onUpdate = () => load().catch(() => {});
    socket.on('ticket:message', onMessage);
    socket.on('ticket:updated', onUpdate);
    return () => {
      socket.off('ticket:message', onMessage);
      socket.off('ticket:updated', onUpdate);
      socket.emit('ticket:leave', id);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages?.length]);

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await ticketsApi.reply(id, reply.trim());
      setTicket(res.data.ticket);
      setReply('');
    } catch {
      // error shown via reload; keep it simple
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="app-shell"><Topbar /><div className="loading">Loading…</div></div>;
  if (!ticket) return <div className="app-shell"><Topbar /><div className="empty">Ticket not found.</div></div>;

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/">📖 My Books</Link>
          <Link to="/tickets" className="active">🎫 My Tickets</Link>
          <Link to="/tickets/new">➕ New Query</Link>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            <span className={`badge ${badgeClass(ticket.status)}`}>{ticket.status}</span>
            <span className={`badge ${badgeClass(ticket.priority)}`}>{ticket.priority}</span>
            <span className="badge category">{ticket.category}</span>
          </div>
          <h2 style={{ marginBottom: '0.3rem' }}>{ticket.ticketNo} — {ticket.subject}</h2>
          <div style={{ fontSize: '0.88rem', color: '#6b6259' }}>
            {ticket.book?.title ? `About "${ticket.book.title}"` : 'General / Account level'} · opened {timeAgo(ticket.createdAt)}
          </div>
          <p style={{ marginTop: '0.8rem', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
        </div>

        <div className="card">
          <h3>Conversation</h3>
          <div className="msg-list">
            {ticket.messages.length === 0 && (
              <div style={{ color: '#6b6259', fontSize: '0.9rem' }}>
                No replies yet — our team will respond shortly.
              </div>
            )}
            {ticket.messages.map((m, i) => (
              <div key={i} className={`msg ${m.senderRole}`}>
                <div className="who">{m.senderRole === 'admin' ? '🛠️ BookLeaf Support' : `👤 ${m.senderName}`}</div>
                {m.text}
                <div className="time">{timeAgo(m.createdAt)}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {ticket.status !== 'Closed' ? (
            <div className="reply-box">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <button className="btn" onClick={sendReply} disabled={sending || !reply.trim()}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="info-box">This ticket is closed.</div>
          )}
        </div>
      </div>
    </div>
  );
}
