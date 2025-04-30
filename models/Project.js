const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a project title'],
    trim: true,
    maxlength: [100, 'Project title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a project description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide a user']
  },
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema); 