const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Helper: build safe user payload (no password, always includes createdAt)
const buildUserPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  profileImage: user.profileImage || '',
  notifications: user.notifications !== undefined ? user.notifications : true,
  language: user.language || 'en',
  role: user.role || 'user',
  createdAt: user.createdAt,
});

// Helper: build safe mechanic payload
const buildMechanicPayload = (mechanic) => ({
  _id: mechanic._id,
  name: mechanic.name,
  email: mechanic.email,
  phone: mechanic.phone || '',
  profileImage: mechanic.profileImage || '',
  specialization: mechanic.specialization || [],
  rating: mechanic.rating || { average: 0, count: 0 },
  isApproved: mechanic.isApproved,
  role: 'mechanic',
  createdAt: mechanic.createdAt,
});

// @desc    Register a new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, phone, password } = req.body;

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, phone, password });
    const token = generateToken(user._id, 'user');

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: buildUserPayload(user),
      },
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id, user.role || 'user');

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: buildUserPayload(user),
      },
    });
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// @desc    Register mechanic
// @route   POST /api/auth/mechanic/register
const registerMechanic = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, phone, password, specialization, experience } = req.body;

  try {
    const existing = await Mechanic.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const mechanic = await Mechanic.create({
      name,
      email,
      phone,
      password,
      specialization: specialization || ['general'],
      experience: experience || 0,
    });

    res.status(201).json({
      success: true,
      message: 'Mechanic registration submitted. Awaiting admin approval.',
      data: {
        mechanic: {
          _id: mechanic._id,
          name: mechanic.name,
          email: mechanic.email,
          phone: mechanic.phone,
          specialization: mechanic.specialization,
          isApproved: mechanic.isApproved,
        },
      },
    });
  } catch (error) {
    console.error('Register mechanic error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// @desc    Login mechanic
// @route   POST /api/auth/mechanic/login
const loginMechanic = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const mechanic = await Mechanic.findOne({ email: email.toLowerCase() }).select('+password');
    if (!mechanic) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!mechanic.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    const isMatch = await mechanic.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!mechanic.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. You will be notified once approved.',
        code: 'PENDING_APPROVAL',
      });
    }

    const token = generateToken(mechanic._id, 'mechanic');

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        mechanic: buildMechanicPayload(mechanic),
      },
    });
  } catch (error) {
    console.error('Login mechanic error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// @desc    Admin login — queries real seeded admin User document
// @route   POST /api/auth/admin/login
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vassist.com').toLowerCase();

    if (email.toLowerCase() !== adminEmail) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    // Query the real seeded admin user (bcrypt password comparison)
    const admin = await User.findOne({ email: adminEmail, role: 'admin' }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account not found. Please restart the server to seed.' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account has been deactivated.' });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const token = generateToken(admin._id, 'admin');

    res.json({
      success: true,
      message: 'Admin login successful.',
      data: {
        token,
        user: buildUserPayload(admin),
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
};

module.exports = { registerUser, loginUser, registerMechanic, loginMechanic, loginAdmin };
