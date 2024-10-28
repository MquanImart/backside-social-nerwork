import express from 'express'
import { userController } from '../../controllers/userController.js'

const Router = express.Router()

// Route lấy thông tin user bằng id
Router.get('/:userId', userController.getUserById)
// Route lấy bài viết trong bộ sưu tập
Router.get('/:userId/collections/:collectionId/articles', userController.getArticlesByCollectionId);
Router.put('/:userId/follow', userController.followUser)
Router.put('/:userId/unfollow', userController.unFollowUser)
Router.get('/:userId/relationship', userController.RelationShip)
Router.get('/:userId/friends-data', userController.getUserDataFriends)
Router.get('/:userId/follower-data', userController.getUserDataFollower)


export const userRoute = Router
