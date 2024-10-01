import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  _user: {
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  content: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      message: {
        type: {
          type: String,
          enum: ['text', 'image', 'video'],
          required: true
        },
        data: { type: String, required: true }
      },
      sendDate: { type: Date, default: Date.now }
    }
  ]
})

const Conversation = mongoose.model('Conversation', conversationSchema)

export default Conversation