import Conversation from '../models/Conversation.js'
import User from '../models/User.js';
import mongoose from 'mongoose';
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
        return {
            userID: user._id,
            avt: user.avt,
            name: user.displayName ? user.displayName : user.userName
        };
    });
  
    const users = await Promise.all(userPromises);

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
    
    const result = usersWithoutChat.map((userItem) => ({
      _id: userItem._id,
      avt: userItem.avt,
      displayName: userItem.displayName,
      userName: userItem.userName,
    }));
    
    return result;

  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

export const messageService = {
    getAllMessagesByID,
    getMessageWithFriend,
    readMessage,
    sendMessage,
    createConversation,
    getAllFriendWithoutChat
}