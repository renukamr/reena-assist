const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vassist/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    public_id: (req, file) => {
      const role = req.user ? req.user.role : 'user';
      const id = req.user ? req.user.id : Date.now();
      return `${role}_${id}_${Date.now()}`;
    },
  },
});

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vassist/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    public_id: (req, file) => {
      const id = req.user ? req.user.id : Date.now();
      return `doc_${id}_${Date.now()}`;
    },
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs allowed.'), false);
  }
};

const uploadProfileImage = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedImages.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures.'), false);
    }
  },
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

module.exports = { uploadProfileImage, uploadDocument };
