import express from 'express'
import {messageController} from '../../controllers/messagesController.js'
const Router = express.Router()

Router.get('/:UserId', messageController.getAllMessagesByUserID)
Router.get('/:UserId/:FriendID', messageController.getMessageWithFriend);
Router.put('/read-message/:ConversationID/:UserId', messageController.readMessage);
Router.put('/send-message/:ConversationID', messageController.sendMessage);

export const messagesRoute = Router
