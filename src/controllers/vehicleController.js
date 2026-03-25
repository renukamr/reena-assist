const axios = require('axios');
const Vehicle = require('../models/Vehicle');

// @desc    Add a vehicle (fetch info from RapidAPI)
// @route   POST /api/vehicles
const addVehicle = async (req, res) => {
  const { vehicleNumber } = req.body;

  if (!vehicleNumber) {
    return res.status(400).json({ success: false, message: 'Vehicle number is required.' });
  }

  const normalizedNumber = vehicleNumber.replace(/\s/g, '').toUpperCase();

  try {
    // Check if vehicle already exists for this user
    const existing = await Vehicle.findOne({ userId: req.user.id, vehicleNumber: normalizedNumber });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Vehicle already added to your account.' });
    }

    let vehicleData = {};
    let rawData = {};

    // Try to fetch from RapidAPI - Vehicle RC Information API
    try {
      const response = await axios.post(
        'https://vehicle-rc-information.p.rapidapi.com/advanced',
        { vehicle_number: normalizedNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY,
            'x-rapidapi-host': 'vehicle-rc-information.p.rapidapi.com',
          },
          timeout: 10000,
        }
      );

      rawData = response.data || {};

      // Map Vehicle RC Information API response fields
      vehicleData = {
        model: rawData.vehicle_model || rawData.model || rawData.rc_vehiclemodel || '',
        make: rawData.vehicle_make || rawData.make || rawData.rc_maker_desc || '',
        fuelType: (rawData.fuel_type || rawData.rc_fuel_desc || rawData.fuel || '').toUpperCase(),
        ownerName: rawData.owner_name || rawData.rc_owner_name || rawData.registered_owner || '',
        chassisNumber: rawData.chassis_number || rawData.rc_chasi_no || '',
        engineNumber: rawData.engine_number || rawData.rc_eng_no || '',
        vehicleClass: rawData.vehicle_class || rawData.rc_vch_cd_desc || '',
        color: rawData.color || rawData.rc_color || rawData.colour || '',
        registrationDate: rawData.registration_date || rawData.rc_regn_dt || null,
        insuranceExpiry: rawData.insurance_upto || rawData.rc_insurance_upto || rawData.insurance_expiry || null,
        pucExpiry: rawData.pucc_upto || rawData.rc_pucc_upto || null,
      };
    } catch (apiError) {
      console.warn('RapidAPI fetch failed, saving with basic info:', apiError.message);
      // Continue without API data - save with just vehicle number
    }

    const vehicle = await Vehicle.create({
      userId: req.user.id,
      vehicleNumber: normalizedNumber,
      ...vehicleData,
      rawData,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully.',
      data: { vehicle },
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ success: false, message: 'Server error while adding vehicle.' });
  }
};

// @desc    Get all vehicles for user
// @route   GET /api/vehicles
const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ userId: req.user.id, isActive: true }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { vehicles, count: vehicles.length },
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching vehicles.' });
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, userId: req.user.id, isActive: true });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    res.json({ success: true, data: { vehicle } });
  } catch (error) {
    console.error('Get vehicle by id error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, userId: req.user.id });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    vehicle.isActive = false;
    await vehicle.save();

    res.json({ success: true, message: 'Vehicle removed successfully.' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting vehicle.' });
  }
};

module.exports = { addVehicle, getVehicles, getVehicleById, deleteVehicle };
