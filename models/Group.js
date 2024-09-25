const mongoose = require('mongoose')

const groupSchema = new mongoose.Schema({
  warningLevel: { type: Number, enum: [0, 1, 2, 3], default: 0 },
  groupName: { type: String, required: true },
  type: { type: String, enum: ['public', 'private'], required: true },
  idAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  introduction: String,
  avt: String,
  backGround: String,
  members: {
    count: { type: Number, default: 0 },
    listUsers: [
      {
        idUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinDate: { type: Date, default: Date.now }
      }
    ]
  },
  article: {
    count: { type: Number, default: 0 },
    listArticle: [
      {
        idArticle: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
        state: String
      }
    ]
  },
  rule: [String],
  Administrators: [
    {
      idUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      joinDate: { type: Date, default: Date.now }
    }
  ],
  hobbies: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

module.exports = mongoose.model('Group', groupSchema)
