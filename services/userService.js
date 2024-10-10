import User from '../models/User.js'
import Article from '../models/Article.js'
import mongoose from 'mongoose'

// Hàm để lấy thông tin người dùng theo ID
const getUserByIdService = async (userId) => {
  const user = await User.findById(userId).select('-_destroy -__v') // Chọn không trả về các trường không cần thiết
  return user
}

// Hàm lấy bài viết trong bộ sưu tập của người dùng
const getArticlesByCollectionIdService = async (userId, collectionId) => {
  // Tìm người dùng theo userId
  const user = await User.findById(userId)

  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }

  // Tìm bộ sưu tập theo collectionId
  const collection = user.collections.find(
    (col) => col._id.toString() === collectionId
  )

  if (!collection) {
    throw new Error('Bộ sưu tập không tồn tại')
  }

  // Log the collection items to verify
  console.log('Collection Items:', collection.items)

  // Convert string IDs to ObjectId using 'new'
  const articleIds = collection.items.map(
    (id) => new mongoose.Types.ObjectId(id)
  )

  // Lấy danh sách bài viết theo items trong bộ sưu tập
  const articles = await Article.find({ _id: { $in: articleIds } })

  // Log the fetched articles
  console.log('Fetched Articles:', articles)

  return articles
}

export const userService = {
  getUserByIdService,
  getArticlesByCollectionIdService
}
