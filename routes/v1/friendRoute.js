import express from 'express'
import { friendController } from '../../controllers/friendController.js';
const Router = express.Router()

Router.get('/:UserId/all-friends', friendController.getAllFriendByIdUser)
Router.get('/:UserId/suggest', friendController.getSuggestAddFriend)
Router.post('/:UserId/add-friend', friendController.addFriend)
Router.get('/:UserId/request', friendController.getAllFriendRequest)
Router.put('/:RequestId/answer', friendController.updateSatusFriendRequest)
Router.get('/:UserId/my-request', friendController.getMyRequest)
Router.put('/:RequestId/recall', friendController.revokeInvitation)
Router.put('/:userId/unfriend', friendController.unFriend)

export const friendRoute = Router
