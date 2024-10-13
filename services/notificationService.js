import Notification from '../models/Notification.js'
// Service để lấy danh sách thông báo từ database (chỉ lấy thông báo chưa bị xoá mềm)
const fetchNotifications = async (userId) => {
  try {
    const notifications = await Notification.find({
      receiverId: userId,
      _destroy: null // Chỉ lấy các thông báo mà _destroy là null (chưa bị xoá mềm)
    }).sort({
      createdAt: -1
    })

    return notifications
  } catch (error) {
    throw new Error('Error fetching notifications')
  }
}

// Service để cập nhật trạng thái thông báo từ 'unread' sang 'read'
const updateNotification = async (id, status, readAt) => {
  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { status, readAt },
      { new: true } // Trả về đối tượng đã được cập nhật
    )
    return updatedNotification
  } catch (error) {
    throw new Error('Error updating notification')
  }
}

// Service to mark a notification as unread
const markAsUnreadService = async (notificationId) => {
  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: 'unread', readAt: null },
      { new: true }
    )

    if (!updatedNotification) {
      throw new Error('Notification not found')
    }

    return updatedNotification
  } catch (error) {
    throw new Error('Error marking notification as unread')
  }
}

// Soft delete by updating _destroy with the current date
const softDeleteNotificationService = async (notificationId) => {
  try {
    const deletedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { _destroy: new Date() }, // Soft delete by setting _destroy field to current date
      { new: true }
    )

    if (!deletedNotification) {
      throw new Error('Notification not found')
    }

    return deletedNotification
  } catch (error) {
    throw new Error('Error soft deleting notification')
  }
}

export const notificationService = {
  fetchNotifications,
  updateNotification,
  markAsUnreadService,
  softDeleteNotificationService
}