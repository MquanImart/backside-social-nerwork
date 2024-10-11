import Conversation from '../models/Conversation.js'
import User from '../models/User.js';

const getAllMessagesByID = async (userID) => {
  try {
    const conversations = await Conversation.find();

    const messages = conversations.filter((conversation) => 
        conversation._user.some((id) => id.toString() === userID)
    );
    if (messages.length === 0) {
      return [];
    }

    const resultData = await Promise.all(messages.map(async (message) => {
        const userPromises = message._user.map(async (id) => {
            if (id.toString() !== userID) {
                const user = await User.findById(id);
                return {
                    userID: user._id,
                    avt: user.avt,
                    name: user.displayName ? user.displayName : user.userName
                };
            }
            return null;
        });
    
        const users = await Promise.all(userPromises);
    
        return {
            _id: message._id,           // Trả về ID của message
            _user: message._user,        // Trả về mảng _user của message
            content: message.content.length > 0? message.content[message.content.length - 1] : null,    // Trả về nội dung message cuối cùng
            dataUser: users.filter(user => user !== null)  // Thêm trường dataUser chứa danh sách người dùng đã lọc
        };
    })); 

    return resultData;
  } catch (error) {
    console.error('Error retrieving messages:', error);
    throw new Error('Could not retrieve messages');
  }
};

const getMessageWithFriend = async (userID, friendID) => {
  try {
    const conversations = await Conversation.find();

    const messages = conversations.filter((conversation) => 
        conversation._user.includes(userID) && conversation._user.includes(friendID)
    );
    if (messages.length === 0) {
      return [];
    }

    const resultData = await Promise.all(messages.map(async (message) => {
        const userPromises = message._user.map(async (id) => {
            const user = await User.findById(id);
            return {
                userID: user._id,
                avt: user.avt,
                name: user.displayName ? user.displayName : user.userName
            };
        });
    
        const users = await Promise.all(userPromises);
    
        return {
            _id: message._id,
            _user: message._user,
            content: message.content,
            dataUser: users.filter(user => user !== null)
        };
    })); 

    return resultData[0];
  } catch (error) {
    console.error('Error retrieving messages:', error);
    throw new Error('Could not retrieve messages');
  }
};

const readMessage = async (conversationID, userID) => {
  try{
    const conversation = await Conversation.findOne({_id: conversationID});
    
    if (conversation.content.length > 0){
      const lastMessage = conversation.content[conversation.content.length - 1];
      if (lastMessage.userId.toString() !== userID.toString()) { 
        lastMessage.viewDate = new Date();

        await conversation.save();
        return true;
      }
    }
    else {
      return false;
    }
  }catch (error) {
    console.error('Error retrieving messages:', error);
    throw new Error('Could not retrieve messages');
  }
}

const sendMessage = async (conversationID, content) => {
  try{
    const conversation = await Conversation.findOne({_id: conversationID});

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.content.push(content);
    await conversation.save();
    return conversation;
  }catch (error) {
    console.error('Error retrieving messages:', error);
    throw new Error('Could not retrieve messages');
  }
}

export const messageService = {
    getAllMessagesByID,
    getMessageWithFriend,
    readMessage,
    sendMessage
}