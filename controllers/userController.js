import { userService } from '../services/userService.js'

// Đăng ký người dùng mới
const getUserById = async (req, res) => {
  const { userId } = req.params

  try {
    const user = await userService.getUserByIdService(userId) // Sử dụng service để lấy người dùng

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' })
    }

    res.status(200).json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const getArticlesByCollectionId = async (req, res) => {
  const { userId, collectionId } = req.params

  try {
    const articles = await userService.getArticlesByCollectionIdService(
      userId,
      collectionId
    )

    return res.status(200).json(articles)
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const getAllUsersController = async (req, res) => {
  try {
    // Gọi service để lấy toàn bộ danh sách người dùng
    const users = await userService.getAllUsersService()

    // Trả về dữ liệu người dùng
    return res.status(200).json({
      success: true,
      data: users
    })
  } catch (error) {
    // Trả về lỗi nếu có vấn đề xảy ra
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy dữ liệu người dùng.',
      error: error.message
    })
  }
}

const lockUnlockUser = async (req, res) => {
  const { userId, action } = req.params

  // Gọi service để xử lý logic khóa/mở khóa
  const result = await userService.lockUnlockUserService(userId, action)

  if (result.success) {
    return res.status(200).json({
      message: result.message,
      status: result.status
    })
  } else {
    return res.status(result.message === 'User not found.' ? 404 : 400).json({
      message: result.message
    })
  }
}

export const userController = {
  getUserById,
  getArticlesByCollectionId,
  getAllUsersController,
  lockUnlockUser
}
