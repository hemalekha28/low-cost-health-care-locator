// map-integration.js - OpenStreetMap API integration for healthcare facility search

/**
 * Geocode an address using Nominatim API (OpenStreetMap's free geocoding service)
 * @param {string} address - User-provided address or location
 * @returns {Promise} - Resolves to {lat, lon} coordinates
 */
async function geocodeAddress(address) {
  const encodedAddress = encodeURIComponent(address);
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
  
  try {
    const response = await fetch(nominatimUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HealthcareLocatorApp/1.0' // Important: Nominatim requires a user-agent
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    } else {
      throw new Error('Location not found');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Search for healthcare facilities using Overpass API
 * @param {Object} coords - {lat, lon} coordinates
 * @param {number} radius - Search radius in kilometers
 * @returns {Promise} - Resolves to array of healthcare facilities
 */
async function searchHealthcareFacilities(coords, radius) {
  // Convert radius from km to meters for Overpass
  const radiusMeters = radius * 1000;
  
  // Build Overpass query - searching for healthcare facilities within radius
  const overpassQuery = `
    [out:json];
    (
      // Hospitals
      node["amenity"="hospital"](around:${radiusMeters},${coords.lat},${coords.lon});
      way["amenity"="hospital"](around:${radiusMeters},${coords.lat},${coords.lon});
      relation["amenity"="hospital"](around:${radiusMeters},${coords.lat},${coords.lon});
      
      // Clinics
      node["amenity"="clinic"](around:${radiusMeters},${coords.lat},${coords.lon});
      way["amenity"="clinic"](around:${radiusMeters},${coords.lat},${coords.lon});
      relation["amenity"="clinic"](around:${radiusMeters},${coords.lat},${coords.lon});
      
      // Doctors
      node["amenity"="doctors"](around:${radiusMeters},${coords.lat},${coords.lon});
      way["amenity"="doctors"](around:${radiusMeters},${coords.lat},${coords.lon});
      
      // Community health centers and other healthcare facilities
      node["healthcare"](around:${radiusMeters},${coords.lat},${coords.lon});
      way["healthcare"](around:${radiusMeters},${coords.lat},${coords.lon});
      
      // Social facilities that might provide healthcare
      node["social_facility"="healthcare"](around:${radiusMeters},${coords.lat},${coords.lon});
      way["social_facility"="healthcare"](around:${radiusMeters},${coords.lat},${coords.lon});
    );
    out body;
    >;
    out skel qt;
  `;
  
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'data=' + encodeURIComponent(overpassQuery)
    });
    
    const data = await response.json();
    return processOverpassResults(data, coords);
  } catch (error) {
    console.error('Overpass API error:', error);
    throw error;
  }
}

/**
 * Process Overpass API results into user-friendly format
 * @param {Object} data - Raw Overpass API response
 * @param {Object} searchCoords - Original search coordinates for distance calculation
 * @returns {Array} - Processed array of healthcare facilities
 */
function processOverpassResults(data, searchCoords) {
  const facilities = [];
  const nodes = {};
  const ways = {};
  
  // First pass: collect all nodes and ways
  data.elements.forEach(element => {
    if (element.type === 'node') {
      nodes[element.id] = element;
    } else if (element.type === 'way') {
      ways[element.id] = element;
    }
  });
  
  // Second pass: process elements into facilities
  data.elements.forEach(element => {
    // Skip node references (only process main elements)
    if (element.type === 'node' && !element.tags) return;
    
    if ((element.type === 'node' || element.type === 'way') && element.tags) {
      // Get coordinates
      let coords;
      if (element.type === 'node') {
        coords = { lat: element.lat, lon: element.lon };
      } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
        // For ways, use the first node's coordinates
        const firstNode = nodes[element.nodes[0]];
        if (firstNode) {
          coords = { lat: firstNode.lat, lon: firstNode.lon };
        }
      }
      
      if (coords) {
        const facility = {
          id: element.id,
          type: element.type,
          name: element.tags.name || getFacilityTypeName(element.tags),
          lat: coords.lat,
          lon: coords.lon,
          tags: element.tags,
          distance: calculateDistance(searchCoords, coords),
          address: formatAddress(element.tags),
          facilityType: getFacilityType(element.tags),
          phone: element.tags.phone || element.tags['contact:phone'] || 'Not available',
          website: element.tags.website || element.tags['contact:website'] || '',
          opening_hours: element.tags.opening_hours || 'Not specified'
        };
        
        facilities.push(facility);
      }
    }
  });
  
  // Sort by distance
  return facilities.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coords1 - First set of coordinates {lat, lon}
 * @param {Object} coords2 - Second set of coordinates {lat, lon}
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(coords1, coords2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lon - coords1.lon);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(value) {
  return value * Math.PI / 180;
}

/**
 * Determine user-friendly facility type from OSM tags
 * @param {Object} tags - OSM element tags
 * @returns {string} - User-friendly facility type
 */
function getFacilityType(tags) {
  if (tags.amenity === 'hospital') return 'Hospital';
  if (tags.amenity === 'clinic') return 'Clinic';
  if (tags.amenity === 'doctors') return 'Doctor\'s Office';
  if (tags.healthcare === 'centre') return 'Health Center';
  if (tags.healthcare === 'clinic') return 'Clinic';
  if (tags.healthcare) return `Healthcare (${tags.healthcare})`;
  if (tags.social_facility === 'healthcare') return 'Community Health Center';
  
  return 'Healthcare Facility';
}

/**
 * Create a default name for facilities without names
 * @param {Object} tags - OSM element tags
 * @returns {string} - Generated name
 */
function getFacilityTypeName(tags) {
  const type = getFacilityType(tags);
  
  if (tags.operator) {
    return `${tags.operator} ${type}`;
  }
  
  return `Unnamed ${type}`;
}

/**
 * Format address from OSM tags
 * @param {Object} tags - OSM element tags
 * @returns {string} - Formatted address
 */
function formatAddress(tags) {
  const parts = [];
  
  // Street address
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  
  // City, state, postal code
  if (tags['addr:city']) {
    let cityPart = tags['addr:city'];
    
    if (tags['addr:postcode']) {
      cityPart += `, ${tags['addr:postcode']}`;
    }
    
    if (tags['addr:state']) {
      cityPart += `, ${tags['addr:state']}`;
    }
    
    parts.push(cityPart);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

/**
 * Get facility details by ID from Overpass API
 * @param {number} id - OSM element ID
 * @param {string} type - Element type ('node', 'way', 'relation')
 * @returns {Promise} - Resolves to facility details
 */
async function getFacilityDetails(id, type) {
  const overpassQuery = `
    [out:json];
    ${type}(${id});
    out body;
    >;
    out skel qt;
  `;
  
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'data=' + encodeURIComponent(overpassQuery)
    });
    
    const data = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      // Process into detailed facility object
      const element = data.elements[0];
      const nodes = {};
      
      // Collect nodes for ways
      data.elements.forEach(el => {
        if (el.type === 'node') {
          nodes[el.id] = el;
        }
      });
      
      // Get coordinates
      let coords;
      if (element.type === 'node') {
        coords = { lat: element.lat, lon: element.lon };
      } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
        const firstNode = nodes[element.nodes[0]];
        if (firstNode) {
          coords = { lat: firstNode.lat, lon: firstNode.lon };
        }
      }
      
      if (coords && element.tags) {
        return {
          id: element.id,
          type: element.type,
          name: element.tags.name || getFacilityTypeName(element.tags),
          lat: coords.lat,
          lon: coords.lon,
          tags: element.tags,
          address: formatAddress(element.tags),
          facilityType: getFacilityType(element.tags),
          phone: element.tags.phone || element.tags['contact:phone'] || 'Not available',
          website: element.tags.website || element.tags['contact:website'] || '',
          opening_hours: element.tags.opening_hours || 'Not specified',
          wheelchair: element.tags.wheelchair || 'Unknown',
          emergency: element.tags.emergency || 'Unknown',
          specialties: extractSpecialties(element.tags),
          payment_types: extractPaymentInfo(element.tags)
        };
      }
    }
    
    throw new Error('Facility not found');
  } catch (error) {
    console.error('Facility details error:', error);
    throw error;
  }
}

/**
 * Extract healthcare specialties from tags
 * @param {Object} tags - OSM element tags
 * @returns {Array} - List of specialties
 */
function extractSpecialties(tags) {
  const specialties = [];
  
  // Check for healthcare:speciality tags (OSM standard)
  for (const key in tags) {
    if (key.startsWith('healthcare:speciality') && tags[key] === 'yes') {
      specialties.push(key.replace('healthcare:speciality:', ''));
    }
  }
  
  // Add specific healthcare services
  if (tags.healthcare === 'dentist') specialties.push('Dentistry');
  if (tags.healthcare === 'pharmacy') specialties.push('Pharmacy');
  if (tags.healthcare === 'optometrist') specialties.push('Optometry');
  if (tags.healthcare === 'rehabilitation') specialties.push('Rehabilitation');
  if (tags.healthcare === 'alternative') specialties.push('Alternative Medicine');
  if (tags.healthcare === 'laboratory') specialties.push('Medical Laboratory');
  if (tags.healthcare === 'psychology') specialties.push('Psychology');
  
  // If no specialties found, return general category
  if (specialties.length === 0) {
    if (tags.amenity === 'hospital') return ['General Hospital Services'];
    if (tags.amenity === 'clinic') return ['General Clinic Services'];
    if (tags.healthcare) return [`${tags.healthcare.charAt(0).toUpperCase() + tags.healthcare.slice(1)} Services`];
    return ['General Healthcare'];
  }
  
  return specialties;
}

/**
 * Extract payment information from tags
 * @param {Object} tags - OSM element tags
 * @returns {Object} - Payment information
 */
function extractPaymentInfo(tags) {
  const paymentInfo = {
    accepts_insurance: 'Unknown',
    payment_methods: [],
    sliding_scale: 'Unknown',
    free_care: 'Unknown'
  };
  
  if (tags['payment:insurance'] === 'yes') paymentInfo.accepts_insurance = 'Yes';
  if (tags['payment:insurance'] === 'no') paymentInfo.accepts_insurance = 'No';
  
  if (tags['fee'] === 'no' || tags['fee'] === 'none') paymentInfo.free_care = 'Yes';
  if (tags['fee'] === 'yes') paymentInfo.free_care = 'No';
  
  if (tags['payment:sliding_scale'] === 'yes') paymentInfo.sliding_scale = 'Yes';
  if (tags['payment:sliding_scale'] === 'no') paymentInfo.sliding_scale = 'No';
  
  // Check for payment methods
  for (const key in tags) {
    if (key.startsWith('payment:') && tags[key] === 'yes' && !['payment:sliding_scale', 'payment:insurance'].includes(key)) {
      paymentInfo.payment_methods.push(key.replace('payment:', ''));
    }
  }
  
  return paymentInfo;
}

module.exports = {
  geocodeAddress,
  searchHealthcareFacilities,
  getFacilityDetails,
  getFacilityType,
  calculateDistance
};