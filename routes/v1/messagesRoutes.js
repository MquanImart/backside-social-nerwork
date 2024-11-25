import express from 'express'
import {messageController} from '../../controllers/messagesController.js'
import upload from '../../middlewares/multerConfig.js'

const Router = express.Router()

Router.get('/:UserId', messageController.getAllMessagesByUserID)
Router.get('/:UserId/:FriendID', messageController.getMessageWithFriend);
Router.patch('/read-message/:ConversationID/:UserId', messageController.readMessage);
Router.patch('/send-message/:ConversationID', messageController.sendMessage);
Router.patch('/send-message/photo/:ConversationID',
  upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]), messageController.sendMessagePhoto);

Router.post('/create-conversation', messageController.createNewMessages);
Router.get('/friends/newchat/:userID', messageController.getAllFriendsWithoutChat);
Router.get('/friends/unread/:userID', messageController.getUnreadMessage);

export const messagesRoute = Router
