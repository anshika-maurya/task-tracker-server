const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register a new user
const register = async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = await User.create({ ...req.body });
    
    // Create token
    const token = jwt.sign(
      { userId: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_LIFETIME }
    );
    
    res.status(201).json({
      user: {
        name: user.name,
        email: user.email,
        country: user.country,
        id: user._id
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { userId: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_LIFETIME }
    );
    
    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        country: user.country,
        id: user._id
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login
}; 