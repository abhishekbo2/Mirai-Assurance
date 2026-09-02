const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getProfile,
  login,
  register,
  uploadProfileImage,
} = require('../controllers/authController.js');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.post('/profile/image', protect, upload.single('profileImage'), uploadProfileImage);

module.exports = router;
