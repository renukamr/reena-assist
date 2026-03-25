const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
const ServiceRequest = require('../models/ServiceRequest');
const Vehicle = require('../models/Vehicle');
const Payment = require('../models/Payment');

// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const filter = search
      ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
      : {};

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get all mechanics
// @route   GET /api/admin/mechanics
const getAllMechanics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const isApproved = req.query.isApproved;

    const filter = {};
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

    const mechanics = await Mechanic.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Mechanic.countDocuments(filter);

    res.json({
      success: true,
      data: {
        mechanics,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get all mechanics error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Approve or reject mechanic
// @route   PUT /api/admin/mechanics/:id/approve
const approveMechanic = async (req, res) => {
  const { isApproved, reason } = req.body;

  if (typeof isApproved !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isApproved (boolean) is required.' });
  }

  try {
    const mechanic = await Mechanic.findById(req.params.id).select('-password');

    if (!mechanic) {
      return res.status(404).json({ success: false, message: 'Mechanic not found.' });
    }

    mechanic.isApproved = isApproved;
    await mechanic.save();

    res.json({
      success: true,
      message: isApproved ? 'Mechanic approved successfully.' : 'Mechanic rejected.',
      data: { mechanic },
    });
  } catch (error) {
    console.error('Approve mechanic error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get all service requests
// @route   GET /api/admin/services
const getAllServices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;

    const services = await ServiceRequest.find(filter)
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
        services,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalMechanics,
      pendingMechanics,
      totalVehicles,
      totalRequests,
      pendingRequests,
      completedRequests,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Mechanic.countDocuments({ isApproved: true }),
      Mechanic.countDocuments({ isApproved: false }),
      Vehicle.countDocuments({ isActive: true }),
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: 'pending' }),
      ServiceRequest.countDocuments({ status: 'completed' }),
      ServiceRequest.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price.final' } } },
      ]),
    ]);

    // Recent requests (last 5)
    const recentRequests = await ServiceRequest.find()
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Service type breakdown
    const serviceBreakdown = await ServiceRequest.aggregate([
      { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Monthly request trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await ServiceRequest.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalMechanics,
          pendingMechanics,
          totalVehicles,
          totalRequests,
          pendingRequests,
          completedRequests,
          totalRevenue: totalRevenue[0]?.total || 0,
        },
        recentRequests,
        serviceBreakdown,
        monthlyTrend,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user },
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllUsers, getAllMechanics, approveMechanic, getAllServices, getDashboardStats, toggleUserStatus };
