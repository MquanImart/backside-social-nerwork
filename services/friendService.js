import mongoose from 'mongoose'
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AddFriends from '../models/AddFriends.js';
import MyPhoto from '../models/MyPhoto.js';
import Group from '../models/Group.js';
import { emitEvent } from '../sockets/socket.js'

const getAllFriendByIdUser = async (userId, page, limit) => {
    try {
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
          }
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userObjectId);
        
        const resultData = await Promise.all(user.friends.slice((page-1)*limit, page*limit).map(async (friend) => {
            const friendData = await User.findById(friend.idUser);
            const avt = await MyPhoto.findById(friendData.avt[friendData.avt.length - 1]);
            return {         
                idUser: friend.idUser,       
                addDate: friend.addDate,
                avt: avt,
                name: friendData.displayName,
                aboutMe: friendData.aboutMe
            };
        })); 

        return {
          count: user.friends.length,
          dataFriend: resultData
        };
    } catch (error) {
        throw new Error('Có lỗi xảy ra xong khi lấy danh sách bạn bè:', error);
    }
}


const getSuggestAddFriend= async (userId, page, limit, filter) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
          }
        
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userObjectId);
        let allFriendsIds = user.friends.map(friend => friend.idUser); 

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

        const allRelatedIds = [...senders, ...receivers, ...allFriendsIds, user._id];

        const usersNotInFriends = await User.find({
          _id: { $nin: allRelatedIds }
        })

        const resultData = await Promise.all(usersNotInFriends.map(async (user) => {
          const avt = await MyPhoto.findById(user.avt[user.avt.length - 1]);
          
            return {        
                idUser: user._id,       
                avt: avt,
                name: user.displayName,
                aboutMe: user.aboutMe
            };
        })); 

        const filteredUsers = resultData.filter(user => {
          const normalizedName = user.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normalizedFitler = filter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return normalizedName.includes(normalizedFitler);
        });

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        // Lấy các phần tử trong khoảng chỉ mục
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        return {
          count: filteredUsers.length,
          dataFriend: paginatedUsers
        };
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

        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        const senderName = sender.displayName || 'Người dùng';

        const avtLink = await getUserAvatarLink(sender);
        
        const link = `http://localhost:5173/friends/friends-request`;

        const notificationMessage = `${senderName} đã gửi lời mời kết bạn tới bạn.`;

        const newNotification = new Notification({
          senderId: senderId,
          receiverId: receiverId,
          message: notificationMessage,
          status: 'unread',
          createdAt: new Date(),
          link: link,
        });

        await newNotification.save();
        console.log('avtLink.link', avtLink.link)
        // Phát sự kiện thông báo nếu có
        emitEvent('friend_request_notification', {
          senderId: senderId,
          receiverId: {
            _id: receiverId,
            avt: [
              {
                _id: avtLink ? avtLink._id : '',
                link: avtLink ? avtLink.link : ''
              }
            ],
            displayName: receiver.displayName,
          },
          message: notificationMessage,
          status: 'unread',
          createdAt: new Date(),
          link: link,
        });
        return true;
    } catch (error) {
        throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
    }
}

const getAllFriendRequest = async (userId, page, limit) => {
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
      .limit(limit);
      
      const result = await Promise.all(friendRequest.map(async (friendreq) => {
        const friend = await User.findById(friendreq.senderId);
        const avt = await MyPhoto.findById(friend.avt[friend.avt.length - 1]);
        return {
            _id: friendreq._id,        
            idUser: friendreq.senderId,       
            avt: avt,
            addDate: friendreq.createdAt,
            name: friend.displayName,
            aboutMe: friend.aboutMe
        };
      })); 

      return {
        count: result.length,
        dataFriend: result
      };
  } catch (error) {
      throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
  }
}

const updateSatusFriendRequest = async (requestId, status) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new Error('ID lời mời không hợp lệ. ID phải có 24 ký tự hợp lệ.');
    }

    const requestObjectId = new mongoose.Types.ObjectId(requestId);

    const result = await AddFriends.findByIdAndUpdate(
      requestObjectId,
      {
        status: status,
        acceptedAt: new Date(),
      },
      { new: true }
    );

    if (!result) {
      throw new Error('Không tìm thấy lời mời với ID được cung cấp.');
    }

    if (status === 'accepted') {
      const sender = await User.findById(result.senderId);
      const receiver = await User.findById(result.receiverId);

      if (!sender) {
        throw new Error('Không tìm thấy người dùng với senderId.');
      }
      if (!receiver) {
        throw new Error('Không tìm thấy người dùng với receiverId.');
      }

      // Thêm bạn cho sender nếu chưa có
      if (!sender.friends.includes(result.receiverId)) {
        const updatedSender = await User.findByIdAndUpdate(
          result.senderId,
          {
            $push: {
              friends: {
                idUser: result.receiverId,
                addDate: new Date(),
              },
            },
          },
          { new: true }
        );
      } else {
        throw new Error('Người dùng này đã là bạn bè.');
      }

      // Thêm bạn cho receiver nếu chưa có
      if (!receiver.friends.includes(result.senderId)) {
        const updatedReceiver = await User.findByIdAndUpdate(
          result.receiverId,
          {
            $push: {
              friends: {
                idUser: result.senderId,
                addDate: new Date(),
              },
            },
          },
          { new: true }
        );
      } else {
        throw new Error('Người dùng này đã là bạn bè.');
      }

      // Gửi thông báo cho người nhận
      const displayName = sender.displayName || 'Người dùng';
      const postLink = `http://localhost:5173/profile?id=${receiver._id}`;
      const avtLink = await getUserAvatarLink(receiver);
      // Gửi sự kiện thông báo (emit)
      emitEvent('friend_request_accepted', {
        senderId: {
          _id: receiver._id,
          avt: [
            {
              _id: avtLink ? avtLink._id : '',
              link: avtLink ? avtLink.link : ''
            }
          ],
          displayName: receiver.displayName,
        },
        receiverId: sender._id,
        message: `${displayName} đã chấp nhận lời mời kết bạn của bạn.`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink,
      });

      // Lưu thông báo vào database
      const newNotification = new Notification({
        senderId: sender._id,
        receiverId: receiver._id,
        message: `${displayName} đã chấp nhận lời mời kết bạn của bạn.`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink,
      });

      await newNotification.save();
    }

    return true;
  } catch (error) {
    console.error('Lỗi trong quá trình xử lý lời mời kết bạn:', error);
    throw new Error('Có lỗi xảy ra xong khi xử lý lời mời kết bạn:', error);
  }
};


const getMyRequest = async (userId, page, limit) => {
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
      .limit(limit);

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

      return {
        count: resultData.length,
        dataFriend: resultData
      };
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
const getUserAvatarLink = async (user) => {
  if (user.avt && user.avt.length > 0) {
    const avtId = user.avt[user.avt.length - 1];
    const avatar = await MyPhoto.findById(avtId);
    if (avatar && avatar.link) {
      return { _id: avatar._id, link: avatar.link }; 
    }
  }
  return { _id: '', link: '' }; 
};

const getFriendSuggestions = async (userId, page, limit) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
      }
    
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userObjectId);
    let allFriendsIds = user.friends.map(friend => friend.idUser); 

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

    const allRelatedIds = [...senders, ...receivers, ...allFriendsIds, user._id];

    const usersNotInFriends = await User.find({
      _id: { $nin: allRelatedIds }
    })
    
    const allUserIdNotFriend = usersNotInFriends.map((item)=> item._id);
    const commonFriendAndGroup = await getCommonFriendsAndGroups(userId, allUserIdNotFriend);
    const userBasedOnCommon = await getUsersBasedOnCommonHobbies(userId, commonFriendAndGroup);

    userBasedOnCommon.sort((a, b) => {
      if (b.totals !== a.totals) {
        return b.totals - a.totals;
      }
      else if (b.commonFriends !== a.commonFriends) {
        return b.commonFriends - a.commonFriends; // Sắp xếp theo số bạn chung giảm dần
      }
      return b.commonGroups - a.commonGroups; // Nếu số bạn chung bằng nhau, sắp xếp theo số nhóm chung giảm dần
    });

    const userIds = userBasedOnCommon.map(user => user.id);
    const paginatedUserIds = userIds.slice((page - 1) * limit, page * limit);

    const dataResult = await User.find({ _id: { $in: paginatedUserIds } })
      .skip((page - 1) * 10)
      .limit(limit);

    dataResult.sort((a, b) => {
      const indexA = paginatedUserIds.indexOf(a._id.toString());
      const indexB = paginatedUserIds.indexOf(b._id.toString());
      return indexA - indexB; // Giữ thứ tự gốc từ mảng paginatedUserIds
    });
      
    const resultData = await Promise.all(dataResult.map(async (user) => {
      const avt = await MyPhoto.findById(user.avt[user.avt.length - 1]);
      
        return {        
            idUser: user._id,       
            avt: avt,
            name: user.displayName,
            aboutMe: user.aboutMe
        };
    })); 

    return {
      count: resultData.length,
      dataFriend: resultData
    };

    return result;

} catch (error) {
    throw new Error('Có lỗi xảy ra xong khi lấy danh sách đề xuất:', error);
}
};

const getCommonFriendsAndGroups = async (userId, allRelatedIds) => {
  try {
    // Lấy thông tin người dùng chính (userId) bao gồm danh sách bạn bè và nhóm
    const mainUser = await User.findById(userId)
      .populate('friends.idUser')
      .exec();

    if (!mainUser) throw new Error('User không tồn tại');

    const mainUserFriends = new Set(mainUser.friends.map((friend) => friend.idUser.toString()));

    const mainUserGroups = new Set(
      (
        await Group.find({ 'members.listUsers.idUser': userId })
          .select('_id')
          .exec()
      ).map((group) => group._id.toString())
    );
    
    // Lấy thông tin bạn bè và nhóm của tất cả các relatedId
    const relatedUsers = await User.find({ _id: { $in: allRelatedIds } })
    .populate('friends.idUser')
    .exec();

    const relatedGroups = await Group.find({
    'members.listUsers.idUser': { $in: allRelatedIds },
    })
    .select('_id members.listUsers.idUser')
    .exec();

    // Tổ chức dữ liệu nhóm của tất cả relatedIds để xử lý nhanh hơn
    const relatedUserGroupsMap = new Map();
    relatedGroups.forEach((group) => {
    group.members.listUsers.forEach((member) => {
      const memberId = member.idUser.toString();
      if (!relatedUserGroupsMap.has(memberId)) {
          relatedUserGroupsMap.set(memberId, new Set());
      }
      relatedUserGroupsMap.get(memberId).add(group._id.toString());
    });
    });

    // Tính toán bạn chung và nhóm chung
    const result = relatedUsers.map((relatedUser) => {
    const relatedId = relatedUser._id.toString();

    // Bạn bè của người dùng liên quan
    const relatedUserFriends = new Set(
      relatedUser.friends.map((friend) => friend.idUser.toString())
    );

    // Nhóm của người dùng liên quan
    const relatedUserGroups = relatedUserGroupsMap.get(relatedId) || new Set();

    // Tính số lượng bạn bè chung
    const commonFriends = Array.from(mainUserFriends).filter((friendId) =>
      relatedUserFriends.has(friendId)
    ).length;

    // Tính số lượng nhóm chung
    const commonGroups = Array.from(mainUserGroups).filter((groupId) =>
      relatedUserGroups.has(groupId)
    ).length;

    return {
      id: relatedId,
      commonFriends,
      commonGroups,
      totals: commonFriends + commonGroups
    };
    });

    return result;
  } catch (error) {
    console.error(error);
    throw new Error('Lỗi khi kiểm tra bạn bè và nhóm chung');
  }
};

const getUsersBasedOnCommonHobbies = async (userId, otherUsersData) => {
  try {
    // Lấy danh sách sở thích của người dùng chính (userId)
    const mainUser = await User.findById(userId).populate('hobbies').exec();
    if (!mainUser) throw new Error('User không tồn tại');

    const mainUserHobbies = mainUser.hobbies.map(hobby => hobby._id.toString());
    // Tính toán số lượng sở thích chung và cập nhật totals cho các người dùng liên quan
    const result = await Promise.all(otherUsersData.map(async (relatedUserData) => {
      const relatedUser = await User.findById(relatedUserData.id).populate('hobbies').exec();
      if (!relatedUser) throw new Error(`User with ID ${relatedUserData.id} không tồn tại`);
      if (relatedUser.hobbies) {
        const relatedUserHobbies = relatedUser.hobbies.map(hobby => hobby._id.toString());

        // Tính số lượng sở thích chung
        const commonHobbies = mainUserHobbies.filter(hobbyId => relatedUserHobbies.includes(hobbyId)).length;
  
        // Tính tỉ lệ phần trăm sở thích chung và cập nhật totals
        const hobbyPercentage = commonHobbies / mainUserHobbies.length;
        const newTotals = relatedUserData.totals + hobbyPercentage*(relatedUserData.totals); // Tăng totals theo tỉ lệ phần trăm
        return {
          ...relatedUserData,
          commonHobbies,
          totals: newTotals,
        };
      } else {return relatedUserData}
    }));

    // Sắp xếp kết quả theo tổng (newTotals) giảm dần
    result.sort((a, b) => b.newTotals - a.newTotals);

    return result;
  } catch (error) {
    console.error(error);
    throw new Error('Lỗi khi gợi ý người dùng');
  }
};

export const friendService = {
    getAllFriendByIdUser,
    getSuggestAddFriend,
    addFriend,
    getAllFriendRequest,
    updateSatusFriendRequest,
    getMyRequest,
    revokeInvitation,
    unFriend,
    getFriendSuggestions
}