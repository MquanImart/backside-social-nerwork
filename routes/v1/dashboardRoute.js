import express from 'express'
import { dashboardController } from '../../controllers/dashboardController.js'

const Router = express.Router()

Router.get('/summary', dashboardController.getSummary)

// Route thống kê người dùng mới trong tuần
Router.get('/new-users-week', dashboardController.getNewUsersInWeek)

// Route thống kê tăng trưởng người dùng theo tuần
Router.get('/user-growth', dashboardController.getUserGrowth)

// Route thống kê phân phối người dùng theo nhóm
Router.get('/group-distribution', dashboardController.getGroupDistribution)

export const dashboardRoute = Router
