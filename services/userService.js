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

const getAllUsersService = async () => {
  try {
    // Lấy tất cả người dùng từ cơ sở dữ liệu
    const users = await User.find()

    // Trả về danh sách người dùng
    return users
  } catch (error) {
    throw new Error('Lỗi khi truy xuất người dùng: ' + error.message)
  }
}
const lockUnlockUserService = async (userId, action) => {
  try {
    // Kiểm tra action có phải 'lock' hoặc 'unlock'
    if (action !== 'lock' && action !== 'unlock') {
      return {
        success: false,
        message: 'Invalid action. Use "lock" or "unlock".'
      }
    }

    // Tìm người dùng theo userId
    const user = await User.findById(userId)
    if (!user) {
      return { success: false, message: 'User not found.' }
    }

    // Cập nhật trạng thái tài khoản
    const newStatus = action === 'lock' ? 'locked' : 'active'
    user.status = newStatus
    user.updatedAt = new Date()

    // Lưu người dùng sau khi cập nhật
    await user.save()

    return {
      success: true,
      message: `User account ${
        action === 'lock' ? 'locked' : 'unlocked'
      } successfully.`,
      status: user.status
    }
  } catch (error) {
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    }
  }
}
export const userService = {
  getUserByIdService,
  getArticlesByCollectionIdService,
  getAllUsersService,
  lockUnlockUserService
}
