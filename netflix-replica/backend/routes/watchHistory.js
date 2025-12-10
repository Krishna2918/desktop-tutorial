const express = require('express');
const router = express.Router();
const {
  getWatchHistory,
  updateWatchProgress,
  getMyList,
  addToMyList,
  removeFromMyList
} = require('../controllers/watchHistoryController');
const { protect } = require('../middleware/auth');

router.get('/history', protect, getWatchHistory);
router.post('/history', protect, updateWatchProgress);
router.get('/mylist', protect, getMyList);
router.post('/mylist', protect, addToMyList);
router.delete('/mylist/:videoId', protect, removeFromMyList);

module.exports = router;
