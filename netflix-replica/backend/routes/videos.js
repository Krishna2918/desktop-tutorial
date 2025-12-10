const express = require('express');
const router = express.Router();
const {
  getVideos,
  getFeaturedVideo,
  getTrendingVideos,
  getNewReleases,
  getVideoById,
  getVideosByGenre,
  searchVideos
} = require('../controllers/videoController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getVideos);
router.get('/featured', protect, getFeaturedVideo);
router.get('/trending', protect, getTrendingVideos);
router.get('/new-releases', protect, getNewReleases);
router.get('/search/:query', protect, searchVideos);
router.get('/genre/:genre', protect, getVideosByGenre);
router.get('/:id', protect, getVideoById);

module.exports = router;
