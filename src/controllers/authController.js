const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

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
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          role: 'user',
        },
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
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          notifications: user.notifications,
          language: user.language,
          role: user.role || 'user',
        },
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
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval.' });
    }

    const token = generateToken(mechanic._id, 'mechanic');

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        mechanic: {
          _id: mechanic._id,
          name: mechanic.name,
          email: mechanic.email,
          phone: mechanic.phone,
          profileImage: mechanic.profileImage,
          specialization: mechanic.specialization,
          rating: mechanic.rating,
          isApproved: mechanic.isApproved,
          role: 'mechanic',
        },
      },
    });
  } catch (error) {
    console.error('Login mechanic error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// @desc    Admin login
// @route   POST /api/auth/admin/login
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vassist.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    if (email.toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    if (password !== adminPassword) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { id: 'admin_001', role: 'admin', email: adminEmail },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Admin login successful.',
      data: {
        token,
        user: {
          _id: 'admin_001',
          name: 'Administrator',
          email: adminEmail,
          role: 'admin',
        },
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
};

module.exports = { registerUser, loginUser, registerMechanic, loginMechanic, loginAdmin };
