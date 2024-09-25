const mongoose = require('mongoose')

const myPhotoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  idAuthor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: { type: String, enum: ['img', 'video'], required: true },
  link: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

module.exports = mongoose.model('MyPhoto', myPhotoSchema)
