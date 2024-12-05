// import User from '../models/User.js';

// const findMutualFriends = async (currentUserId) => {
//   const currentUser = await User.findById(currentUserId).populate('friends.idUser');
//   const currentFriends = currentUser.friends.map(friend => friend.idUser._id);

//   // Tìm người dùng khác không phải bạn bè hiện tại
//   const otherUsers = await User.find({ _id: { $nin: currentFriends, $ne: currentUserId } }).populate('friends.idUser');

//   const suggestions = otherUsers.map(user => {
//     const mutualFriends = user.friends.filter(friend => currentFriends.includes(friend.idUser._id));
//     return {
//       userId: user._id,
//       mutualFriendsCount: mutualFriends.length,
//     };
//   });

//   return suggestions.sort((a, b) => b.mutualFriendsCount - a.mutualFriendsCount);
// };

// const findMutualGroups = async (currentUserId) => {
//   const currentUser = await User.findById(currentUserId);
//   const currentGroups = currentUser.groups;

//   const otherUsers = await User.find({ _id: { $ne: currentUserId } });

//   const suggestions = otherUsers.map(user => {
//     const mutualGroupsCount = user.groups.filter(group => currentGroups.includes(group)).length;
//     return {
//       userId: user._id,
//       mutualGroupsCount,
//     };
//   });

//   return suggestions.sort((a, b) => b.mutualGroupsCount - a.mutualGroupsCount);
// };
// const findMutualHobbies = async (currentUserId) => {
//   const currentUser = await User.findById(currentUserId).populate('hobbies');
//   const currentHobbies = currentUser.hobbies.map(hobby => hobby._id);

//   const otherUsers = await User.find({ _id: { $ne: currentUserId } }).populate('hobbies');

//   const suggestions = otherUsers.map(user => {
//     const mutualHobbiesCount = user.hobbies.filter(hobby => currentHobbies.includes(hobby._id)).length;
//     return {
//       userId: user._id,
//       mutualHobbiesCount,
//     };
//   });

//   return suggestions.sort((a, b) => b.mutualHobbiesCount - a.mutualHobbiesCount);
// };

// const suggestFriends = async (currentUserId) => {
//   const mutualFriends = await findMutualFriends(currentUserId);
//   const mutualGroups = await findMutualGroups(currentUserId);
//   const mutualHobbies = await findMutualHobbies(currentUserId);

//   const suggestions = mutualFriends.map(friend => {
//     const group = mutualGroups.find(g => g.userId.equals(friend.userId)) || { mutualGroupsCount: 0 };
//     const hobby = mutualHobbies.find(h => h.userId.equals(friend.userId)) || { mutualHobbiesCount: 0 };

//     const score = friend.mutualFriendsCount * 2 + group.mutualGroupsCount * 1.5 + hobby.mutualHobbiesCount * 1;

//     return {
//       userId: friend.userId,
//       score,
//     };
//   });

//   return suggestions.sort((a, b) => b.score - a.score);
// };
  