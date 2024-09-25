const mongoose = require('mongoose')

const collectionSchema = new mongoose.Schema({
  _id: String,
  name: String,
  items: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

const friendSchema = new mongoose.Schema({
  userId: String,
  addDate: { type: Date, default: Date.now }
})

const userSchema = new mongoose.Schema({
  account: {
    warningLevel: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  displayName: String,
  userName: { type: String, required: true, unique: true },
  details: {
    phoneNumber: String,
    address: String,
    gender: Boolean,
    birthDate: Date
  },
  friends: [friendSchema],
  status: { type: String, default: 'active' },
  avt: [String],
  collections: [collectionSchema],
  groups: [String],
  backGround: [String],
  aboutMe: String,
  createDate: { type: Date, default: Date.now },
  hobbies: [String],
  listArticle: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

module.exports = mongoose.model('User', userSchema)
