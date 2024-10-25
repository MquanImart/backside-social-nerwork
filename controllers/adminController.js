import { adminService } from '../services/adminService.js'

// Lấy thống kê tổng quan
const getSummary = async (req, res) => {
  try {
    const summaryData = await adminService.fetchSummaryService()
    res.status(200).json(summaryData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy người dùng mới trong tuần
const getNewUsersInWeek = async (req, res) => {
  try {
    const newUsersData = await adminService.fetchNewUsersInWeekService()
    res.status(200).json(newUsersData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy tăng trưởng người dùng theo tuần
const getUserGrowth = async (req, res) => {
  try {
    const userGrowthData = await adminService.fetchUserGrowthService()
    res.status(200).json(userGrowthData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy phân phối người dùng theo nhóm
const getGroupDistribution = async (req, res) => {
  try {
    const groupDistributionData =
      await adminService.fetchGroupDistributionService()
    res.status(200).json(groupDistributionData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
const getAllUsersController = async (req, res) => {
  try {
    // Gọi service để lấy toàn bộ danh sách người dùng
    const users = await adminService.getAllUsersService()

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
  const result = await adminService.lockUnlockUserService(userId, action)

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

export const adminController = {
  getSummary,
  getNewUsersInWeek,
  getUserGrowth,
  getGroupDistribution,
  getAllUsersController,
  lockUnlockUser
}
