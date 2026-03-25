const Mechanic = require('../models/Mechanic');
const ServiceRequest = require('../models/ServiceRequest');

// @desc    Get nearby service requests for mechanic
// @route   GET /api/mechanic/requests
const getNearbyRequests = async (req, res) => {
  try {
    const { lat, lng, radius = 20 } = req.query;

    let filter = { status: 'pending', mechanicId: null };

    let requests;
    if (lat && lng) {
      const radiusInMeters = parseFloat(radius) * 1000;
      requests = await ServiceRequest.find({
        ...filter,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: radiusInMeters,
          },
        },
      })
        .populate('userId', 'name phone')
        .populate('vehicleId', 'vehicleNumber model make')
        .limit(20);
    } else {
      requests = await ServiceRequest.find(filter)
        .populate('userId', 'name phone')
        .populate('vehicleId', 'vehicleNumber model make')
        .sort({ createdAt: -1 })
        .limit(20);
    }

    res.json({
      success: true,
      data: { requests, count: requests.length },
    });
  } catch (error) {
    console.error('Get nearby requests error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Mechanic accepts a job
// @route   PUT /api/mechanic/accept/:id
const acceptJob = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request is no longer available.' });
    }

    if (request.mechanicId) {
      return res.status(400).json({ success: false, message: 'This request has already been assigned.' });
    }

    request.mechanicId = req.user.id;
    request.status = 'accepted';
    await request.save();

    const mechanic = await Mechanic.findById(req.user.id);
    if (mechanic) {
      mechanic.activeJobs += 1;
      await mechanic.save();
    }

    await request.populate('userId', 'name phone');
    await request.populate('vehicleId', 'vehicleNumber model');

    res.json({
      success: true,
      message: 'Job accepted successfully.',
      data: { request },
    });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Update job progress
// @route   PUT /api/mechanic/progress/:id
const updateProgress = async (req, res) => {
  const { status, notes, finalPrice } = req.body;

  const validStatuses = ['in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for mechanic update.' });
  }

  try {
    const request = await ServiceRequest.findOne({
      _id: req.params.id,
      mechanicId: req.user.id,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found or not assigned to you.' });
    }

    request.status = status;
    if (notes) request.notes = notes;
    if (finalPrice) request.price.final = parseFloat(finalPrice);

    if (status === 'completed') {
      request.completedAt = new Date();
      const mechanic = await Mechanic.findById(req.user.id);
      if (mechanic && mechanic.activeJobs > 0) {
        mechanic.activeJobs -= 1;
        await mechanic.save();
      }
    }

    await request.save();
    await request.populate('userId', 'name phone');

    res.json({
      success: true,
      message: `Job status updated to ${status}.`,
      data: { request },
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get mechanic's jobs
// @route   GET /api/mechanic/jobs
const getMyJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = { mechanicId: req.user.id };
    if (req.query.status) filter.status = req.query.status;

    const jobs = await ServiceRequest.find(filter)
      .populate('userId', 'name phone')
      .populate('vehicleId', 'vehicleNumber model make')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ServiceRequest.countDocuments(filter);

    res.json({
      success: true,
      data: { jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get mechanic profile
// @route   GET /api/mechanic/profile
const getMechanicProfile = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.user.id).select('-password');

    if (!mechanic) {
      return res.status(404).json({ success: false, message: 'Mechanic not found.' });
    }

    const completedJobs = await ServiceRequest.countDocuments({
      mechanicId: req.user.id,
      status: 'completed',
    });

    const totalEarnings = await ServiceRequest.aggregate([
      { $match: { mechanicId: mechanic._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price.final' } } },
    ]);

    res.json({
      success: true,
      data: {
        mechanic,
        stats: {
          completedJobs,
          activeJobs: mechanic.activeJobs,
          totalEarnings: totalEarnings[0]?.total || 0,
          rating: mechanic.rating,
        },
      },
    });
  } catch (error) {
    console.error('Get mechanic profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Update mechanic location
// @route   PUT /api/mechanic/location
const updateLocation = async (req, res) => {
  const { lat, lng, address } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
  }

  try {
    const mechanic = await Mechanic.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)],
          address: address || '',
        },
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Location updated.',
      data: { location: mechanic.location },
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getNearbyRequests, acceptJob, updateProgress, getMyJobs, getMechanicProfile, updateLocation };
