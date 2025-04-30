const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  // Check header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication invalid' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the user to the request object
    req.user = { userId: payload.userId, name: payload.name };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication invalid' });
  }
};

module.exports = auth; 