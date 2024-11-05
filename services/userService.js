import User from '../models/User.js'
import Article from '../models/Article.js'
import mongoose from 'mongoose'
import AddFriends from '../models/AddFriends.js'
import bcrypt from 'bcryptjs'
import Hobby from '../models/Hobby.js'
import MyPhoto from '../models/MyPhoto.js'
// Hàm để lấy thông tin người dùng theo ID
const getUserByIdService = async (userId) => {

  const user = await User.findById(userId).select('-_destroy -__v') // Chọn không trả về các trường không cần thiết
  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }
  const allUsers = await User.find();
  const followUser = allUsers.filter((_user) => _user.follow.includes(userId));

  const dataFollower = followUser.map((follower)=> {
    return {
      _id: follower._id,
      avt: follower.avt,
      name: follower.displayName
    }
  })
  return {
    ...user._doc,
    follower: dataFollower
  }
}

// Hàm lấy bài viết trong bộ sưu tập của người dùng
const getArticlesByCollectionIdService = async (userId, collectionId) => {
  // Tìm người dùng theo userId
  const user = await User.findById(userId)

  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }

  // Tìm bộ sưu tập theo collectionId
  const collection = user.collections.find(
    (col) => col._id.toString() === collectionId
  )

  if (!collection) {
    throw new Error('Bộ sưu tập không tồn tại')
  }


  // Convert string IDs to ObjectId using 'new'
  const articleIds = collection.items.map(
    (id) => new mongoose.Types.ObjectId(id)
  )

  // Lấy danh sách bài viết theo items trong bộ sưu tập
  const articles = await Article.find({ _id: { $in: articleIds } })

  return articles
}

const followUser = async (userId, followerId) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  if (!mongoose.Types.ObjectId.isValid(followerId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }

  const user = await User.findById(userId).select('-_destroy -__v');
  const follower = await User.findById(followerId).select('-_destroy -__v');
  
  if (user === null){
    throw new Error('Người dùng không tồn tại')
  }
  if (follower === null){
    throw new Error('Người theo dõi không tồn tại')
  }

  if (!user.follow.includes(followerId)) {
    // Thêm follower vào mảng follow
    user.follow.push(followerId)
    // Lưu user sau khi cập nhật
    await user.save()

    return getUserByIdService(userId);
  } else {
  }
}

const unFollowUser = async (userId, followerId) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  if (!mongoose.Types.ObjectId.isValid(followerId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }

  const user = await User.findById(userId).select('-_destroy -__v');
  
  if (user === null){
    throw new Error('Người dùng không tồn tại')
  }
  
  if (user.follow.includes(followerId)) {
    user.follow = user.follow.filter(id => id.toString() !== followerId.toString());
    await user.save();

    return getUserByIdService(userId);
  } else {
  }
}

const RelationShip = async (userId, friendId) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }

  const user = await User.findById(userId).select('-_destroy -__v');
  
  if (user === null){
    throw new Error('Người dùng không tồn tại')
  }

  const isFollow = user.follow.filter(id => id.toString() === friendId.toString());
  const isFriend = user.friends.filter(friend => friend.idUser.toString() === friendId.toString());
  
  let result = {
    isFollow: false,
    isFriend: 'no',
    _id: null
  }
  if (isFollow.length > 0){
    result.isFollow = true;
  }
  if (isFriend.length > 0){
    result.isFriend = 'yes';
  } else {
    const addFriends = await AddFriends.find();
    const filterAddFriend = addFriends.filter(addfriend => 
      addfriend.senderId.toString() === userId.toString() 
      && addfriend.receiverId.toString() === friendId.toString()
      && addfriend.status==='pending');

    if (filterAddFriend.length > 0){
      result.isFriend = 'request';
      result._id = filterAddFriend[0]._id;
    }
  }
  return result;
}

const getUserDataFriends = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  const user = await User.findById(userId).select('friends');

  const result = await Promise.all(user.friends.map(async (friend) => {
        const friendData = await User.findById(friend.idUser);
        
        return {
            _id: friendData._id,
            avt: friendData.avt,
            name: friendData.displayName ? friendData.displayName : friendData.userName
        };
    }));

  return result;
}

const getUserDataFollower = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  const user = await User.findById(userId).select('follow');

  const result = await Promise.all(user.follow.map(async (_idUser) => {
        const friendData = await User.findById(_idUser);
        
        return {
            _id: friendData._id,
            avt: friendData.avt,
            name: friendData.displayName ? friendData.displayName : friendData.userName
        };
    }));
    
  return result;
}

const getUserHobbies = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
  }
  const user = await User.findById(userId).select('hobbies');

  const result = await Promise.all(user.hobbies.map(async (_id)=> {
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error('ID sở thích không hợp lệ. ID phải có 24 ký tự hợp lệ.')
    }
    const hobby = await Hobby.findById(_id);
    return hobby;
  }));
    
  return result;
}

const updateUser = async (userId, newData, avtUrl, backGroundUrl) => {
  try {
    // Kiểm tra nếu `userId` không phải là ObjectId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }
    const user = await User.findById(userId);

    if (avtUrl !== ''){
      try {
        // Tạo một đối tượng MyPhoto mới
        const myPhoto = new MyPhoto({
          name: "Avatar", // Tên của ảnh hoặc video
          idAuthor: userId, // ID của người dùng tác giả
          type:'img', // 'img' hoặc 'video'
          link: avtUrl, // Đường dẫn tới ảnh hoặc video
          createdAt: new Date(), // Thời gian tạo
          updatedAt: new Date() // Thời gian cập nhật
        });
    
        const savedPhoto = await myPhoto.save();
        newData = {
          ...newData,
          avt: [...user.avt, savedPhoto._id]
        }
        console.log('MyPhoto created successfully:', savedPhoto);

      } catch (error) {
        console.error('Error creating MyPhoto:', error);
        throw error;
      }
    }

    if (backGroundUrl !== ''){
      try {
        // Tạo một đối tượng MyPhoto mới
        const myPhoto = new MyPhoto({
          name: "Background", // Tên của ảnh hoặc video
          idAuthor: userId, // ID của người dùng tác giả
          type:'img', // 'img' hoặc 'video'
          link: backGroundUrl, // Đường dẫn tới ảnh hoặc video
          createdAt: new Date(), // Thời gian tạo
          updatedAt: new Date() // Thời gian cập nhật
        });
    
        const savedPhoto = await myPhoto.save();
        newData = {
          ...newData,
          backGround: [...user.backGround, savedPhoto._id]
        }
        console.log('MyPhoto created successfully:', savedPhoto);

      } catch (error) {
        console.error('Error creating MyPhoto:', error);
        throw error;
      }
    }

    // Nếu có thay đổi trong `account.password`, băm mật khẩu mới
    if (newData.account && newData.account.password) {
      const salt = await bcrypt.genSalt(10);
      newData.account.password = await bcrypt.hash(newData.account.password, salt);
    }

    // Thêm ngày cập nhật
    newData.updatedAt = new Date();

    // Tìm và cập nhật người dùng
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: newData },
      { new: true, runValidators: true } // Trả về user đã cập nhật và kiểm tra hợp lệ
    );

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

export const userService = {
  getUserByIdService,
  getArticlesByCollectionIdService,
  followUser, unFollowUser,
  RelationShip,
  getUserDataFriends,
  getUserDataFollower,
  updateUser,
  getUserHobbies,
}
