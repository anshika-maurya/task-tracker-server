const Project = require('../models/Project');
const User = require('../models/User');

// Create a new project
const createProject = async (req, res) => {
  try {
    req.body.user = req.user.userId;
    
    const project = await Project.create(req.body);
    
    // Add project to user's projects array
    await User.findByIdAndUpdate(
      req.user.userId,
      { $push: { projects: project._id } },
      { new: true, runValidators: true }
    );
    
    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all user's projects
const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user.userId });
    res.status(200).json({ projects, count: projects.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single project
const getProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const project = await Project.findOne({
      _id: projectId,
      user: req.user.userId
    }).populate('tasks');
    
    if (!project) {
      return res.status(404).json({ message: `No project with id ${projectId}` });
    }
    
    res.status(200).json({ project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a project
const updateProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    
    const project = await Project.findOneAndUpdate(
      { _id: projectId, user: req.user.userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({ message: `No project with id ${projectId}` });
    }
    
    res.status(200).json({ project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a project
const deleteProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    
    const project = await Project.findOneAndDelete({
      _id: projectId,
      user: req.user.userId
    });
    
    if (!project) {
      return res.status(404).json({ message: `No project with id ${projectId}` });
    }
    
    // Remove project from user's projects array
    await User.findByIdAndUpdate(
      req.user.userId,
      { $pull: { projects: projectId } },
      { new: true }
    );
    
    res.status(200).json({ message: 'Project removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject
}; 