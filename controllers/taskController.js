const Task = require('../models/Task');
const Project = require('../models/Project');

// Create a new task
const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists and belongs to user
    const project = await Project.findOne({
      _id: projectId,
      user: req.user.userId
    });
    
    if (!project) {
      return res.status(404).json({ message: `No project with id ${projectId}` });
    }
    
    // Add user and project to task data
    req.body.user = req.user.userId;
    req.body.project = projectId;
    
    const task = await Task.create(req.body);
    
    // Add task to project's tasks array
    await Project.findByIdAndUpdate(
      projectId,
      { $push: { tasks: task._id } },
      { new: true }
    );
    
    res.status(201).json({ task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all tasks for a project
const getAllTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists and belongs to user
    const project = await Project.findOne({
      _id: projectId,
      user: req.user.userId
    });
    
    if (!project) {
      return res.status(404).json({ message: `No project with id ${projectId}` });
    }
    
    const tasks = await Task.find({ project: projectId });
    res.status(200).json({ tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single task
const getTask = async (req, res) => {
  try {
    const { id: taskId, projectId } = req.params;
    
    const task = await Task.findOne({
      _id: taskId,
      project: projectId,
      user: req.user.userId
    });
    
    if (!task) {
      return res.status(404).json({ message: `No task with id ${taskId}` });
    }
    
    res.status(200).json({ task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a task
const updateTask = async (req, res) => {
  try {
    const { id: taskId, projectId } = req.params;
    
    // If status is being updated to completed, set completedAt date
    if (req.body.status === 'completed' && !req.body.completedAt) {
      req.body.completedAt = new Date();
    }
    
    const task = await Task.findOneAndUpdate(
      {
        _id: taskId,
        project: projectId,
        user: req.user.userId
      },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({ message: `No task with id ${taskId}` });
    }
    
    res.status(200).json({ task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  try {
    const { id: taskId, projectId } = req.params;
    
    const task = await Task.findOneAndDelete({
      _id: taskId,
      project: projectId,
      user: req.user.userId
    });
    
    if (!task) {
      return res.status(404).json({ message: `No task with id ${taskId}` });
    }
    
    // Remove task from project's tasks array
    await Project.findByIdAndUpdate(
      projectId,
      { $pull: { tasks: taskId } },
      { new: true }
    );
    
    res.status(200).json({ message: 'Task removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTask,
  updateTask,
  deleteTask
}; 