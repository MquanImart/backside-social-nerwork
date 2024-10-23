import { dashboardService } from '../services/dashboardService.js'

// Lấy thống kê tổng quan
const getSummary = async (req, res) => {
  try {
    const summaryData = await dashboardService.fetchSummaryService()
    res.status(200).json(summaryData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy người dùng mới trong tuần
const getNewUsersInWeek = async (req, res) => {
  try {
    const newUsersData = await dashboardService.fetchNewUsersInWeekService()
    res.status(200).json(newUsersData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy tăng trưởng người dùng theo tuần
const getUserGrowth = async (req, res) => {
  try {
    const userGrowthData = await dashboardService.fetchUserGrowthService()
    res.status(200).json(userGrowthData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Lấy phân phối người dùng theo nhóm
const getGroupDistribution = async (req, res) => {
  try {
    const groupDistributionData =
      await dashboardService.fetchGroupDistributionService()
    res.status(200).json(groupDistributionData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const dashboardController = {
  getSummary,
  getNewUsersInWeek,
  getUserGrowth,
  getGroupDistribution
}
