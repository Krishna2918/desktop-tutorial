const WatchHistory = require('../models/WatchHistory');
const MyList = require('../models/MyList');

// @desc    Get watch history
// @route   GET /api/watch-history
// @access  Private
exports.getWatchHistory = async (req, res) => {
  try {
    const { profileIndex = 0 } = req.query;

    const history = await WatchHistory.find({
      user: req.user.id,
      profileIndex: parseInt(profileIndex)
    })
      .populate('video')
      .sort({ lastWatchedAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update watch progress
// @route   POST /api/watch-history
// @access  Private
exports.updateWatchProgress = async (req, res) => {
  try {
    const { videoId, progress, profileIndex = 0 } = req.body;

    let watchHistory = await WatchHistory.findOne({
      user: req.user.id,
      video: videoId,
      profileIndex
    });

    if (watchHistory) {
      watchHistory.progress = progress;
      watchHistory.lastWatchedAt = Date.now();
      await watchHistory.save();
    } else {
      watchHistory = await WatchHistory.create({
        user: req.user.id,
        video: videoId,
        profileIndex,
        progress
      });
    }

    res.json({
      success: true,
      watchHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my list
// @route   GET /api/mylist
// @access  Private
exports.getMyList = async (req, res) => {
  try {
    const { profileIndex = 0 } = req.query;

    const myList = await MyList.find({
      user: req.user.id,
      profileIndex: parseInt(profileIndex)
    })
      .populate('video')
      .sort({ addedAt: -1 });

    res.json({
      success: true,
      count: myList.length,
      myList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add to my list
// @route   POST /api/mylist
// @access  Private
exports.addToMyList = async (req, res) => {
  try {
    const { videoId, profileIndex = 0 } = req.body;

    const exists = await MyList.findOne({
      user: req.user.id,
      video: videoId,
      profileIndex
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Video already in your list'
      });
    }

    const myListItem = await MyList.create({
      user: req.user.id,
      video: videoId,
      profileIndex
    });

    res.status(201).json({
      success: true,
      myListItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove from my list
// @route   DELETE /api/mylist/:videoId
// @access  Private
exports.removeFromMyList = async (req, res) => {
  try {
    const { profileIndex = 0 } = req.query;

    const deleted = await MyList.findOneAndDelete({
      user: req.user.id,
      video: req.params.videoId,
      profileIndex: parseInt(profileIndex)
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Video not found in your list'
      });
    }

    res.json({
      success: true,
      message: 'Video removed from your list'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
