// controllers/facilityController.js
const Facility = require('../models/Facility');
const { geocodeAddress } = require('../routes/facilities'); // Your existing function

// @desc    Get all facilities
// @route   GET /api/facilities
// @access  Public
const getFacilities = async (req, res, next) => {
  try {
    const facilities = await Facility.find();
    
    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities.map(facility => facility.toPublicJSON())
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Search facilities
// @route   POST /api/facilities/search
// @access  Public
const searchFacilities = async (req, res, next) => {
  try {
    const { location, radius = 10, facilityType, paymentOptions = [] } = req.body;

    // Use the geocodeAddress function from facilities.js
    const coordinates = await geocodeAddress(location);

    // Base query for location
    const query = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [coordinates.lon, coordinates.lat]
          },
          $maxDistance: radius * 1609.34 // Convert miles to meters
        }
      },
      active: true
    };

    // Add facility type filter if provided
    if (facilityType) {
      query.facilityType = facilityType;
    }

    // Handle payment options
    if (paymentOptions.length > 0) {
      const orConditions = [];
      
      if (paymentOptions.includes('slidingScale')) {
        orConditions.push({ 'paymentOptions.slidingScale': true });
      }
      if (paymentOptions.includes('freeCare')) {
        orConditions.push({ 'paymentOptions.freeCare': true });
      }
      if (paymentOptions.includes('insurance')) {
        orConditions.push({ 'paymentOptions.acceptsInsurance': true });
      }
      if (paymentOptions.includes('medicaid')) {
        orConditions.push({ 'paymentOptions.acceptsMedicaid': true });
      }
      if (paymentOptions.includes('medicare')) {
        orConditions.push({ 'paymentOptions.acceptsMedicare': true });
      }
      if (paymentOptions.includes('financialAssistance')) {
        orConditions.push({ 'paymentOptions.financialAssistance': true });
      }
      if (paymentOptions.includes('charityCare')) {
        orConditions.push({ 'paymentOptions.charityCare': true });
      }

      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }

    // Find facilities
    const facilities = await Facility.find(query).limit(50);

    // Save search to user history if logged in
    if (req.user) {
      req.user.searchHistory.push({
        location,
        radius,
        facilityType,
        timestamp: Date.now()
      });
      await req.user.save();
    }

    res.status(200).json({
      success: true,
      location: coordinates.displayName,
      searchCoordinates: {
        lat: coordinates.lat,
        lon: coordinates.lon
      },
      radius: radius,
      totalProviders: facilities.length,
      providers: facilities.map(facility => facility.toPublicJSON())
    });
  } catch (err) {
    console.error('Search facilities error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Server Error'
    });
  }
};

// @desc    Get single facility
// @route   GET /api/facilities/:id
// @access  Public
const getFacility = async (req, res, next) => {
  try {
    const facility = await Facility.findById(req.params.id);
    
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: facility.toPublicJSON()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Create new facility
// @route   POST /api/facilities
// @access  Private
const createFacility = async (req, res) => {
  try {
    // Extract and format data from request body
    const {
      name,
      facilityType,
      address,
      contact,
      hours,
      services,
      costLevel,
      paymentOptions,
      procedureCosts,
      accessibility
    } = req.body;
    
    // Geocode the address to get coordinates
    const addressStr = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
    const coordinates = await geocodeAddress(addressStr);
    
    const facilityData = {
      name,
      facilityType,
      location: {
        type: 'Point',
        coordinates: [coordinates.lon, coordinates.lat]
      },
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        formatted: coordinates.displayName
      },
      contact,
      hours,
      services,
      costLevel,
      paymentOptions,
      procedureCosts,
      accessibility,
      active: true
    };
    
    // Create facility
    const facility = await Facility.create(facilityData);
    
    res.status(201).json({
      success: true,
      data: facility.toPublicJSON()
    });
  } catch (err) {
    console.error('Create facility error:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Update facility
// @route   PUT /api/facilities/:id
// @access  Private
const updateFacility = async (req, res) => {
  try {
    let facility = await Facility.findById(req.params.id);
    
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }
    
    // If address is being updated, we need to geocode it
    if (req.body.address) {
      const address = req.body.address;
      const addressStr = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
      const coordinates = await geocodeAddress(addressStr);
      
      req.body.location = {
        type: 'Point',
        coordinates: [coordinates.lon, coordinates.lat]
      };
      
      req.body.address.formatted = coordinates.displayName;
    }
    
    facility = await Facility.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: facility.toPublicJSON()
    });
  } catch (err) {
    console.error('Update facility error:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Delete facility
// @route   DELETE /api/facilities/:id
// @access  Private
const deleteFacility = async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }
    
    // Soft delete - just mark as inactive instead of removing
    facility.active = false;
    await facility.save();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Delete facility error:', err);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Export all controller methods
module.exports = {
  getFacilities,
  getFacility,
  searchFacilities,
  createFacility,
  updateFacility,
  deleteFacility
};