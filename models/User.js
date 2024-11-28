import mongoose from 'mongoose'

const collectionSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true }, // Thêm 'sparse: true' để cho phép nhiều null
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
  displayName: {
    type: String,
    default: function () {
      return `${this.firstName} ${this.lastName}`
    }
  },
  userName: { type: String, unique: true, default: Date.now },
  details: {
    phoneNumber: String,
    address: String,
    gender: Boolean,
    birthDate: Date 
  },
  friends: [friendSchema],
  status: { type: String, default: 'active' },
  avt: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MyPhoto' }], 
  collections: [collectionSchema],
  groups: [String],
  follow: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  backGround: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MyPhoto' }],
  aboutMe: String,
  hobbies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hobby' }],
  listArticle: [String],
  setting: {
    profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' }, 
    allowMessagesFromStrangers: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

// Middleware để thêm collection mặc định "Tất cả mục đã lưu"
userSchema.pre('save', function (next) {
  if (this.collections.length === 0) {
    this.collections.push({
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Tất cả mục đã lưu',
      items: []
    })
  }
  next()
})

const User = mongoose.model('User', userSchema)

export default User
