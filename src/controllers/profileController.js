const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');

// @desc    Get user/mechanic profile
// @route   GET /api/profile
const getProfile = async (req, res) => {
  try {
    let profile;

    if (req.user.role === 'mechanic') {
      profile = await Mechanic.findById(req.user.id).select('-password');
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Mechanic profile not found.' });
      }
    } else if (req.user.role === 'admin') {
      profile = {
        _id: 'admin_001',
        name: 'Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@vassist.com',
        role: 'admin',
        profileImage: '',
      };
    } else {
      profile = await User.findById(req.user.id).select('-password');
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User profile not found.' });
      }
    }

    res.json({ success: true, data: { profile } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Update profile
// @route   PUT /api/profile
const updateProfile = async (req, res) => {
  const { name, phone, notifications, language, specialization, experience } = req.body;

  try {
    let profile;

    if (req.user.role === 'mechanic') {
      const updateFields = {};
      if (name) updateFields.name = name;
      if (phone) updateFields.phone = phone;
      if (specialization) updateFields.specialization = specialization;
      if (experience !== undefined) updateFields.experience = experience;

      profile = await Mechanic.findByIdAndUpdate(req.user.id, { $set: updateFields }, { new: true, runValidators: true }).select('-password');

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Mechanic not found.' });
      }
    } else {
      const updateFields = {};
      if (name) updateFields.name = name;
      if (phone !== undefined) updateFields.phone = phone;
      if (notifications !== undefined) updateFields.notifications = notifications;
      if (language) updateFields.language = language;

      profile = await User.findByIdAndUpdate(req.user.id, { $set: updateFields }, { new: true, runValidators: true }).select('-password');

      if (!profile) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { profile },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating profile.' });
  }
};

// @desc    Upload profile image
// @route   POST /api/profile/image
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    const imageUrl = req.file.path || req.file.secure_url;

    let profile;
    if (req.user.role === 'mechanic') {
      profile = await Mechanic.findByIdAndUpdate(
        req.user.id,
        { profileImage: imageUrl },
        { new: true }
      ).select('-password');
    } else {
      profile = await User.findByIdAndUpdate(
        req.user.id,
        { profileImage: imageUrl },
        { new: true }
      ).select('-password');
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    res.json({
      success: true,
      message: 'Profile image updated successfully.',
      data: { profileImage: imageUrl, profile },
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ success: false, message: 'Server error during image upload.' });
  }
};

// @desc    Change password
// @route   PUT /api/profile/password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: 'New password must be different from current password.' });
  }

  try {
    let account;

    if (req.user.role === 'mechanic') {
      account = await Mechanic.findById(req.user.id).select('+password');
    } else {
      account = await User.findById(req.user.id).select('+password');
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, account.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    account.password = await bcrypt.hash(newPassword, salt);
    await account.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
};

module.exports = { getProfile, updateProfile, uploadProfileImage, changePassword };
