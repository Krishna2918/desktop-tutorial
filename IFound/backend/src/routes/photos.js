const express = require('express');
const router = express.Router();
const {
  uploadPhotos,
  getPhotosByCase,
  setPrimaryPhoto,
  deletePhoto,
} = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Case photos
router.post('/:caseId/photos', authenticateToken, upload.array('photos', 10), uploadPhotos);
router.get('/:caseId/photos', getPhotosByCase);

// Individual photo operations
router.put('/:id/set-primary', authenticateToken, setPrimaryPhoto);
router.delete('/:id', authenticateToken, deletePhoto);

module.exports = router;
