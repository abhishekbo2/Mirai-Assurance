const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  authProvider: {
    type: String,
    enum: ['local', 'oidc', 'hybrid'],
    default: 'local',
  },
  oidcSubject: { type: String, unique: true, sparse: true },
  oidcIssuer: { type: String, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  profileImage: {
    data: { type: Buffer, default: null },
    contentType: { type: String, default: null }
  }
});

userSchema.index({ oidcIssuer: 1, oidcSubject: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);



