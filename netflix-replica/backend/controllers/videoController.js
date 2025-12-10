const Video = require('../models/Video');
const WatchHistory = require('../models/WatchHistory');

// @desc    Get all videos
// @route   GET /api/videos
// @access  Private
exports.getVideos = async (req, res) => {
  try {
    const { genre, category, search, limit = 50 } = req.query;

    let query = {};

    if (genre) {
      query.genres = genre;
    }

    if (category) {
      query.categories = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const videos = await Video.find(query)
      .populate('categories')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get featured video
// @route   GET /api/videos/featured
// @access  Private
exports.getFeaturedVideo = async (req, res) => {
  try {
    const video = await Video.findOne({ isFeatured: true })
      .populate('categories')
      .sort({ createdAt: -1 });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'No featured video found'
      });
    }

    res.json({
      success: true,
      video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get trending videos
// @route   GET /api/videos/trending
// @access  Private
exports.getTrendingVideos = async (req, res) => {
  try {
    const videos = await Video.find({ isTrending: true })
      .populate('categories')
      .limit(20)
      .sort({ viewCount: -1 });

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get new releases
// @route   GET /api/videos/new-releases
// @access  Private
exports.getNewReleases = async (req, res) => {
  try {
    const videos = await Video.find({ isNewRelease: true })
      .populate('categories')
      .limit(20)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get video by ID
// @route   GET /api/videos/:id
// @access  Private
exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('categories');

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Increment view count
    video.viewCount += 1;
    await video.save();

    res.json({
      success: true,
      video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get videos by genre
// @route   GET /api/videos/genre/:genre
// @access  Private
exports.getVideosByGenre = async (req, res) => {
  try {
    const videos = await Video.find({ genres: req.params.genre })
      .populate('categories')
      .limit(20)
      .sort({ viewCount: -1 });

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Search videos
// @route   GET /api/videos/search/:query
// @access  Private
exports.searchVideos = async (req, res) => {
  try {
    const videos = await Video.find({
      $text: { $search: req.params.query }
    })
      .populate('categories')
      .limit(20);

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
