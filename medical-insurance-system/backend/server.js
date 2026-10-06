require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./utils/errorHandler');
const path = require('path');

const app = express();
connectDB();
require('./models/User');
require('./utils/renewalCron');
require('./models/InsurancePlan');
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/policies', require('./routes/policyRoutes'));
app.use('/api/renewal-approvals', require('./routes/renewalApprovalRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/hospitals', require('./routes/hospitalRoutes'));
app.use('/api/claims', require('./routes/claimRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(errorHandler);

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
