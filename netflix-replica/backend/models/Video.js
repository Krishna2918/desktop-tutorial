const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description']
  },
  videoUrl: {
    type: String,
    required: [true, 'Please provide a video URL']
  },
  thumbnailUrl: {
    type: String,
    required: [true, 'Please provide a thumbnail URL']
  },
  bannerUrl: {
    type: String
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  rating: {
    type: String,
    enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'],
    default: 'PG-13'
  },
  genres: [{
    type: String,
    required: true
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  cast: [String],
  director: String,
  isTrending: {
    type: Boolean,
    default: false
  },
  isNewRelease: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  trailerUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for search
videoSchema.index({ title: 'text', description: 'text', genres: 'text' });

module.exports = mongoose.model('Video', videoSchema);
