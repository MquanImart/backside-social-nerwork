const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
  _iduser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: { type: String, required: true },
  img: [String],
  replyComment: [this],
  emoticons: [
    {
      typeEmoticons: String,
      _iduser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

const articleSchema = new mongoose.Schema({
  sharedPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null
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
  listPhoto: [String],
  scope: { type: String, default: 'public' },
  interact: {
    emoticons: [
      {
        typeEmoticons: String,
        _iduser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    comment: [commentSchema]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

module.exports = mongoose.model('Article', articleSchema)
