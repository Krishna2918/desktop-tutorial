const Category = require('../models/Category');
const Video = require('../models/Video');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 });

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get category by slug
// @route   GET /api/categories/:slug
// @access  Private
exports.getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get videos for this category
    const videos = await Video.find({ categories: category._id })
      .limit(20)
      .sort({ viewCount: -1 });

    res.json({
      success: true,
      category,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
