const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { uploadProfileImage: uploadMiddleware } = require('../middleware/upload');
const { getProfile, updateProfile, uploadProfileImage, changePassword } = require('../controllers/profileController');

router.use(verifyToken);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/image', uploadMiddleware.single('profileImage'), uploadProfileImage);
router.put('/password', changePassword);

module.exports = router;
