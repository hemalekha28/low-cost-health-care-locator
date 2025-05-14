const express = require('express');
const router = express.Router();
const {
  getFacilities,
  getFacility,
  searchFacilities,
  createFacility,
  updateFacility,
  deleteFacility
} = require('../controllers/facilityController');

// Base facility routes
router.route('/')
  .get(getFacilities)
  .post(createFacility);

// IMPORTANT: Put specific routes before parameter routes
// Search route - move this BEFORE the /:id route
router.route('/search')
  .post(searchFacilities);

// Parameter routes should come after specific routes
router.route('/:id')
  .get(getFacility)
  .put(updateFacility)
  .delete(deleteFacility);

module.exports = router;