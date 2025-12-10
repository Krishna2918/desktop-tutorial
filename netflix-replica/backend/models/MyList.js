const mongoose = require('mongoose');

const myListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  profileIndex: {
    type: Number,
    default: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index
myListSchema.index({ user: 1, video: 1, profileIndex: 1 }, { unique: true });

module.exports = mongoose.model('MyList', myListSchema);
