const express = require('express');
const path = require('path');
const app = express();
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { geocodeAddress, searchHealthcareFacilities, getFacilityDetails } = require('./map-integration');
// Import the API functions
const PORT = process.env.PORT || 3000;
// Load env vars
dotenv.config();
// Middleware
// Connect to database
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
// Create router
const router = express.Router();

// Register router
app.use('/api', router);
// Route files
const facilities = require('./routes/facilities');
const users = require('./routes/users');
// API Routes
router.get('/facilities', (req, res) => {
  res.json({ message: 'List of healthcare facilities' });
});

// Implement the facilities search endpoint
router.post('/facilities/search', async (req, res) => {
  try {
    const { location, radius = 10, careType } = req.body;
    
    // Use the geocodeAddress function from api.js
    const coordinates = await geocodeAddress(location);
    
    // Use the searchHealthcareFacilities function from api.js
    const facilities = await searchHealthcareFacilities(coordinates, radius);
    
    // Filter by care type if specified
    let providers = facilities;
    if (careType) {
      providers = facilities.filter(facility => {
        // Implement filtering logic based on careType
        return facility.facilityType.toLowerCase().includes(careType.toLowerCase());
      });
    }
    
    res.json({
      location: coordinates.displayName,
      searchCoordinates: {
        lat: coordinates.lat,
        lon: coordinates.lon
      },
      radius: radius,
      totalProviders: providers.length,
      providers: providers
    });
  } catch (error) {
    console.error('API search error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during search' });
  }
});

// Get facility details endpoint
router.get('/facilities/:type/:id', async (req, res) => {
  try {
    const { id, type } = req.params;
    const details = await getFacilityDetails(id, type);
    res.json(details);
  } catch (error) {
    console.error('Facility details error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve facility details' });
  }
});

// Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/resources', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'resources.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Healthcare Providers Search Endpoint (frontend facing)
app.post('/search-providers', async (req, res) => {
  console.log('search-providers route hit');
  try {
    const { location, radius = 10, careType, paymentOptions } = req.body;
    
    // Use the API functions directly instead of making a self-referential HTTP request
    const coordinates = await geocodeAddress(location);
    let facilities = await searchHealthcareFacilities(coordinates, radius);
    
    // Filter by care type if specified
    if (careType) {
      facilities = facilities.filter(facility => {
        return facility.facilityType.toLowerCase().includes(careType.toLowerCase());
      });
    }
    
    // Filter by payment options if specified
    if (paymentOptions && paymentOptions.length > 0) {
      facilities = facilities.filter(provider => {
        if (paymentOptions.includes('Sliding Scale') && 
            provider.tags && provider.tags['payment:sliding_scale'] === 'yes') {
          return true;
        }
        if (paymentOptions.includes('Free') && 
            provider.tags && provider.tags.fee === 'no') {
          return true;
        }
        return false;
      });
    }
    
    res.json({
      location: coordinates.displayName,
      searchCoordinates: {
        lat: coordinates.lat,
        lon: coordinates.lon
      },
      radius: radius,
      totalProviders: facilities.length,
      providers: facilities
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during search' });
  }
});

// Newsletter Subscription
app.post('/subscribe', (req, res) => {
  const { email } = req.body;
  
  // Placeholder for subscription logic
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  
  // In a real application, you would:
  // 1. Validate email
  // 2. Check if email already exists
  // 3. Save to database
  // 4. Send confirmation email
  
  res.status(200).json({
    message: 'Successfully subscribed!',
    email: email
  });
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).send('Page Not Found');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`CareConnect server running on port ${PORT}`);
});

module.exports = {
  app,
  geocodeAddress,
  searchHealthcareFacilities,
  getFacilityDetails
};