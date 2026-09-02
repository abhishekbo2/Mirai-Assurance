const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  isNetwork: { type: Boolean, default: false },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  contact: String
});

module.exports = mongoose.model('Hospital', hospitalSchema);