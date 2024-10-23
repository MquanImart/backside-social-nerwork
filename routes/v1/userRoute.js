import express from 'express'
import { userController } from '../../controllers/userController.js'

const Router = express.Router()

// Route lấy thông tin user bằng id
Router.get('/:userId', userController.getUserById)
// Route lấy bài viết trong bộ sưu tập
Router.get(
  '/:userId/collections/:collectionId/articles',
  userController.getArticlesByCollectionId
)

Router.get('/admin/management-users', userController.getAllUsersController)

//API khoá và mở khoá tài khoản của admin
Router.put('/:userId/:action', userController.lockUnlockUser)
export const userRoute = Router
