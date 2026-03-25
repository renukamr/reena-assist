const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin, verifyToken } = require('../middleware/auth');
const {
  createRequest,
  getMyRequests,
  updateStatus,
  getAllRequests,
  assignMechanic,
} = require('../controllers/serviceRequestController');

// User routes
router.post('/', requireUser, createRequest);
router.get('/my', requireUser, getMyRequests);
router.put('/:id/status', verifyToken, updateStatus);

// Admin routes
router.get('/all', requireAdmin, getAllRequests);
router.put('/:id/assign', requireAdmin, assignMechanic);

module.exports = router;
