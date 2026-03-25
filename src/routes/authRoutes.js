const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  registerUser,
  loginUser,
  registerMechanic,
  loginMechanic,
  loginAdmin,
} = require('../controllers/authController');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const mechanicRegisterValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// User routes
router.post('/register', registerValidation, registerUser);
router.post('/login', loginUser);

// Mechanic routes
router.post('/mechanic/register', mechanicRegisterValidation, registerMechanic);
router.post('/mechanic/login', loginMechanic);

// Admin route
router.post('/admin/login', loginAdmin);

module.exports = router;
