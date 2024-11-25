import { messageService } from '../services/messageService.js'

const getAllMessagesByUserID = async (req, res) => {
    const userID = req.params.UserId
    if (!userID) {
      return res.status(400).json({ error: 'Missing user ID' })
    }

    try {
      const messages = await messageService.getAllMessagesByID(userID)
      res.status(200).json(messages)
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve messages' })
    }
  }

  const getMessageWithFriend = async (req, res) => {
    const userID = req.params.UserId;
    const friendID = req.params.FriendID;
    if (!userID) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing user ID' 
      })
    }
    if (!friendID) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing friend ID' 
      })
    }
    try {
      const messages = await messageService.getMessageWithFriend(userID, friendID)
      res.status(200).json({
        success: true,
        data: messages,
      })
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to retrieve messages' 
      })
    }
  }

  const readMessage = async (req, res) => {
    const conversationID = req.params.ConversationID;
    const userID = req.params.UserId;
    if (!userID) {
      return res.status(400).json({ error: 'Missing User ID' })
    }
    if (!conversationID) {
      return res.status(400).json({ error: 'Missing Conversation ID' })
    }
    try {
      const result = await messageService.readMessage(conversationID, userID)
      if (result === true){
        res.status(200).json("Thành công")
      }
      else{
        res.status(201).json("Không có tin nhắn")
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve messages' })
    }
  }

  const sendMessage = async (req, res) => {
    const conversationID = req.params.ConversationID;
    const content = req.body;
    
    try {
      const result = await messageService.sendMessage(conversationID, content);
      res.status(200).json(result);
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  };

  const createNewMessages = async (req, res) => {
    const { userID, friendID, message} = req.body;
    
    try {
      const result = await messageService.createConversation(userID, friendID, message);
      if (result === false){
        res.status(500).json({message: "Bạn chưa kết bạn với người dùng ID"})
      }
      else{
        res.status(200).json(result);
      }
    } catch (error) {
      console.error('Lỗi khi tạo hộp thoại mới:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };
  
  const getAllFriendsWithoutChat = async (req, res) => {
    const userID = req.params.userID;
    try {
      const result = await messageService.getAllFriendWithoutChat(userID);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi tạo hộp thoại mới:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  const getUnreadMessage = async (req, res) => {
    const userID = req.params.userID;
    try {
      const {success, data, message} = await messageService.getUnreadMessageService(userID);
      res.status(200).json({success, data, message});

    } catch (error) {
      console.error('Lỗi khi tạo hộp thoại mới:', error);
      res.status(500).json({success, message});
    }
  };
export const messageController = {
    getAllMessagesByUserID,
    getMessageWithFriend,
    readMessage,
    sendMessage,
    createNewMessages,
    getAllFriendsWithoutChat,
    getUnreadMessage
}
