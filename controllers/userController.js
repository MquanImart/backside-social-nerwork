import { userService } from '../services/userService.js'
import { cloudStorageService } from '../services/cloudStorageService.js'

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

const followUser = async (req, res) => {
  const { userId } = req.params
  const follower = req.query.follow;
  try {
    const result = await userService.followUser(
      userId,
      follower
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi khi theo dõi người dùng:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const unFollowUser = async (req, res) => {
  const { userId } = req.params
  const follower = req.query.unfollow;
  try {
    const result = await userService.unFollowUser(
      userId,
      follower
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi khi theo dõi người dùng:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const RelationShip = async (req, res) => {
  const { userId } = req.params
  const follower = req.query.frienId;
  try {
    const result = await userService.RelationShip(
      userId,
      follower
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi khi theo dõi người dùng:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const getUserDataFriends = async (req, res) => {
  const { userId } = req.params
  try {
    const result = await userService.getUserDataFriends(
      userId
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const getUserDataFollower = async (req, res) => {
  const { userId } = req.params
  try {
    const result = await userService.getUserDataFollower(
      userId
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

const updateUser = async (req, res) => {
  const { userId } = req.params;
  const data = req.body; 
  const avtFile = req.files?.avatar ? req.files.avatar[0] : null
  const backGroundFile = req.files?.background
    ? req.files.background[0]
    : null
  try {
    let avtUrl = ''
    let backGroundUrl = ''

    if (avtFile) {
      avtUrl = await cloudStorageService.uploadImageUserToStorage(
        avtFile,
        userId,
        'avatar'
      )
    }
    if (backGroundFile) {
      backGroundUrl = await cloudStorageService.uploadImageUserToStorage(
        backGroundFile,
        userId,
        'background'
      )
    }

    const result = await userService.updateUser(
      userId, data, avtUrl, backGroundUrl
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}
const getUserHobbies = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await userService.getUserHobbies(userId)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi:', error)
    return res.status(500).json({ msg: 'Lỗi server' })
  }
}

export const userController = {
  getUserById,
  getArticlesByCollectionId,
  followUser, unFollowUser,
  RelationShip,
  getUserDataFriends,
  getUserDataFollower,
  updateUser,
  getUserHobbies,
}
