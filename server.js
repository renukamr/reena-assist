const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const seedAdmin = require('./src/utils/adminSeeder');

dotenv.config();

const app = express();

// Connect to MongoDB then seed admin
connectDB()
  .then(() => seedAdmin())
  .catch((err) => console.warn('Initial DB connect/seed skipped:', err.message));

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/vehicles', require('./src/routes/vehicleRoutes'));
app.use('/api/services', require('./src/routes/serviceRequestRoutes'));
app.use('/api/mechanic', require('./src/routes/mechanicRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/profile', require('./src/routes/profileRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'V-ASSIST API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler — catches errors passed via next(err)
app.use((err, req, res, next) => {
  const { handleError } = require('./src/utils/errorHandler');
  handleError(res, err, `${req.method} ${req.originalUrl}`);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`V-ASSIST server running on port ${PORT}`);
});

module.exports = app;
