const User = require('../models/User');
const Application = require('../models/Application');
const Claim = require('../models/Claim');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyOidcAccessToken } = require('../middleware/authMiddleware');
const LinkingTransaction = require('../models/LinkingTransaction');

const createLocalToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('Local JWT authentication is not configured.');
    }

    return jwt.sign(
        { id: user._id.toString(), authenticationMethod: 'local' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' },
    );
};

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!name?.trim() || !normalizedEmail || !password || password.length < 6) {
            return res.status(400).json({ msg: 'Name, email, and a password of at least 6 characters are required.' });
        }

        if (await User.findOne({ email: normalizedEmail })) {
            return res.status(400).json({ msg: 'User already exists. Please sign in instead.' });
        }

// // next time when i am going to hash a password i will use a secret pepper to the password and then hash the password that i got after adding pepper then give for bcrypt with the salt value(to create a unique hash value even the password of many users are same). 

// for storing 
// const passwordWithPepper = crypto
//       .createHmac('sha256', pepper)
//       .update(password)
//       .digest('hex');

//     // 3. Let bcrypt generate the salt and hash the result
//     const saltRounds = 10; 
//     const hashedPassword = await bcrypt.hash(passwordWithPepper, saltRounds);


// // for verifying 
//  const pepper = process.env.PASSWORD_PEPPER;
//     const passwordWithPepper = crypto
//       .createHmac('sha256', pepper)
//       .update(password)
//       .digest('hex');

//     // 3. Compare with the database hash (Bcrypt extracts its salt automatically)
//     const isMatch = await bcrypt.compare(passwordWithPepper, user.password);


        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: passwordHash,
            role: 'customer',
            authProvider: 'local',
        });

        res.status(201).json({
            msg: 'Registration successful. Please sign in.',
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ msg: 'Registration failed.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail }).select('+password');

        if (!user?.password || !(await bcrypt.compare(password || '', user.password))) {
            return res.status(401).json({ msg: 'Invalid email or password.' });
        }

        const token = createLocalToken(user);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ msg: 'Login failed.' });
    }
};

exports.startOidcLink = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!user?.password) {
            return res.status(400).json({ msg: 'A local password is required before linking Keycloak.' });
        }

        const transactionId = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(transactionId).digest('hex');
        await LinkingTransaction.create({
            tokenHash,
            user: user._id,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        res.status(201).json({ transactionId });
    } catch (err) {
        res.status(500).json({ msg: 'Unable to start Keycloak linking.' });
    }
};

exports.linkOidcAccount = async (req, res) => {
    try {
        const { transactionId } = req.body || {};
        if (!/^[A-Za-z0-9_-]{43}$/.test(transactionId || '')) {
            return res.status(400).json({ msg: 'A valid linking transaction is required.' });
        }

        const authorization = req.header('Authorization');
        const token = authorization?.startsWith('Bearer ')
            ? authorization.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({ msg: 'A Keycloak authentication is required.' });
        }

        const { payload, issuer } = await verifyOidcAccessToken(token);
        const tokenHash = crypto.createHash('sha256').update(transactionId).digest('hex');
        const pendingTransaction = await LinkingTransaction.findOne({
            tokenHash,
            consumedAt: null,
            expiresAt: { $gt: new Date() },
        });
        if (!pendingTransaction) {
            return res.status(400).json({ msg: 'The linking transaction is invalid, expired, or already used.' });
        }

        const existingIdentity = await User.findOne({
            oidcIssuer: issuer,
            oidcSubject: payload.sub,
        });

        if (existingIdentity && existingIdentity._id.toString() !== pendingTransaction.user.toString()) {
            return res.status(409).json({ msg: 'This Keycloak account is already linked to another application account.' });
        }

        const transaction = await LinkingTransaction.findOneAndUpdate(
            { tokenHash, consumedAt: null, expiresAt: { $gt: new Date() } },
            { $set: { consumedAt: new Date() } },
            { new: true },
        );
        if (!transaction) {
            return res.status(400).json({ msg: 'The linking transaction is invalid, expired, or already used.' });
        }

        const user = await User.findById(transaction.user).select('+password');
        if (!user?.password) {
            return res.status(400).json({ msg: 'A local password is required before linking Keycloak.' });
        }

        user.oidcIssuer = issuer;
        user.oidcSubject = payload.sub;
        user.authProvider = 'hybrid';
        await user.save();

        res.json({
            msg: 'Keycloak account linked successfully.',
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        const status = err.statusCode || 401;
        res.status(status).json({
            msg: status === 401 ? 'Unable to verify the Keycloak account.' : err.message,
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        // req.user is set by the protect middleware
        if (!req.user || !req.user.id) {
            console.error('No user ID in token:', req.user);
            return res.status(401).json({ msg: "Invalid token: No user ID" });
        }

        const userId = req.user.id;
        console.log('Fetching profile for userId:', userId);
        
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found for ID:', userId);
            return res.status(404).json({ msg: "User not found" });
        }

        // Get user's insurance applications
        const applications = await Application.find({ user: userId })
            .populate('plan', 'title category coverage premium basePremium minEligibleAge maxEligibleAge coveredConditions terms exclusions networkBenefits')
            .sort({ appliedDate: -1 });

        // Get user's claims
        const claims = await Claim.find({ user: userId })
            .populate('policy')
            .sort({ _id: -1 });

        console.log('Profile fetched successfully for user:', user.email);
        const profileImage = user.profileImage?.data
            ? `data:${user.profileImage.contentType || 'image/jpeg'};base64,${user.profileImage.data.toString('base64')}`
            : null;

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                authProvider: user.authProvider,
                role: user.role,
                profileImage
            },
            applications: applications || [],
            claims: claims || []
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ msg: "Server Error fetching profile: " + err.message });
    }
};

exports.uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'Please select an image file (up to 5 MB).' });
        }

        const profileImage = {
            data: req.file.buffer,
            contentType: req.file.mimetype
        };
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profileImage },
            { new: true }
        );

        if (!user) return res.status(404).json({ msg: 'User not found' });
        const imageDataUrl = `data:${profileImage.contentType};base64,${profileImage.data.toString('base64')}`;
        res.json({ msg: 'Profile photo updated successfully', profileImage: imageDataUrl });
    } catch (err) {
        res.status(500).json({ msg: 'Unable to upload profile photo' });
    }
};




