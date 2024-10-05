import mongoose from 'mongoose'

const collectionSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  items: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

const friendSchema = new mongoose.Schema({
  idUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Thêm idUser vào cấu trúc sub-document
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
  userName: { type: String, unique: true, default: '' },
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
  hobbies: [String],
  listArticle: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

const User = mongoose.model('User', userSchema)

export default User
