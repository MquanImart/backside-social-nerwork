import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  warningLevel: { type: Number, enum: [0, 1, 2, 3], default: 0 },
  groupName: { type: String, required: true },
  type: { type: String, enum: ['public', 'private'], required: true },
  idAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  introduction: String,
  avt: { type: mongoose.Schema.Types.ObjectId, ref: 'MyPhoto' }, // Thay đổi để tham chiếu đến MyPhoto
  backGround: { type: mongoose.Schema.Types.ObjectId, ref: 'MyPhoto' }, // Thay đổi để tham chiếu đến MyPhoto
  members: {
    count: { type: Number, default: 0 },
    listUsers: [
      {
        idUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        state: {
          type: String,
          enum: ['pending', 'accepted', 'rejected'],
          default: 'pending',
        },
        joinDate: { type: Date, default: Date.now },
      },
    ],
  },
  article: {
    count: { type: Number, default: 0 },
    listArticle: [
      {
        idArticle: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
        state: {
          type: String,
          enum: ['pending', 'processed', 'rejected'],
          default: 'pending',
        },
      },
    ],
  },
  rule: {
    type: [String], // Mảng các quy định dạng chuỗi
    default: [],    // Giá trị mặc định là mảng rỗng
  },
  Administrators: [
    {
      idUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      state: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
      },
      joinDate: { type: Date, default: Date.now },
    },
  ],
  hobbies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hobby' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date,
});


const Group = mongoose.model('Group', groupSchema);

export default Group;
