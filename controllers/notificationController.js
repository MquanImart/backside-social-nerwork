import { notificationService } from '../services/notificationService.js'

// Controller xử lý yêu cầu lấy tất cả thông báo của người dùng
const getNotifications = async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId parameter' })
  }

  try {
    const notifications = await notificationService.fetchNotifications(userId)
    res.status(200).json({ status: 200, data: notifications })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
}

// Controller xử lý yêu cầu cập nhật trạng thái thông báo
const updateNotificationStatus = async (req, res) => {
  const { id } = req.params
  const { status, readAt } = req.body

  if (!id || !status || !readAt) {
    return res.status(400).json({ message: 'Missing parameters' })
  }

  try {
    const updatedNotification = await notificationService.updateNotification(
      id,
      status,
      readAt
    )
    if (updatedNotification) {
      res.status(200).json({
        status: 200,
        data: updatedNotification,
        message: 'Notification updated successfully'
      })
    } else {
      res.status(404).json({ status: 404, message: 'Notification not found' })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update notification status' })
  }
}

const markAsUnread = async (req, res) => {
  const { notificationId } = req.params

  try {
    const updatedNotification = await notificationService.markAsUnreadService(
      notificationId
    )
    res.status(200).json({
      message: 'Notification marked as unread',
      data: updatedNotification
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Controller to soft delete a notification (update _destroy timestamp)
const softDeleteNotification = async (req, res) => {
  const { notificationId } = req.params

  try {
    const deletedNotification =
      await notificationService.softDeleteNotificationService(notificationId)
    res.status(200).json({
      message: 'Notification soft deleted successfully',
      data: deletedNotification
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const notificationController = {
  getNotifications,
  updateNotificationStatus,
  markAsUnread,
  softDeleteNotification
}
