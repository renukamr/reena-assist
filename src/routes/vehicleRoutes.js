const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const { addVehicle, getVehicles, getVehicleById, deleteVehicle } = require('../controllers/vehicleController');

router.use(requireUser);

router.get('/', getVehicles);
router.post('/', addVehicle);
router.get('/:id', getVehicleById);
router.delete('/:id', deleteVehicle);

module.exports = router;
