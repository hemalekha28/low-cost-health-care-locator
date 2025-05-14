const mongoose = require('mongoose');
const Facility = require('./models/Facility');
require('dotenv').config();

// Make sure these are consistent - use the same name in your .env file
console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI) // Change to match your .env variable name
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Common medical procedures with cost ranges (in INR)
const commonProcedures = [
  {
    procedureName: 'General Health Checkup',
    minCost: 500,
    maxCost: 2000,
    avgCostMultiplier: 1.0,
    description: 'Basic health examination with routine blood tests'
  },
  {
    procedureName: 'Complete Blood Count',
    minCost: 300,
    maxCost: 800,
    avgCostMultiplier: 0.9,
    description: 'Blood test to evaluate overall health'
  },
  // other procedures remain the same...
];

// Sample Tamil Nadu facilities data - restructured to match schema
const facilities = [
  {
    name: 'Apollo Hospitals',
    facilityType: 'hospital', // FIXED: Use facilityType instead of type, use enum value
    location: {
      type: 'Point',
      coordinates: [80.2574, 13.0569] // Chennai coordinates
    },
    address: {
      street: '21 Greams Lane, Thousand Lights',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600006',
      formatted: '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006'
    },
    contact: {
      phone: '044-28293333', // Add appropriate contact details
      email: 'info@apollohospitals.com',
      website: 'https://www.apollohospitals.com'
    },
    costLevel: 3, // Higher cost premium hospital
    services: ['General Medicine', 'Cardiology', 'Orthopedics'],
    paymentOptions: {
      slidingScale: false,
      freeCare: false,
      acceptsInsurance: true,
      acceptsMedicaid: false,
      acceptsMedicare: false,
      financialAssistance: true,
      charityCare: false
    },
    procedureCosts: [] // Will be populated later
  },
  {
    name: 'Government General Hospital',
    facilityType: 'hospital', // FIXED: Use facilityType instead of type, use enum value
    location: {
      type: 'Point',
      coordinates: [80.2840, 13.0827]
    },
    address: {
      street: 'E.V.R. Periyar Salai, Park Town',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600003',
      formatted: 'E.V.R. Periyar Salai, Park Town, Chennai, Tamil Nadu 600003'
    },
    contact: {
      phone: '044-25305000',
      email: 'info@mmc.tn.gov.in',
      website: 'https://www.mmc.tn.gov.in'
    },
    costLevel: 0, // Lower cost government hospital
    services: ['General Medicine', 'Surgery', 'Pediatrics'],
    paymentOptions: {
      slidingScale: true,
      freeCare: true,
      acceptsInsurance: true,
      acceptsMedicaid: true,
      acceptsMedicare: true,
      financialAssistance: true,
      charityCare: true
    },
    procedureCosts: [] // Will be populated later
  },
  // Add the rest of your facilities with the same structure
];

// Generate procedure costs for each facility
facilities.forEach(facility => {
  commonProcedures.forEach(proc => {
    // Apply some randomness to the cost within the range
    const randomFactor = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
    const baseAvgCost = (proc.minCost + proc.maxCost) / 2;
    const costModifier = facility.costLevel === 0 ? 0.4 : 
                         facility.costLevel === 1 ? 0.7 :
                         facility.costLevel === 2 ? 1.0 : 1.3;
    const calculatedCost = baseAvgCost * proc.avgCostMultiplier * costModifier * randomFactor;
    
    // Round cost to nearest 10 rupees
    const cost = Math.round(calculatedCost / 10) * 10;
    
    facility.procedureCosts.push({
      procedureName: proc.procedureName,
      averageCost: cost,
      minCost: Math.round(cost * 0.8),
      maxCost: Math.round(cost * 1.2),
      description: proc.description
    });
  });
});

// Seed the database
const seedDatabase = async () => {
  try {
    // Clear existing data
    await Facility.deleteMany({});
    console.log('Previous facility data cleared');
    
    // Insert new data
    const result = await Facility.insertMany(facilities);
    console.log(`Database seeded with ${result.length} Tamil Nadu healthcare facilities`);
    
    // Close connection
    mongoose.connection.close();
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error seeding database:', err);
    mongoose.connection.close();
  }
};

// Run the seeder
seedDatabase();