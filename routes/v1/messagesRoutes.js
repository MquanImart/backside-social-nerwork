import express from 'express'
import {messageController} from '../../controllers/messagesController.js'
const Router = express.Router()

Router.get('/:UserId', messageController.getAllMessagesByUserID)
Router.get('/:UserId/:FriendID', messageController.getMessageWithFriend);
Router.put('/read-message/:ConversationID/:UserId', messageController.readMessage);
Router.put('/send-message/:ConversationID', messageController.sendMessage);
Router.post('/create-conversation', messageController.createNewMessages);
Router.get('/friends/newchat/:userID', messageController.getAllFriendsWithoutChat);

export const messagesRoute = Router
