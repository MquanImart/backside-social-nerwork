import Conversation from '../models/Conversation.js'
import MyPhoto from '../models/MyPhoto.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import {emitEvent} from '../sockets/socket.js'

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
                if (user.avt.length > 0){
                  const avt = await MyPhoto.findById(user.avt[user.avt.length - 1])
                  return {
                    userID: user._id,
                    avt: avt,
                    name: user.displayName ? user.displayName : user.userName
                  };
                }
                return {
                    userID: user._id,
                    avt: null,
                    name: user.displayName ? user.displayName : user.userName
                };
            }
            return null;
        });
    
        const users = await Promise.all(userPromises);
    
        return {
            _id: message._id,           
            _user: message._user,       
            content: message.content.length > 0? message.content[message.content.length - 1] : null, 
            dataUser: users.filter(user => user !== null)  
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
            if (user.avt.length > 0){
              const avt = await MyPhoto.findById(user.avt[user.avt.length - 1])
              return {
                userID: user._id,
                avt: avt,
                name: user.displayName ? user.displayName : user.userName
              };
            }
            return {
                userID: user._id,
                avt: null,
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

      if (lastMessage.userId.toString() !== userID.toString() && lastMessage.viewDate === null) { 
        lastMessage.viewDate = new Date();
        await conversation.save();

        emitEvent(`read-massages-${userID.toString()}`, {    
          newContent: lastMessage, 
        });

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
    }content
    // Tìm _user đầu tiên không có trong danh sách messageUserIds 
    const friend = await conversation._user.find(userId => content.userId !== userId.toString());

    conversation.content.push(content);
    await conversation.save();

    emitEvent(`chat-list-${conversation._id}`, {
      _id: conversation._id,           
      content: conversation.content.length > 0? conversation.content[conversation.content.length - 1] : null, 
    });

    emitEvent(`conversation-${conversation._id}`, {
      _id: conversation._id,           
      newContent: conversation.content.length > 0? conversation.content[conversation.content.length - 1] : null, 
    });

    emitEvent(`unread-massages-${friend.toString()}`, {    
      newContent: conversation.content.length > 0? conversation.content[conversation.content.length - 1] : null, 
    });

    return conversation;
  }catch (error) {
    console.error('Error retrieving messages:', error);
    throw new Error('Could not retrieve messages');
  }
}

const createConversation = async (userID, friendID, message) => {
  try {
    const user = await User.findOne({_id: userID});
    if (!user) {
      throw new Error('User not found');
    }
    const hasAllFriends = user.friends.some(friend => friend.idUser.toString() === friendID.toString())

    if (!hasAllFriends) {
      return false;
    }
    const newConversation = new Conversation({
      _user: [userID, friendID],
      content: [message]
    });
    await newConversation.save();

    const userPromises = newConversation._user.map(async (id) => {
        const user = await User.findById(id);
        if (user.avt.length > 0){
          const avt = await MyPhoto.findById(user.avt[user.avt.length - 1])
          return {
            userID: user._id,
            avt: avt,
            name: user.displayName ? user.displayName : user.userName
          };
        }
        return {
            userID: user._id,
            avt: null,
            name: user.displayName ? user.displayName : user.userName
        };
    });
  
    const users = await Promise.all(userPromises);

    emitEvent(`new-messages-${friendID}`, {
      _id: newConversation._id,
      _user: newConversation._user,
      content: newConversation.content[newConversation.content.length - 1],
      dataUser: users.filter(user => user !== null)
    });

    return {
        _id: newConversation._id,
        _user: newConversation._user,
        content: newConversation.content,
        dataUser: users.filter(user => user !== null)
    }; 

  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

const getAllFriendWithoutChat = async (userID) => {

  try{
    const user = await User.findOne({_id: userID});
    const friendIds = user.friends.map(friend => friend.idUser.toString());

    const conversations = await Conversation.find();
    const filteredConversations = conversations.filter(conversation => 
      conversation._user.includes(userID)
    ); 

    const userInConversations = new Set();
    filteredConversations.forEach(conversation => {
      conversation._user.forEach(id => {
        userInConversations.add(id.toString());
      });
    });
    
    const friendsWithoutChat = friendIds.filter(friendId => !userInConversations.has(friendId));
    const usersWithoutChat = await User.find({
      _id: { $in: friendsWithoutChat }
    });
    const result = await Promise.all(usersWithoutChat.map(async (userItem) => {
          const avt = await MyPhoto.findById(userItem.avt[user.avt.length - 1]);
          return {
          _id: userItem._id,
          avt: avt,
          displayName: userItem.displayName,
          userName: userItem.userName,
        }
      }));

    return result;

  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}
const getUnreadMessageService = async (userID) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userID)) {
      return {
        success: false,
        message: 'ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ'
      }
    }

    const conversations = await Conversation.find({
      _user: userID, // Lọc conversations chứa userID trong _user
      "content.viewDate": null // Tìm những conversations có ít nhất một message chưa xem
    });
    const userObjectId = new mongoose.Types.ObjectId(userID);
    // Lọc thêm để lấy những conversations có phần tử cuối cùng trong content có viewDate là null
    const unreadConversations = conversations.filter(conversation => {
      const lastMessage = conversation.content[conversation.content.length - 1];
      if (lastMessage.viewDate === null && !lastMessage.userId.equals(userObjectId)){
        return lastMessage;
      }
    });
    // Trả về số lượng các conversations chưa đọc
    return {
      success: true,
      data: unreadConversations.map((conversation) => (conversation.content[conversation.content.length - 1])),
      message: 'Thành công lấy số lượng tin nhắn chưa đọc'
    }
  } catch (error) {
    console.error('Error retrieving unread messages:', error);
    return {
      success: false,
      message: 'Lỗi trong khi lấy số lượng tin nhắn chưa đọc',
    }
  }
};

export const messageService = {
    getAllMessagesByID,
    getMessageWithFriend,
    readMessage,
    sendMessage,
    createConversation,
    getAllFriendWithoutChat,
    getUnreadMessageService
}