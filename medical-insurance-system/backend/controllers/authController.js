const User = require('../models/User');
const Application = require('../models/Application');
const Claim = require('../models/Claim');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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




