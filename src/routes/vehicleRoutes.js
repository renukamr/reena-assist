const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const {
  lookupVehicle,
  addVehicle,
  getVehicles,
  getVehicleById,
  deleteVehicle,
} = require('../controllers/vehicleController');

// All vehicle routes require user authentication
router.use(requireUser);

// IMPORTANT: /lookup must be declared before /:id to avoid route conflict
router.get('/lookup', lookupVehicle);   // GET /api/vehicles/lookup?number=TN72CZ4930

router.get('/', getVehicles);           // GET /api/vehicles
router.post('/', addVehicle);           // POST /api/vehicles
router.get('/:id', getVehicleById);     // GET /api/vehicles/:id
router.delete('/:id', deleteVehicle);   // DELETE /api/vehicles/:id

module.exports = router;
