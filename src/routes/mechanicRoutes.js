const express = require('express');
const router = express.Router();
const { requireMechanic } = require('../middleware/auth');
const {
  getNearbyRequests,
  acceptJob,
  updateProgress,
  getMyJobs,
  getMechanicProfile,
  updateLocation,
} = require('../controllers/mechanicController');

router.use(requireMechanic);

router.get('/requests', getNearbyRequests);
router.put('/accept/:id', acceptJob);
router.put('/progress/:id', updateProgress);
router.get('/jobs', getMyJobs);
router.get('/profile', getMechanicProfile);
router.put('/location', updateLocation);

module.exports = router;
