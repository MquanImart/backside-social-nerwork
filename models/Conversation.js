import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  _user: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  content: [
    {
      _id: false,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      message: {
        type: {
          type: String,
          enum: ['text', 'image', 'video'],
          required: true
        },
        data: { type: String, required: true }
      },
      sendDate: { type: Date, default: Date.now },
      viewDate: { type: Date, default: null }
    }
  ]
})

const Conversation = mongoose.model('Conversation', conversationSchema)

export default Conversation