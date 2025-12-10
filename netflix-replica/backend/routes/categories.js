const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryBySlug
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getCategories);
router.get('/:slug', protect, getCategoryBySlug);

module.exports = router;
