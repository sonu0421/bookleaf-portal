import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import { ProtectedRoute } from './components/common';
import Login from './pages/Login';
import AuthorHome from './pages/author/AuthorHome';
import AuthorTickets from './pages/author/AuthorTickets';
import NewTicket from './pages/author/NewTicket';
import AuthorTicketDetail from './pages/author/AuthorTicketDetail';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminQueue from './pages/admin/AdminQueue';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';

function RoleHome() {
  return (
    <ProtectedRoute>
      <RoleRedirect />
    </ProtectedRoute>
  );
}

import { useAuth } from './components/AuthContext';
function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/books'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Author routes */}
          <Route path="/" element={<RoleHome />} />
          <Route path="/books" element={<ProtectedRoute role="author"><AuthorHome /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute role="author"><AuthorTickets /></ProtectedRoute>} />
          <Route path="/tickets/new" element={<ProtectedRoute role="author"><NewTicket /></ProtectedRoute>} />
          <Route path="/tickets/:id" element={<ProtectedRoute role="author"><AuthorTicketDetail /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/queue" element={<ProtectedRoute role="admin"><AdminQueue /></ProtectedRoute>} />
          <Route path="/admin/tickets/:id" element={<ProtectedRoute role="admin"><AdminTicketDetail /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
