const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
  getAllUsers,
  getAllMechanics,
  approveMechanic,
  getAllServices,
  getDashboardStats,
  toggleUserStatus,
} = require('../controllers/adminController');

router.use(requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUserStatus);
router.get('/mechanics', getAllMechanics);
router.put('/mechanics/:id/approve', approveMechanic);
router.get('/services', getAllServices);

module.exports = router;
