import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
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
  message: { type: String, required: true },
  status: { type: String, enum: ['read', 'unread'], default: 'unread' },
  readAt: Date,
  createdAt: { type: Date, default: Date.now },
  _destroy: Date
})

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification
