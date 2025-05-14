// models/Review.js
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  facility: {
    type: mongoose.Schema.ObjectId,
    ref: 'Facility',
    required: true
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Please add a rating between 1 and 5']
  },
  comment: {
    type: String,
    required: [true, 'Please add a comment']
  },
  helpfulness: {
    staff: {
      type: Number,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    },
    affordability: {
      type: Number,
      min: 1,
      max: 5
    },
    waitTime: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  tags: [String],
  verified: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0
  },
  reported: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent user from submitting more than one review per facility
ReviewSchema.index({ facility: 1, user: 1 }, { unique: true });

// Static method to get avg rating and save
ReviewSchema.statics.getAverageRating = async function (facilityId) {
  const obj = await this.aggregate([
    {
      $match: { facility: facilityId }
    },
    {
      $group: {
        _id: '$facility',
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  try {
    await this.model('Facility').findByIdAndUpdate(facilityId, {
      'ratings.average': obj[0].averageRating,
      'ratings.count': await this.countDocuments({ facility: facilityId })
    });
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
ReviewSchema.post('save', function () {
  this.constructor.getAverageRating(this.facility);
});

// Call getAverageRating before remove
ReviewSchema.pre('remove', function () {
  this.constructor.getAverageRating(this.facility);
});

module.exports = mongoose.model('Review', ReviewSchema);