import mongoose from 'mongoose'
import User from '../models/User.js';
import AddFriends from '../models/AddFriends.js';
import MyPhoto from '../models/MyPhoto.js';

const getAllFriendByIdUser = async (userId) => {
    try {
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
          }
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userObjectId);
        
        const resultData = await Promise.all(user.friends.map(async (friend) => {
            const friendData = await User.findById(friend.idUser);
            const avt = await MyPhoto.findById(friendData.avt[user.avt.length - 1]);
            return {         
                idUser: friend.idUser,       
                addDate: friend.addDate,
                avt: avt,
                name: friendData.displayName,
                aboutMe: friendData.aboutMe
            };
        })); 

        return resultData;
    } catch (error) {
        throw new Error('Có lỗi xảy ra xong khi lấy danh sách bạn bè:', error);
    }
}

const getSuggestAddFriend= async (userId, page) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
          }
        
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userObjectId);
        let allFriendsIds = user.friends.map(friend => friend.idUser); 
        allFriendsIds = allFriendsIds.concat(user._id.toString());

        const sentFriendRequests = await AddFriends.find({
          receiverId: userId,  // Điều kiện người nhận
          status: 'pending'    // Điều kiện trạng thái là 'pending'
        }).select('senderId');
        

        const receivedFriendRequests = await AddFriends.find({
          senderId: userId,
          status: 'pending' 
        }).select('receiverId');

        const senders = sentFriendRequests.map(friend => friend.senderId.toString());
        const receivers = receivedFriendRequests.map(friend => friend.receiverId.toString());

        const allRelatedIds = [...senders, ...receivers, ...allFriendsIds];

        const usersNotInFriends = await User.find({
          _id: { $nin: allRelatedIds }
        })
        .skip((page - 1) * 10)
        .limit(10);

        const resultData = await Promise.all(usersNotInFriends.map(async (user) => {
          const avt = await MyPhoto.findById(usersNotInFriends.avt[user.avt.length - 1]);
            return {        
                idUser: user._id,       
                avt: avt,
                name: user.displayName,
                aboutMe: user.aboutMe
            };
        })); 

        return resultData;
    } catch (error) {
        throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
    }
}

const addFriend = async (senderId, receiverId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(senderId)) {
            throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
          }
        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
        }
        const senderObjectsId = new mongoose.Types.ObjectId(senderId);
        const receiverObjectsId = new mongoose.Types.ObjectId(receiverId);
        const newAddFriend = new AddFriends({
            senderId: senderObjectsId,
            receiverId: receiverObjectsId,
            status: 'pending',
            createdAt: new Date(),
            acceptedAt: null
          });

        await newAddFriend.save();

        return true;
    } catch (error) {
        throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
    }
}

const getAllFriendRequest = async (userId, page) => {
  try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
        }

      const userObjectsId = new mongoose.Types.ObjectId(userId);

      const friendRequest = await AddFriends.find({
        receiverId: userObjectsId,
        status: 'pending'
      })
      .skip((page - 1) * 10)
      .limit(10);
      const result = await Promise.all(friendRequest.map(async (friendreq) => {
        const friend = await User.findById(friendreq.senderId);
        const avt = await MyPhoto.findById(friend.avt[user.avt.length - 1]);
        return {
            _id: friendreq._id,        
            idUser: friendreq.senderId,       
            avt: avt,
            addDate: friendreq.createdAt,
            name: friend.displayName,
            aboutMe: friend.aboutMe
        };
      })); 

      return result;
  } catch (error) {
      throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
  }
}

const updateSatusFriendRequest = async (requestId, status) => {
  try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
          throw new Error('ID lời mời không hợp lệ. ID phải có 24 ký tự hợp lệ.')
        }

      const requestObjectId = new mongoose.Types.ObjectId(requestId);
      
      const result = await AddFriends.findByIdAndUpdate(
        requestObjectId,
        { status: status,
          acceptedAt: new Date()
         },
        { new: true }
      );

      if (!result) {
        throw new Error('Không tìm thấy lời mời với ID được cung cấp.');
      }

      if (status === 'accepted') {
        const sender = await User.findById(result.senderId);
        const receive = await User.findById(result.receiverId);

        if (!sender) {
          throw new Error('Không tìm thấy người dùng với senderId.');
        }
        if (!receive) {
          throw new Error('Không tìm thấy người dùng với receiverId.');
        }

        if (!sender.friends.includes(result.receiverId)) {
          const updatedSender = await User.findByIdAndUpdate(
            result.senderId,
            { $push: { friends: {
              idUser: result.receiverId,
              addDate: new Date()
            } } },
            { new: true }
          );
        } else {
          throw new Error('Người dùng này đã là bạn bè.');
        }

        if (!receive.friends.includes(result.senderId)) {
          const updatedReceive = await User.findByIdAndUpdate(
            result.receiverId,
            { $push: { friends: {
              idUser: result.senderId,
              addDate: new Date()
            } } },
            { new: true }
          );
        } else {
          throw new Error('Người dùng này đã là bạn bè.');
        }
      }
      return true;
  } catch (error) {
      throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
  }
}

const getMyRequest = async (userId, page) => {
  try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
        }
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      const myRequest = await AddFriends.find({
        senderId: userObjectId,
        status: 'pending'
      })
      .skip((page - 1) * 10)
      .limit(10);

      const resultData = await Promise.all(myRequest.map(async (request) => {
        const user = await User.findById(request.receiverId);
        const avt = await MyPhoto.findById(user.avt[user.avt.length - 1]);
          return {   
              _id: request._id,     
              idUser: user._id,       
              avt: avt,
              name: user.displayName,
              aboutMe: user.aboutMe
          };
      })); 

      return resultData;
  } catch (error) {
      throw new Error('', error);
  }
}

const revokeInvitation = async (requestId) => {
  try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
          throw new Error('ID lời mời không hợp lệ. ID phải có 24 ký tự hợp lệ.')
        }

      const requestObjectId = new mongoose.Types.ObjectId(requestId);
      
      const result = await AddFriends.findByIdAndUpdate(
        requestObjectId,
        { status: 'rejected',
          acceptedAt: new Date()
         },
        { new: true }
      );

      if (!result) {
        throw new Error('Không tìm thấy lời mời với ID được cung cấp.');
      }

      return true;
  } catch (error) {
      throw new Error('Có lỗi xảy ra', error);
  }
}

const unFriend = async (userId, friendId) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }

  const user = await User.findById(userId).select('-_destroy -__v');
  const myFriend = await User.findById(friendId).select('-_destroy -__v');

  if (user === null){
    throw new Error('Người dùng không tồn tại')
  }

  if (myFriend === null){
    throw new Error('Người dùng không tồn tại')
  }

  user.friends = user.friends.filter(friend => !friend.idUser.equals(friendId));
  await user.save();
  myFriend.friends = myFriend.friends.filter(friend => !friend.idUser.equals(userId));
  await myFriend.save()
  
  return true;
}

export const friendService = {
    getAllFriendByIdUser,
    getSuggestAddFriend,
    addFriend,
    getAllFriendRequest,
    updateSatusFriendRequest,
    getMyRequest,
    revokeInvitation,
    unFriend
}