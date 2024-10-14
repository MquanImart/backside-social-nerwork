import express from 'express'
import { notificationController } from '../../controllers/notificationController.js'

const Router = express.Router()

// Route để lấy tất cả thông báo của người dùng
Router.get('/', notificationController.getNotifications)
// Route để cập nhật trạng thái thông báo
Router.put('/:id', notificationController.updateNotificationStatus)
// Route để đánh dấu trạng thái chưa đọc
Router.put('/:notificationId/unread', notificationController.markAsUnread)
// Route to soft delete a notification (update _destroy)
Router.delete('/:notificationId', notificationController.softDeleteNotification)

export const notificationRoute = Router
