const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const seedAdmin = require('./src/utils/adminSeeder');

dotenv.config();

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// DB connection middleware — runs on every request in serverless.
// If the DB is already connected (cached), this is near-zero overhead.
// If the DB is unavailable, returns a clear 503 instead of crashing.
// ---------------------------------------------------------------------------
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('DB connection failed for request:', req.path, error.message);
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable. Please try again in a moment.',
    });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/vehicles', require('./src/routes/vehicleRoutes'));
app.use('/api/services', require('./src/routes/serviceRequestRoutes'));
app.use('/api/mechanic', require('./src/routes/mechanicRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/profile', require('./src/routes/profileRoutes'));

// Health check — intentionally before DB middleware above is not needed here
// since the DB middleware applies to all routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'V-ASSIST API is running',
    timestamp: new Date().toISOString(),
    db: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  const { handleError } = require('./src/utils/errorHandler');
  handleError(res, err, `${req.method} ${req.originalUrl}`);
});

// ---------------------------------------------------------------------------
// Seed admin after first successful DB connection (runs only once per instance)
// ---------------------------------------------------------------------------
connectDB()
  .then(() => seedAdmin())
  .catch((err) => console.warn('Initial DB connect/seed skipped:', err.message));

// ---------------------------------------------------------------------------
// Local dev only — Vercel does NOT call app.listen (it uses module.exports)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`V-ASSIST server running on port ${PORT}`);
  });
}

module.exports = app;
