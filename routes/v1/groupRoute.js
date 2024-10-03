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
Router.get('/:userId/joined-groups', groupController.getUserGroups) // Thêm route lấy danh sách nhóm của người dùng
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

export const groupRoute = Router
