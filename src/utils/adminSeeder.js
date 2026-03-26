const User = require('../models/User');

/**
 * Seeds the admin user into the database if one does not already exist.
 * Runs once on server startup. Admin credentials are read from env vars.
 */
const seedAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vassist.com').toLowerCase();

    const existing = await User.findOne({ email: adminEmail, role: 'admin' });
    if (existing) {
      console.log('✓ Admin user already exists.');
      return;
    }

    await User.create({
      name: 'Administrator',
      email: adminEmail,
      phone: '',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      isActive: true,
    });

    console.log('✓ Admin user seeded successfully.');
  } catch (error) {
    console.error('✗ Admin seeding failed:', error.message);
  }
};

module.exports = seedAdmin;
