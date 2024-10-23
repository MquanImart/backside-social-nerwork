import User from '../models/User.js'
import Group from '../models/Group.js'
import Article from '../models/Article.js'

// Lấy dữ liệu tổng quan
const fetchSummaryService = async () => {
  const totalUsers = await User.countDocuments()
  const totalGroups = await Group.countDocuments()
  const totalArticles = await Article.countDocuments()
  const newUsers = await User.countDocuments({
    createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
  })

  return {
    totalUsers,
    totalGroups,
    totalArticles,
    newUsers
  }
}

// Lấy người dùng mới trong tuần
const fetchNewUsersInWeekService = async () => {
  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]
  const result = []

  for (let i = 0; i < 7; i++) {
    const startOfDay = new Date()
    startOfDay.setDate(startOfDay.getDate() - i)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setHours(23, 59, 59, 999)

    const usersCount = await User.countDocuments({
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })

    result.push({
      day: daysOfWeek[startOfDay.getDay()],
      count: usersCount
    })
  }

  return result.reverse()
}

// Lấy tăng trưởng người dùng theo tuần
const fetchUserGrowthService = async () => {
  const weeks = []
  for (let i = 0; i < 4; i++) {
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - i * 7)
    startOfWeek.setHours(0, 0, 0, 0)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()) // Lấy ngày bắt đầu của tuần

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const userGrowth = await User.countDocuments({
      createdAt: {
        $gte: startOfWeek,
        $lt: endOfWeek
      }
    })

    weeks.push({
      week: `Week ${i + 1}`,
      count: userGrowth
    })
  }

  return weeks.reverse()
}

// Lấy phân phối người dùng theo nhóm
const fetchGroupDistributionService = async () => {
  const groupData = await Group.aggregate([
    {
      $project: {
        groupName: 1,
        memberCount: { $size: '$members.listUsers' }
      }
    },
    {
      $group: {
        _id: null,
        groups: {
          $push: {
            name: '$groupName',
            count: '$memberCount'
          }
        }
      }
    }
  ])

  return groupData[0].groups
}

export const dashboardService = {
  fetchSummaryService,
  fetchNewUsersInWeekService,
  fetchUserGrowthService,
  fetchGroupDistributionService
}
