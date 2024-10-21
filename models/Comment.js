import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  _iduser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: { type: String, required: true },
  img: [String],
  replyComment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  emoticons: [
    {
      typeEmoticons: String,
      _iduser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  totalLikes: { type: Number, default: 0 }, // Thêm tổng số like
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

const Comment = mongoose.model('Comment', commentSchema)

export default Comment
