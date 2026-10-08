import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Topbar } from '../../components/common';
import { booksApi, ticketsApi } from '../../services/api';

export default function NewTicket() {
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    booksApi.list().then((res) => setBooks(res.data.books)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (description.trim().length < 10) {
      setError('Please describe your query in at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await ticketsApi.create({
        bookId: bookId || undefined,
        subject: subject.trim(),
        description: description.trim(),
      });
      navigate(`/tickets/${res.data.ticket._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar />
      <div className="main">
        <div className="tabs">
          <Link to="/">📖 My Books</Link>
          <Link to="/tickets">🎫 My Tickets</Link>
          <Link to="/tickets/new" className="active">➕ New Query</Link>
        </div>

        <div className="card" style={{ maxWidth: '700px' }}>
          <h3>Submit a Support Query</h3>
          <p style={{ color: '#6b6259', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
            Our AI will categorise your query instantly and our team will respond shortly.
          </p>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Which book is this about?</label>
              <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
                <option value="">General / Account Level</option>
                {books.map((b) => (
                  <option key={b._id} value={b._id}>{b.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Royalty payment not received for last quarter"
                required
                minLength={3}
                maxLength={200}
              />
            </div>
            <div className="form-group">
              <label>Describe your query in detail</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include relevant details — dates, amounts, order IDs, what you expected vs what happened…"
                required
              />
            </div>
            <div className="form-group">
              <label>Attachment (optional, UI only)</label>
              <input type="file" disabled title="Attachment upload is UI-only in this demo" />
            </div>
            <button className="btn" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Query'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
