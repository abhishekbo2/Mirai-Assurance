const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./models/Hospital');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected for Seeding..."))
  .catch(err => console.log(err));

const hospitals = [
  {
    name: "Manipal Hospital",
    city: "Bangalore",
    address: "Old Airport Road, HAL",
    isNetwork: true, 
    location: { lat: 12.9592, lng: 77.6444 },
    contact: "080-2222-1111"
  },
  {
    name: "Apollo Hospitals",
    city: "Bangalore",
    address: "Bannerghatta Road",
    isNetwork: true, 
    location: { lat: 12.8950, lng: 77.5979 },
    contact: "080-4668-8888"
  },
  {
    name: "St. John's Medical College",
    city: "Bangalore",
    address: "Koramangala",
    isNetwork: false, 
    location: { lat: 12.9341, lng: 77.6121 },
    contact: "080-2206-5000"
  },
  {
    name: "Narayana Health City",
    city: "Bangalore",
    address: "Electronic City",
    isNetwork: true,
    location: { lat: 12.8118, lng: 77.6934 },
    contact: "080-7122-2222"
  },
  {
    name: "Fortis Hospital",
    city: "Bangalore",
    address: "Cunningham Road",
    isNetwork: false,
    location: { lat: 12.9890, lng: 77.5934 },
    contact: "080-4199-4444"
  }
];

const seedDB = async () => {
  await Hospital.deleteMany({}); 
  await Hospital.insertMany(hospitals);
  console.log("Hospitals Seeded Successfully! 🏥");
  process.exit();
};

seedDB();