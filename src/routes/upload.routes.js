const { Router } = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/upload.controller');
const { authenticate } = require('../middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const router = Router();

// Allow authenticated users to upload images (vendor service images, profile pictures)
router.post('/', authenticate, upload.single('image'), uploadImage);

module.exports = router;
