const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  facilityType: {
    type: String,
    required: true,
    enum: ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'mental']
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    formatted: String
  },
  contact: {
    phone: String,
    email: String,
    website: String
  },
  hours: {
    monday: String,
    tuesday: String,
    wednesday: String,
    thursday: String,
    friday: String,
    saturday: String,
    sunday: String
  },
  services: [String],
  // Cost-related fields
  costLevel: {
    type: Number,
    min: 0,
    max: 3, // 0: Very Low, 1: Low, 2: Moderate, 3: Standard
    default: 3
  },
  paymentOptions: {
    slidingScale: {
      type: Boolean,
      default: false
    },
    freeCare: {
      type: Boolean,
      default: false
    },
    acceptsInsurance: {
      type: Boolean,
      default: true
    },
    acceptsMedicaid: {
      type: Boolean,
      default: false
    },
    acceptsMedicare: {
      type: Boolean,
      default: false
    },
    financialAssistance: {
      type: Boolean,
      default: false
    },
    charityCare: {
      type: Boolean,
      default: false
    }
  },
  // Common procedure costs
  procedureCosts: [{
    procedureName: String,
    averageCost: Number,
    minCost: Number,
    maxCost: Number,
    description: String
  }],
  ratings: {
    overall: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    costValue: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    qualityOfCare: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    }
  },
  accessibility: {
    wheelchairAccessible: {
      type: Boolean,
      default: false
    },
    interpreterServices: {
      type: Boolean,
      default: false
    },
    publicTransportAccess: {
      type: Boolean,
      default: false
    }
  },
  // OpenStreetMap ID for mapping to OSM data
  osmId: String,
  tags: mongoose.Schema.Types.Mixed, // For storing raw OSM tags
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for location-based queries
facilitySchema.index({ location: '2dsphere' });
// Index for performance on common queries
facilitySchema.index({ facilityType: 1, active: 1 });
facilitySchema.index({ 'address.zipCode': 1 });
facilitySchema.index({ costLevel: 1 });

// Pre-save middleware to update the updatedAt field
facilitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full address
facilitySchema.virtual('fullAddress').get(function() {
  if (this.address.formatted) return this.address.formatted;
  
  let parts = [];
  if (this.address.street) parts.push(this.address.street);
  if (this.address.city) parts.push(this.address.city);
  if (this.address.state) {
    if (this.address.zipCode) {
      parts.push(`${this.address.state} ${this.address.zipCode}`);
    } else {
      parts.push(this.address.state);
    }
  }
  return parts.join(', ');
});

// Method to get distance in miles from a given point
facilitySchema.methods.getDistanceFrom = function(lat, lng) {
  // Implementation depends on your needs: 
  // Could use MongoDB's $geoNear or a separate distance calculation function
};

// Prepare data for frontend display
facilitySchema.methods.toPublicJSON = function() {
  const facility = this.toObject();
  return {
    id: facility._id,
    name: facility.name,
    facilityType: facility.facilityType,
    address: facility.fullAddress,
    lat: facility.location.coordinates[1],
    lon: facility.location.coordinates[0],
    phone: facility.contact.phone,
    website: facility.contact.website,
    hours: facility.hours,
    services: facility.services,
    costLevel: facility.costLevel,
    paymentOptions: {
      slidingScale: facility.paymentOptions.slidingScale,
      freeCare: facility.paymentOptions.freeCare,
      acceptsInsurance: facility.paymentOptions.acceptsInsurance,
      acceptsMedicaid: facility.paymentOptions.acceptsMedicaid,
      financialAssistance: facility.paymentOptions.financialAssistance,
      charityCare: facility.paymentOptions.charityCare
    },
    ratings: facility.ratings,
    accessibility: facility.accessibility
  };
};

const Facility = mongoose.model('Facility', facilitySchema);

module.exports = Facility;