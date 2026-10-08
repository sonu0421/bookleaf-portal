/** Central error handler — meaningful errors, never raw stacks in production. */
export function errorHandler(err, req, res, _next) {
  console.error('[error]', err.message);

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', field: Object.keys(err.keyValue || {}) });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Something went wrong. Please try again.',
  });
}

/** 404 for unknown API routes */
export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}
