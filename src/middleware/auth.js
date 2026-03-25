const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');

const verifyToken = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const requireUser = async (req, res, next) => {
  await verifyToken(req, res, async () => {
    if (req.user.role !== 'user' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. User role required.' });
    }
    try {
      const user = await User.findById(req.user.id);
      if (!user || !user.isActive) {
        return res.status(403).json({ success: false, message: 'Account not found or deactivated.' });
      }
      req.userDoc = user;
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Server error during auth check.' });
    }
  });
};

const requireMechanic = async (req, res, next) => {
  await verifyToken(req, res, async () => {
    if (req.user.role !== 'mechanic') {
      return res.status(403).json({ success: false, message: 'Access denied. Mechanic role required.' });
    }
    try {
      const mechanic = await Mechanic.findById(req.user.id);
      if (!mechanic || !mechanic.isActive) {
        return res.status(403).json({ success: false, message: 'Mechanic account not found or deactivated.' });
      }
      if (!mechanic.isApproved) {
        return res.status(403).json({ success: false, message: 'Your account is pending approval by admin.' });
      }
      req.mechanicDoc = mechanic;
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Server error during auth check.' });
    }
  });
};

const requireAdmin = async (req, res, next) => {
  await verifyToken(req, res, async () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
    }
    next();
  });
};

const requireAuth = verifyToken;

module.exports = { verifyToken, requireUser, requireMechanic, requireAdmin, requireAuth };
