const ServiceRequest = require('../models/ServiceRequest');
const Vehicle = require('../models/Vehicle');
const Mechanic = require('../models/Mechanic');

// @desc    Create a service request
// @route   POST /api/services
const createRequest = async (req, res) => {
  const { serviceType, vehicleId, location, description } = req.body;

  if (!serviceType) {
    return res.status(400).json({ success: false, message: 'Service type is required.' });
  }

  const validTypes = ['fuel_delivery', 'battery_jumpstart', 'mechanic_support', 'puncture_repair', 'engine_repair', 'breakdown_help', 'taxi_request'];
  if (!validTypes.includes(serviceType)) {
    return res.status(400).json({ success: false, message: 'Invalid service type.' });
  }

  try {
    // Validate vehicleId if provided
    if (vehicleId) {
      const vehicle = await Vehicle.findOne({ _id: vehicleId, userId: req.user.id });
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Vehicle not found.' });
      }
    }

    // Estimate price based on service type
    const pricingMap = {
      fuel_delivery: 150,
      battery_jumpstart: 200,
      mechanic_support: 300,
      puncture_repair: 250,
      engine_repair: 500,
      breakdown_help: 350,
      taxi_request: 100,
    };

    const serviceRequest = await ServiceRequest.create({
      userId: req.user.id,
      vehicleId: vehicleId || null,
      serviceType,
      location: location || { type: 'Point', coordinates: [0, 0], address: '' },
      description: description || '',
      price: { estimated: pricingMap[serviceType] || 200, final: 0 },
    });

    await serviceRequest.populate('vehicleId', 'vehicleNumber model make');

    res.status(201).json({
      success: true,
      message: 'Service request created successfully.',
      data: { serviceRequest },
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating service request.' });
  }
};

// @desc    Get user's service requests
// @route   GET /api/services/my
const getMyRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status ? { status: req.query.status } : {};

    const requests = await ServiceRequest.find({ userId: req.user.id, ...statusFilter })
      .populate('vehicleId', 'vehicleNumber model make')
      .populate('mechanicId', 'name phone profileImage rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ServiceRequest.countDocuments({ userId: req.user.id, ...statusFilter });

    res.json({
      success: true,
      data: {
        requests,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching requests.' });
  }
};

// @desc    Update service request status
// @route   PUT /api/services/:id/status
const updateStatus = async (req, res) => {
  const { status, notes, finalPrice } = req.body;

  const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    // Check authorization - user can only cancel their own, mechanic can update assigned
    const isOwner = request.userId.toString() === req.user.id;
    const isAssignedMechanic = request.mechanicId && request.mechanicId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedMechanic && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this request.' });
    }

    if (isOwner && req.user.role === 'user' && status !== 'cancelled') {
      return res.status(403).json({ success: false, message: 'Users can only cancel requests.' });
    }

    request.status = status;
    if (notes) request.notes = notes;
    if (finalPrice) request.price.final = finalPrice;
    if (status === 'completed') {
      request.completedAt = new Date();
    }

    await request.save();
    await request.populate('vehicleId', 'vehicleNumber model');
    await request.populate('mechanicId', 'name phone');

    res.json({
      success: true,
      message: `Request status updated to ${status}.`,
      data: { request },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating status.' });
  }
};

// @desc    Get all service requests (admin)
// @route   GET /api/services/all
const getAllRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;

    const requests = await ServiceRequest.find(filter)
      .populate('userId', 'name email phone')
      .populate('mechanicId', 'name phone')
      .populate('vehicleId', 'vehicleNumber model')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ServiceRequest.countDocuments(filter);

    res.json({
      success: true,
      data: {
        requests,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Assign mechanic to service request (admin)
// @route   PUT /api/services/:id/assign
const assignMechanic = async (req, res) => {
  const { mechanicId } = req.body;

  if (!mechanicId) {
    return res.status(400).json({ success: false, message: 'Mechanic ID is required.' });
  }

  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic || !mechanic.isApproved) {
      return res.status(404).json({ success: false, message: 'Mechanic not found or not approved.' });
    }

    request.mechanicId = mechanicId;
    request.status = 'accepted';
    await request.save();

    mechanic.activeJobs += 1;
    await mechanic.save();

    await request.populate('mechanicId', 'name phone profileImage rating');

    res.json({
      success: true,
      message: 'Mechanic assigned successfully.',
      data: { request },
    });
  } catch (error) {
    console.error('Assign mechanic error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createRequest, getMyRequests, updateStatus, getAllRequests, assignMechanic };
