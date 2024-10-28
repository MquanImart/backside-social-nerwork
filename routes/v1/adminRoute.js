import express from 'express'
import { adminController } from '../../controllers/adminController.js'

const Router = express.Router()

Router.get('/summary', adminController.getSummary)

// Route thống kê người dùng mới trong tuần
Router.get('/new-users-week', adminController.getNewUsersInWeek)

// Route thống kê tăng trưởng người dùng theo tuần
Router.get('/user-growth', adminController.getUserGrowth)

// Route thống kê phân phối người dùng theo nhóm
Router.get('/group-distribution', adminController.getGroupDistribution)

Router.get('/management-users', adminController.getAllUsersController)

//API khoá và mở khoá tài khoản của admin
Router.put('/:userId/:action', adminController.lockUnlockUser)

export const adminRoute = Router
