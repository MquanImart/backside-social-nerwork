import mongoose from 'mongoose'

const articleSchema = new mongoose.Schema({
  sharedPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  idHandler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  handleDate: Date,
  reports: [
    {
      _idReporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      reportDate: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['pending', 'processed', 'rejected'],
        default: 'pending'
      }
    }
  ],
  groupID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  content: { type: String, required: true },
  hashTag: [String],
  listPhoto: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MyPhoto' }],
  scope: {
    type: String,
    default: 'public',
    enum: ['public', 'friends', 'private']
  },
  interact: {
    emoticons: [
      {
        typeEmoticons: String,
        _iduser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    comment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
  },
  totalLikes: { type: Number, default: 0 }, // Thêm tổng số like
  totalComments: { type: Number, default: 0 }, // Thêm tổng số bình luận
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

const Article = mongoose.model('Article', articleSchema)

export default Article
