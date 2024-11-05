import express from 'express'
import { userController } from '../../controllers/userController.js'
import upload from '../../middlewares/multerConfig.js'

const Router = express.Router()

// Route lấy thông tin user bằng id
Router.get('/:userId', userController.getUserById)
// Route lấy bài viết trong bộ sưu tập
Router.get('/:userId/collections/:collectionId/articles', userController.getArticlesByCollectionId);
Router.put('/:userId/follow', userController.followUser)
Router.put('/:userId/unfollow', userController.unFollowUser)
Router.get('/:userId/relationship', userController.RelationShip)
Router.get(
  '/:userId/collections/:collectionId/articles',
  userController.getArticlesByCollectionId
)
Router.patch('/:userId', 
  upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'background', maxCount: 1 },
]), userController.updateUser);

Router.get('/:userId/friends-data', userController.getUserDataFriends)
Router.get('/:userId/follower-data', userController.getUserDataFollower)
Router.get('/hobbies/:userId', userController.getUserHobbies)



export const userRoute = Router
