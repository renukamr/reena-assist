const axios = require('axios');
const Vehicle = require('../models/Vehicle');
const { handleError } = require('../utils/errorHandler');

// Valid Indian vehicle number pattern: e.g. TN72CZ4930, MH12AB1234
const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;

/**
 * Maps RapidAPI response to our Vehicle schema fields.
 * Tries multiple known field names across different API versions.
 */
const mapApiResponse = (raw) => {
  const getString = (...keys) => {
    for (const key of keys) {
      if (raw[key] && typeof raw[key] === 'string' && raw[key].trim()) {
        return raw[key].trim();
      }
    }
    return '';
  };

  const getDate = (...keys) => {
    for (const key of keys) {
      if (raw[key]) {
        const d = new Date(raw[key]);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  return {
    model: getString('vehicle_model', 'model', 'rc_vehiclemodel', 'veh_model'),
    make: getString('vehicle_make', 'make', 'rc_maker_desc', 'maker_model'),
    fuelType: getString('fuel_type', 'rc_fuel_desc', 'fuel', 'fuel_type_desc').toUpperCase(),
    ownerName: getString('owner_name', 'rc_owner_name', 'registered_owner', 'owner'),
    chassisNumber: getString('chassis_number', 'rc_chasi_no', 'chasis_no', 'chassis_no'),
    engineNumber: getString('engine_number', 'rc_eng_no', 'eng_no', 'engine_no'),
    vehicleClass: getString('vehicle_class', 'rc_vch_cd_desc', 'veh_class', 'class_desc'),
    color: getString('color', 'rc_color', 'colour', 'body_colour'),
    registrationDate: getDate('registration_date', 'rc_regn_dt', 'regn_date', 'reg_date'),
    insuranceExpiry: getDate('insurance_upto', 'rc_insurance_upto', 'insurance_expiry', 'insurance_valid_upto'),
    pucExpiry: getDate('pucc_upto', 'rc_pucc_upto', 'puc_upto', 'pucc_valid_upto'),
  };
};

/**
 * Check if a mapped vehicle data object has any meaningful data
 */
const hasMeaningfulData = (data) => {
  return !!(data.model || data.make || data.ownerName || data.fuelType || data.chassisNumber);
};

/**
 * Calls RapidAPI to fetch vehicle info. Returns { vehicleData, rawData, source }.
 * Does NOT write to database. Throws on critical failure.
 */
const fetchFromRapidAPI = async (vehicleNumber) => {
  const primaryHost = process.env.RAPIDAPI_HOST || 'vehicle-rc-information.p.rapidapi.com';
  const fallbackHost = 'vehicle-info-by-registration-plate.p.rapidapi.com';
  const apiKey = process.env.RAPIDAPI_KEY;

  // --- Primary API attempt ---
  try {
    const response = await axios.post(
      `https://${primaryHost}/advanced`,
      { vehicle_number: vehicleNumber },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': primaryHost,
        },
        timeout: 10000,
      }
    );

    const raw = response.data || {};
    const mapped = mapApiResponse(raw);

    if (hasMeaningfulData(mapped)) {
      return { vehicleData: mapped, rawData: raw, source: 'primary' };
    }

    console.warn(`Primary API returned empty data for ${vehicleNumber}. Trying fallback.`);
  } catch (primaryError) {
    console.warn(`Primary API failed for ${vehicleNumber}: ${primaryError.message}. Trying fallback.`);
  }

  // --- Fallback API attempt ---
  try {
    const response = await axios.get(
      `https://${fallbackHost}/api/v1/rc-details`,
      {
        params: { reg_no: vehicleNumber },
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': fallbackHost,
        },
        timeout: 10000,
      }
    );

    const raw = response.data?.result || response.data || {};
    const mapped = mapApiResponse(raw);

    if (hasMeaningfulData(mapped)) {
      return { vehicleData: mapped, rawData: raw, source: 'fallback' };
    }

    console.warn(`Fallback API also returned empty data for ${vehicleNumber}.`);
  } catch (fallbackError) {
    console.warn(`Fallback API also failed for ${vehicleNumber}: ${fallbackError.message}.`);
  }

  return { vehicleData: null, rawData: {}, source: 'none' };
};

// @desc    Lookup vehicle info from external API (does NOT save to DB)
// @route   GET /api/vehicles/lookup?number=TN72CZ4930
const lookupVehicle = async (req, res) => {
  const vehicleNumber = (req.query.number || '').replace(/\s/g, '').toUpperCase();

  if (!vehicleNumber) {
    return res.status(400).json({ success: false, message: 'Vehicle number is required. Use ?number=TN72CZ4930' });
  }

  if (!VEHICLE_NUMBER_REGEX.test(vehicleNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vehicle number format. Expected format: TN72CZ4930 (State code + district + series + number)',
    });
  }

  try {
    const { vehicleData, rawData, source } = await fetchFromRapidAPI(vehicleNumber);

    if (!vehicleData) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle data not available from the registry for this number. The vehicle may be recently registered or the registry may be temporarily unavailable. You can still add the vehicle manually.',
        vehicleNumber,
      });
    }

    res.json({
      success: true,
      message: 'Vehicle data fetched successfully.',
      data: {
        vehicleNumber,
        ...vehicleData,
        _source: source,
      },
    });
  } catch (error) {
    return handleError(res, error, 'lookupVehicle');
  }
};

// @desc    Add a vehicle to the user's account (saves to DB)
// @route   POST /api/vehicles
const addVehicle = async (req, res) => {
  const { vehicleNumber, model, make, fuelType, ownerName, chassisNumber,
          engineNumber, vehicleClass, color, registrationDate, insuranceExpiry, pucExpiry } = req.body;

  if (!vehicleNumber) {
    return res.status(400).json({ success: false, message: 'Vehicle number is required.' });
  }

  const normalizedNumber = vehicleNumber.replace(/\s/g, '').toUpperCase();

  if (!VEHICLE_NUMBER_REGEX.test(normalizedNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vehicle number format. Expected format: TN72CZ4930',
    });
  }

  try {
    const existing = await Vehicle.findOne({ userId: req.user.id, vehicleNumber: normalizedNumber, isActive: true });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This vehicle is already added to your account.' });
    }

    const vehicle = await Vehicle.create({
      userId: req.user.id,
      vehicleNumber: normalizedNumber,
      model: model || '',
      make: make || '',
      fuelType: fuelType || '',
      ownerName: ownerName || '',
      chassisNumber: chassisNumber || '',
      engineNumber: engineNumber || '',
      vehicleClass: vehicleClass || '',
      color: color || '',
      registrationDate: registrationDate || null,
      insuranceExpiry: insuranceExpiry || null,
      pucExpiry: pucExpiry || null,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully.',
      data: { vehicle },
    });
  } catch (error) {
    return handleError(res, error, 'addVehicle');
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
    return handleError(res, error, 'getVehicles');
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
    return handleError(res, error, 'getVehicleById');
  }
};

// @desc    Soft-delete vehicle
// @route   DELETE /api/vehicles/:id
const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, userId: req.user.id, isActive: true });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    vehicle.isActive = false;
    await vehicle.save();

    res.json({ success: true, message: 'Vehicle removed successfully.' });
  } catch (error) {
    return handleError(res, error, 'deleteVehicle');
  }
};

module.exports = { lookupVehicle, addVehicle, getVehicles, getVehicleById, deleteVehicle };
