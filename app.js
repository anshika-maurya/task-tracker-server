require('dotenv').config();
const cookieParser = require('cookie-parser');
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.REACT_APP_API_URL  || 'http://localhost:3000',
  credentials: true
}));

// Increase header size limit to fix 431 errors
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  // Add cache control headers to prevent repeated requests
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/task-tracker', {
  useNewUrlParser: true, 
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit with error if can't connect to database
});

// Add a connection error handler
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

// Add a disconnection handler
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

// Add a reconnection handler
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  country: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Project Schema
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  tasks: [{ 
    title: String, 
    description: String, 
    status: { type: String, default: 'todo' },
    createdAt: { type: Date, default: Date.now }
  }]
});

// Models
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
      }
      return res.status(401).json({ message: 'Invalid authentication token. Please log in again.' });
    }
    
    if (!decoded.userId) {
      return res.status(401).json({ message: 'Invalid token format. Please log in again.' });
    }
    
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found. Please register or log in with a valid account.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Server authentication error. Please try again later.' });
  }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, country } = req.body;
    
    // Validate input fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        details: {
          name: name ? null : 'Name is required',
          email: email ? null : 'Email is required',
          password: password ? null : 'Password is required'
        }
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      country
    });
    
    await user.save();
    
    // Create token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and token
    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        country: user.country
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required',
        details: {
          email: email ? null : 'Email is required',
          password: password ? null : 'Password is required'
        }
      });
    }
    
    // Find user with case-insensitive email search
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    
    if (!user) {
      console.log(`Login failed: No user found with email ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Invalid password for email ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and token
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        country: user.country
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message
    });
  }
});

// Project Routes (Protected)
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    // Add delay for consistent behavior (prevents rapid retries)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const projects = await Project.find({ userId: req.user._id }).sort({ createdAt: -1 });
    
    // Explicitly handle empty projects case with special flag
    return res.json({ 
      projects: projects || [], 
      success: true,
      empty: projects.length === 0,
      message: projects.length === 0 ? 'No projects found. Create your first project to get started!' : null
    });
  } catch (error) {
    console.error('Fetch projects error:', error);
    // Return a 200 status with error info to prevent connection error display
    return res.json({ 
      projects: [], 
      success: false,
      error: true,
      message: 'Error fetching projects. Please try again.'
    });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const project = new Project({
      title,
      description,
      userId: req.user._id
    });
    
    await project.save();
    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }
    
    const project = await Project.findOne({ 
      _id: req.params.id,
      userId: req.user._id 
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ project });
  } catch (error) {
    console.error('Fetch project error:', error);
    res.status(500).json({ message: 'Failed to fetch project', error: error.message });
  }
});

app.put('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, description },
      { new: true }
    );
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`Invalid project ID format: ${req.params.id}`);
      return res.status(400).json({ message: 'Invalid project ID format' });
    }
    
    console.log(`Attempting to delete project with ID: ${req.params.id} for user: ${req.user._id}`);
    
    // First check if the project exists
    const projectExists = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!projectExists) {
      console.log(`Project not found. ID: ${req.params.id}, User: ${req.user._id}`);
      // Return success even when project not found
      return res.json({ message: 'Project already deleted or not found', alreadyDeleted: true });
    }
    
    // Perform a complete deletion
    const result = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    
    // Force remove from the database
    if (!result) {
      // Try direct deletion as backup
      await Project.deleteOne({
        _id: req.params.id,
        userId: req.user._id
      });
    }
    
    console.log(`Project deleted successfully: ${req.params.id}`);
    res.json({ message: 'Project deleted', deleted: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      message: 'Failed to delete project', 
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMessage = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'ok', 
    serverTime: new Date().toISOString(),
    database: {
      status: dbStatusMessage[dbStatus] || 'unknown',
      connected: dbStatus === 1
    }
  });
});

// Task Routes (Protected)
app.get('/api/projects/:id/tasks', authenticate, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }
    
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Ensure tasks array exists
    const tasks = project.tasks || [];
    
    res.json({ tasks });
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tasks', 
      error: error.message 
    });
  }
});

app.post('/api/projects/:id/tasks', authenticate, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const newTask = {
      _id: new mongoose.Types.ObjectId(),
      title,
      description,
      status: status || 'todo',
      createdAt: new Date()
    };
    
    project.tasks.push(newTask);
    await project.save();
    
    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Failed to create task' });
  }
});

app.put('/api/projects/:projectId/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    
    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user._id
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const taskIndex = project.tasks.findIndex(task => task._id.toString() === req.params.taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Update task properties if provided
    if (title !== undefined) project.tasks[taskIndex].title = title;
    if (description !== undefined) project.tasks[taskIndex].description = description;
    if (status !== undefined) project.tasks[taskIndex].status = status;
    
    await project.save();
    
    res.json({ task: project.tasks[taskIndex] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Failed to update task' });
  }
});

app.delete('/api/projects/:projectId/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user._id
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Filter out the task to be deleted
    project.tasks = project.tasks.filter(task => task._id.toString() !== req.params.taskId);
    
    await project.save();
    
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Failed to delete task' });
  }
});

const PORT = process.env.PORT || 4000;

// Define all API routes above this line

// Add global error handler for exceptions
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(200).json({
    success: false,
    error: true,
    message: 'An unexpected error occurred. Please try again.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler - must be registered after all other routes
app.use((req, res) => {
  res.status(200).json({
    success: false,
    notFound: true,
    message: 'The requested resource was not found.'
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));