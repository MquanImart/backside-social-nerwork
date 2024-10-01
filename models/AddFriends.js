import mongoose from 'mongoose'

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

const AddFriends = mongoose.model('AddFriends', addFriendsSchema)

export default AddFriends
