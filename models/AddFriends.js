const mongoose = require('mongoose')

const addFriendsSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['accepted', 'pending', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  acceptedAt: Date
})

module.exports = mongoose.model('AddFriends', addFriendsSchema)
