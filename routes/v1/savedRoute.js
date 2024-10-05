import express from 'express'
import { savedController } from '../../controllers/savedController.js'

const Router = express.Router()

// Tạo bộ sưu tập mới
Router.post('/', savedController.createCollection)

// Chỉnh sửa bộ sưu tập
Router.put('/:collectionId', savedController.editCollection)

// Xóa bộ sưu tập (cập nhật _destroy thay vì xóa vĩnh viễn)
Router.patch('/:collectionId/delete', savedController.deleteCollection)

// Xóa bài viết khỏi bộ sưu tập
Router.delete('/articles/:articleId', savedController.removeArticleFromCollection);

// Thêm bài viết vào bộ sưu tập
Router.post('/articles/:articleId/:collectionId', savedController.addArticleToCollection);
export const savedRoute = Router
