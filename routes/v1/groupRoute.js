// routes/groupRoutes.js
import express from 'express'
import { groupController } from '../../controllers/groupController.js'
import multer from 'multer'

const storage = multer.memoryStorage() // Hoặc dùng diskStorage nếu cần lưu file trên ổ cứng
const upload = multer({ storage })
const Router = express.Router()

// Tạo bài viết mới
Router.post(
  '/:groupId/article',
  upload.array('images'),
  groupController.createGroupArticle
)
// Định nghĩa route lấy tất cả bài viết của nhóm mà người dùng đã tham gia
Router.get('/:userId/articles', groupController.getGroupArticles)
// Thêm route lấy danh sách nhóm của người dùng
Router.get('/:userId/joined-groups', groupController.getUserGroups)
Router.get('/:userId/not-joined-groups', groupController.getNotJoinedGroups)
// Lấy tất cả bài viết đã duyệt của group đó
Router.get('/:groupId/articles/processed', groupController.getProcessedArticles)
//API tạo group mới
Router.post('/create', groupController.createGroup)
// API để lấy bài viết chưa được duyệt của group
Router.get('/:groupId/pending-articles', groupController.getPendingArticles)
// API để duyệt bài viết
Router.post(
  '/:groupId/article/:articleId/processed',
  groupController.processedGroupArticle
)
// API để từ chối bài viết
Router.post(
  '/:groupId/article/:articleId/reject',
  groupController.rejectGroupArticle
)
// Route để lấy danh sách thành viên của nhóm
Router.get('/:groupId/members', groupController.getGroupMembers)
// Route để xóa thành viên khỏi nhóm
Router.delete('/:groupId/member/:memberId', groupController.removeMember)
// Route cập nhật quy định nhóm
Router.put('/:groupId/rules', groupController.updateGroupRules)
// Route add quản trị viên
Router.post('/:groupId/add-admin', groupController.addAdmin)
// Xử lí lời màn tham gia nhóm
Router.get('/:groupId/requests', groupController.getRequests)
Router.post('/:groupId/invite/accept', groupController.acceptInvite)
Router.post('/:groupId/invite/reject', groupController.rejectInvite)

export const groupRoute = Router
