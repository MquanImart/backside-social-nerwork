import Group from '../models/Group.js'
import Article from '../models/Article.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import mongoose from 'mongoose'
import MyPhoto from '../models/MyPhoto.js'
import Admin from '../models/Admin.js'
import { emitEvent } from '../sockets/socket.js'
import Hobby from '../models/Hobby.js'
import { cloudStorageService } from './cloudStorageService.js'
import { getHobbySimilarity } from '../config/cosineSimilarity.js'


const getUserGroupsService = async (userId, page = 1, limit = 6, search = '') => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.');
  }

  const skip = (page - 1) * limit;

  const searchFilter = search ? {
    groupName: { $regex: search, $options: 'i' } // Tìm kiếm tên nhóm không phân biệt chữ hoa chữ thường
  } : {};

  // Tính toán tổng số nhóm
  const totalGroups = await Group.countDocuments({
    'members.listUsers': { $elemMatch: { idUser: userId, state: 'accepted' } },
    _destroy: { $exists: false },
    ...searchFilter,
  });

  // Tính toán tổng số trang
  const totalPages = Math.ceil(totalGroups / limit);

  // Lấy các nhóm của người dùng với phân trang
  const userGroups = await Group.find({
    'members.listUsers': { $elemMatch: { idUser: userId, state: 'accepted' } },
    _destroy: { $exists: false },
    ...searchFilter,  // Áp dụng điều kiện tìm kiếm
  })
    .skip(skip)  // Sử dụng skip cho phân trang
    .limit(limit) // Giới hạn số lượng nhóm trả về
    .populate({
      path: 'avt', // Lấy avatar của nhóm
      model: 'MyPhoto',
      select: 'name link type' // Chỉ lấy các trường cần thiết từ MyPhoto
    })
    .populate({
      path: 'backGround', // Lấy background của nhóm
      model: 'MyPhoto',
      select: 'name link type' // Chỉ lấy các trường cần thiết từ MyPhoto
    })
    .lean();

  return { groups: userGroups, totalPages, totalGroups };
};
// Service lấy tất cả bài viết từ các nhóm mà người dùng đã tham gia và được duyệt
const getAllGroupArticlesService = async (userId, page, limit) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.');
    }

    // Lấy các nhóm người dùng đã tham gia với trạng thái "accepted"
    const userGroups = await Group.find({
      'members.listUsers': {
        $elemMatch: { idUser: userId, state: 'accepted' },
      },
      _destroy: { $exists: false } 
    }).select('article'); // Chỉ lấy trường 'article'

    if (!userGroups || userGroups.length === 0) return [];

    // Lọc các bài viết đã duyệt trong các nhóm (trạng thái 'processed')
    const processedArticleIds = userGroups.reduce((acc, group) => {
      if (group.article && Array.isArray(group.article.listArticle)) {
        const groupArticles = group.article.listArticle
          .filter((article) => article.state === 'processed') // Lọc bài viết đã duyệt
          .map((article) => article.idArticle); // Lấy ID bài viết
        return acc.concat(groupArticles);
      }
      return acc;
    }, []);

    if (processedArticleIds.length === 0) return []; // Nếu không có bài viết nào đã duyệt

    const skip = (page - 1) * limit;

    // Lấy bài viết từ danh sách ID bài viết đã duyệt, đảm bảo không có thời gian _destroy
    const articles = await Article.find({
      _id: { $in: processedArticleIds },
      _destroy: { $exists: false }, // Không lấy bài viết có trường _destroy
    })
      .sort({ createdAt: -1 }) // Sắp xếp bài viết theo thời gian tạo giảm dần
      .skip(skip) // Phân trang
      .limit(limit) // Giới hạn số bài viết mỗi trang
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt',
        populate: { path: 'avt', select: 'name link type' }, // Lấy ảnh đại diện của người tạo bài viết
      })
      .populate({
        path: 'groupID',
        select: 'groupName avt backGround',
        populate: [
          { path: 'avt', select: 'name link type' },
          { path: 'backGround', select: 'name link type' },
        ],
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          { 
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: { path: 'avt', select: 'name link type' }, // Lấy ảnh đại diện của người bình luận
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: { path: 'avt', select: 'name link type' }, // Lấy ảnh đại diện của người trả lời bình luận
            },
          },
        ],
      })
      .populate('listPhoto', 'name link type') // Lấy ảnh từ listPhoto trong bài viết
      .lean(); // Tránh trả về Mongoose Document, chỉ lấy data thuần

    return articles.map((article) => ({
      ...article,
      totalLikes: article.totalLikes || 0, // Đảm bảo trả về tổng số lượt thích
      totalComments: article.totalComments || 0, // Đảm bảo trả về tổng số lượt bình luận
      listPhoto: article.listPhoto || [], // Đảm bảo trả về danh sách ảnh
    }));
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error);
    throw new Error('Lỗi khi lấy bài viết của nhóm.');
  }
};

const getFriendCountInGroup = async (group, userId) => {
  if (!group || !group.members || !group.members.listUsers) return 0;

  try {
    // Lấy danh sách bạn bè của người dùng từ database
    const user = await User.findById(userId);
    if (!user) {
      console.error("Không tìm thấy người dùng.");
      return 0;
    }

    const userFriends = user.friends.map(friend => friend.idUser.toString());

    // Lọc những người bạn chung đã tham gia nhóm ở trạng thái 'accepted'
    const friendCount = group.members.listUsers.filter(member => {
      return userFriends.includes(member.idUser.toString()) &&
             member.state === 'accepted' &&
             member.idUser.toString() !== userId; 
    }).length;

    console.log('name group', group.groupName);
    console.log('friendCount', friendCount);

    return friendCount;
  } catch (error) {
    console.error("Error fetching user or calculating friend count:", error);
    return 0;
  }
};

// Service lấy danh sách các nhóm mà người dùng chưa tham gia
const getNotJoinedGroupsService = async (userId, page = 1, limit = 6, searchTerm = '') => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.');
    }

    // Lấy thông tin người dùng (bao gồm sở thích và bạn bè)
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new Error('Không tìm thấy người dùng.');
    }

    // Lấy sở thích của người dùng
    const userHobbies = user.hobbies && user.hobbies.length > 0
      ? await Hobby.find({ '_id': { $in: user.hobbies } }).lean()
      : [];
    
    // Lấy tên sở thích của người dùng
    const userHobbiesNames = userHobbies.map(hobby => hobby.name);
    console.log("Sở thích của người dùng:", userHobbiesNames);
    const skip = (page - 1) * limit; 

    // Tạo query ban đầu
    const query = {
      $or: [
        { 'members.listUsers.idUser': { $ne: userId } },
        {
          'members.listUsers': {
            $elemMatch: { idUser: userId, state: 'pending' }
          }
        }
      ],
      _destroy: { $exists: false }
    };

    // Thêm điều kiện tìm kiếm nếu có searchTerm
    if (searchTerm) {
      query.groupName = { $regex: searchTerm, $options: 'i' }; // Tìm kiếm không phân biệt hoa thường trong groupName
    }

    // Tìm các nhóm mà người dùng chưa tham gia hoặc đang ở trạng thái "pending"
    const groups = await Group.find(query) // Sử dụng query đã được cập nhật
      .skip(skip) // Bỏ qua `skip` số nhóm
      .limit(limit) // Giới hạn số nhóm mỗi trang
      .populate({
        path: 'avt',
        model: 'MyPhoto',
        select: 'name link type', // Populate avatar của nhóm
      })
      .populate({
        path: 'backGround',
        model: 'MyPhoto',
        select: 'name link type', // Populate background của nhóm
      })
      .populate({
        path: 'hobbies', // Truy vấn sở thích của nhóm
        model: 'Hobby',
        select: 'name' // Chỉ lấy tên sở thích
      })
      .lean();


    // Đếm tổng số nhóm phù hợp với query (bao gồm cả điều kiện tìm kiếm)
    const totalGroups = await Group.countDocuments(query);

    // Tính số trang
    const pages = Math.ceil(totalGroups / limit);

    // Thêm trường userState cho biết trạng thái tham gia của người dùng trong nhóm
    const groupsWithUserState = groups.map((group) => {
      const userState = group.members.listUsers.find(
        (member) => member.idUser.toString() === userId
      )?.state || 'not_joined';

      return { ...group, userState };
    });

    // Tính toán độ tương đồng giữa sở thích người dùng và sở thích nhóm, đồng thời tính số lượng bạn bè đã tham gia nhóm
    const groupsWithSimilarityAndFriends = await Promise.all(
      groupsWithUserState.map(async (group) => {
        const groupHobbies = group.hobbies
          ? group.hobbies.map((hobby) => hobby.name)
          : [];
        const hobbySimilarity = getHobbySimilarity(
          userHobbiesNames,
          groupHobbies,
        );
        const friendCount = await getFriendCountInGroup(group, userId);

        const suggestionScore = hobbySimilarity + friendCount * 0.05;

        return {
          ...group,
          hobbySimilarity,
          friendCount,
          suggestionScore,
        };
      }),
    );

    groupsWithSimilarityAndFriends.sort((a, b) => b.suggestionScore - a.suggestionScore);

    return {
      groups: groupsWithSimilarityAndFriends,
      pages, // Tổng số trang
    };
  } catch (error) {
    console.error("Lỗi khi lấy nhóm chưa tham gia:", error);
    throw new Error("Lỗi khi lấy nhóm chưa tham gia.");
  }
};
// Hàm tạo nhóm mới
const createGroupService = async ({
  groupName,
  type,
  idAdmin,
  introduction,
  avt,
  backGround,
  hobbies,
  rule,
}) => {
  const existingGroup = await Group.findOne({ groupName: groupName.trim() });
    if (existingGroup) {
      throw new Error('Tên nhóm đã tồn tại. Vui lòng chọn tên khác.');
    }
    
  const newGroup = new Group({
    groupName,
    type,
    idAdmin,
    introduction,
    avt, // Lưu ObjectId của MyPhoto cho avt
    backGround, // Lưu ObjectId của MyPhoto cho backGround
    hobbies,
    rule,
    members: {
      count: 1,
      listUsers: [
        {
          idUser: idAdmin,
          state: 'accepted',
        },
      ],
    },
    Administrators: [],
  });

  const savedGroup = await newGroup.save();
  return savedGroup;
};
// Hàm thêm một quản trị viên mới (Administrator) vào nhóm
const addAdminService = async (groupId, adminId, currentUserId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(adminId) ||
    !mongoose.Types.ObjectId.isValid(currentUserId)
  ) {
    throw new Error('ID không hợp lệ.');
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  if (group.idAdmin.toString() !== currentUserId.toString()) {
    throw new Error('Bạn không có quyền thêm quản trị viên cho nhóm này.');
  }

  const isMember = group.members.listUsers.some(
    (member) =>
      member.idUser.toString() === adminId && member.state === 'accepted'
  );

  if (!isMember) {
    throw new Error('Người dùng này không phải là thành viên hợp lệ của nhóm.');
  }

  const isAlreadyAdmin = group.Administrators.some(
    (admin) => admin.idUser.toString() === adminId
  );
  if (isAlreadyAdmin) {
    throw new Error('Người dùng này đã là quản trị viên của nhóm.');
  }

  group.Administrators.push({
    idUser: adminId,
    state: 'pending',
    joinDate: new Date()
  });

  await group.save();

  const personalManagementLink = `http://localhost:5173/group/${group._id}/personal-management`;

  const currentUser = await User.findById(currentUserId);
  const senderAvatar = await getUserAvatarLink(currentUser);
  const senderDisplayName = currentUser.displayName || 'Người quản trị';

  emitEvent('invite_become_admin', {
    senderId: {
      _id: currentUserId,
      avt: [
        {
          _id: senderAvatar._id || '', 
          link: senderAvatar.link || ''
        }
      ],
      displayName: senderDisplayName,
    },
    receiverId: adminId, 
    message: `Bạn đã được mời làm quản trị viên của nhóm ${group.groupName}.`,
    groupId: group._id,
    status: 'unread',
    createdAt: new Date(),
    link: personalManagementLink 
  });

  const notification = new Notification({
    senderId: currentUserId,
    receiverId: adminId,
    message: `Bạn đã được mời làm quản trị viên của nhóm ${group.groupName}.`,
    status: 'unread',
    createdAt: new Date(),
    link: personalManagementLink
  });

  await notification.save();

  return {
    message: 'Quản trị viên đã được thêm thành công.',
    group
  };
};

const getProcessedArticlesService = async (groupId, page, limit) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new Error('ID nhóm không hợp lệ.');
    }

    // Tìm dữ liệu nhóm và populate idArticle trong listArticle
    const groupData = await Group.findById(groupId).populate(
      'article.listArticle.idArticle'
    );

    // Đảm bảo groupData tồn tại và listArticle là một mảng
    if (!groupData || !Array.isArray(groupData.article.listArticle)) return [];

    // Lọc các bài viết có trạng thái 'processed'
    const processedArticleIds = groupData.article.listArticle
      .filter((articleItem) => articleItem.state === 'processed' && !articleItem.idArticle._destroy)
      .map((articleItem) => articleItem.idArticle._id);

    if (processedArticleIds.length === 0) return [];

    // Phân trang
    const skip = (page - 1) * limit;

    // Truy vấn các bài viết đã xử lý
    const articles = await Article.find({
      _id: { $in: processedArticleIds },
      _destroy: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt',
        populate: { path: 'avt', select: 'name link type' }, // Lấy myPhoto của createdBy
      })
      .populate({
        path: 'groupID',
        select: 'groupName avt backGround',
        populate: [
          { path: 'avt', select: 'name link type' },
          { path: 'backGround', select: 'name link type' },
        ],
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: { path: 'avt', select: 'name link type' }, // Lấy myPhoto của người dùng comment
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: { path: 'avt', select: 'name link type' }, // Lấy myPhoto của người dùng reply
            },
          },
        ],
      })
      .populate('listPhoto', 'name link type') // Lấy myPhoto trong listPhoto
      .lean();

    // Đảm bảo trả về các trường cần thiết cho mỗi bài viết
    return articles.map((article) => ({
      ...article,
      totalLikes: article.totalLikes || 0,
      totalComments: article.totalComments || 0,
      listPhoto: article.listPhoto || [],
    }));
  } catch (error) {
    console.error('Lỗi khi lấy bài viết đã xử lý của nhóm:', error);
    throw new Error('Lỗi khi lấy bài viết đã xử lý của nhóm.');
  }
};

const createArticleService = async ({
  content,
  userId,
  groupId,
  scope,
  state,
  hashTag,
  listPhoto
}) => {
  try {
    // Tạo bài viết mới
    const newArticle = new Article({
      content,
      createdBy: userId,
      groupID: groupId,
      scope,
      state: state || 'pending',
      hashTag,
      listPhoto, // Sử dụng danh sách ObjectId của MyPhoto
      interact: { emoticons: [], comment: [] }
    });

    const savedArticle = await newArticle.save();

    // Cập nhật danh sách bài viết trong nhóm
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        $push: {
          'article.listArticle': {
            idArticle: savedArticle._id,
            state: 'pending'
          }
        }
      },
      { new: true }
    );

    if (!updatedGroup) {
      throw new Error('Không tìm thấy nhóm để cập nhật bài viết.');
    }

    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: userId,
      },
      listPhoto: await MyPhoto.find({ _id: { $in: listPhoto } }).select('name link type'), // Trả về chi tiết ảnh
      interact: {
        emoticons: savedArticle.interact.emoticons || [],
        comment: savedArticle.interact.comment || []
      }
    };
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message);
    throw new Error('Lỗi khi tạo bài viết.');
  }
};

const getPendingArticlesService = async (groupId) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) throw new Error('Nhóm không tồn tại.');

    const pendingArticleIds = group.article.listArticle
      .filter((article) => article.state === 'pending')
      .map((article) => article.idArticle);

    if (pendingArticleIds.length === 0) return [];

    const pendingArticles = await Article.find({
      _id: { $in: pendingArticleIds }
    })
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt',
        populate: { path: 'avt', select: 'name link type' } // Populate để lấy myPhoto của createdBy
      })
      .populate({
        path: 'listPhoto',
        select: 'name link type', // Lấy thông tin myPhoto của listPhoto
      })
      .sort({ createdAt: -1 })
      .lean(); // Chuyển đổi Document sang Object JS thuần tuý để xử lý dễ dàng hơn

    return pendingArticles;
  } catch (error) {
    console.error('Lỗi khi lấy bài viết pending:', error.message);
    throw new Error(error.message);
  }
};
// Cập nhật trạng thái bài viết
const updateArticleStateService = async (groupId, articleId, newState) => {
  try {
    const group = await Group.findOne({
      _id: groupId,
      'article.listArticle.idArticle': articleId
    })
    if (!group) {
      throw new Error(
        'Không tìm thấy nhóm hoặc bài viết trong nhóm để cập nhật.'
      )
    }

    const currentArticle = group.article.listArticle.find(
      (article) => article.idArticle.toString() === articleId
    )
    if (!currentArticle) {
      throw new Error('Bài viết không tồn tại trong nhóm này.')
    }

    const previousState = currentArticle.state

    currentArticle.state = newState
    group.updatedAt = new Date()

    if (newState === 'processed' && previousState !== 'processed') {
      group.article.count += 1
    }

    const updatedGroup = await group.save()
    return updatedGroup
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái bài viết:', error.message)
    throw new Error(error.message)
  }
}

const checkUserPermission = async (userId, groupId) => {
  try {
    const group = await Group.findById(groupId)
    if (!group) return false

    const isAdmin = group.idAdmin.toString() === userId
    const isModerator = group.Administrators.some(
      (admin) => admin.idUser.toString() === userId
    )

    return isAdmin || isModerator
  } catch (error) {
    console.error('Lỗi khi kiểm tra quyền của người dùng:', error.message)
    throw new Error(error.message)
  }
}

const getGroupMembersService = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.');
  }

  // Tìm nhóm dựa trên groupId và populate các trường của thành viên
  const group = await Group.findById(groupId)
    .populate({
      path: 'members.listUsers.idUser',
      select: 'firstName lastName displayName avt backGround',
      populate: [
        { path: 'avt', select: 'name link type' }, // Lấy MyPhoto của avatar
        { path: 'backGround', select: 'name link type' } // Lấy MyPhoto của background
      ]
    })
    .select('members');

  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  // Lọc các thành viên có trạng thái 'accepted'
  const acceptedMembers = group.members.listUsers.filter(
    (member) => member.state === 'accepted'
  );

  return acceptedMembers;
};


const removeMemberService = async (groupId, memberId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(memberId)
  ) {
    throw new Error('ID nhóm hoặc thành viên không hợp lệ.')
  }

  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  group.members.listUsers = group.members.listUsers.filter(
    (member) => member.idUser.toString() !== memberId
  )
  group.members.count = group.members.listUsers.length

  group.Administrators = group.Administrators.filter(
    (admin) => admin.idUser.toString() !== memberId
  )

  const articlesToDelete = await Article.find({
    groupID: groupId,
    createdBy: memberId
  })

  const acceptedArticles = articlesToDelete.filter(
    (article) => article.state === 'processed'
  )

  await Article.updateMany(
    { groupID: groupId, createdBy: memberId },
    { $set: { _destroy: Date.now() } }
  )

  const articleIdsToRemove = articlesToDelete.map((article) =>
    article._id.toString()
  )
  group.article.listArticle = group.article.listArticle.filter(
    (articleId) => !articleIdsToRemove.includes(articleId.toString())
  )

  group.article.count -= acceptedArticles.length

  await group.save()

  return {
    message: 'Đã xóa thành viên khỏi nhóm và xóa tất cả bài viết liên quan.',
    group
  }
}

const updateGroupRulesService = async (groupId, rules, userId) => {
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  if (group.idAdmin.toString() !== userId) {
    throw new Error('Bạn không có quyền cập nhật quy định này.')
  }

  group.rule = rules
  await group.save()

  return group
}


const acceptInviteService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(groupId)
  ) {
    throw new Error('ID không hợp lệ.')
  }

  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const existingMemberIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'accepted'
  )
  if (existingMemberIndex !== -1) {
    throw new Error('Người dùng đã là thành viên của nhóm.')
  }

  const memberIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'pending'
  )
  if (memberIndex === -1) {
    throw new Error('Không tìm thấy lời mời cho người dùng này.')
  }

  group.members.listUsers[memberIndex].state = 'accepted'
  group.members.count += 1

  await group.save()

  const admin = await User.findById(group.idAdmin);
  const adminAvatar = await getUserAvatarLink(admin); 
  const adminDisplayName = admin.displayName || 'Người quản trị';

  const groupLink = `http://localhost:5173/group/${group._id}`; 
  const notification = new Notification({
    senderId: group.idAdmin,
    receiverId: userId,
    message: ` Nhóm ${group.groupName} phê duyệt yêu cầu tham gia`,
    status: 'unread',
    createdAt: new Date(),
    link: groupLink
  })

  await notification.save()

  emitEvent('user_accepted_notification', {
    senderId: {
      _id: group.idAdmin,
      avt: [
        {
          _id: adminAvatar._id || '', 
          link: adminAvatar.link || ''  
        }
      ],
      displayName: adminDisplayName,
    },
    receiverId: userId,
    message: ` Nhóm ${group.groupName} phê duyệt yêu cầu tham gia`,
    groupId: group._id,
    status: 'unread',
    createdAt: new Date(),
    link: groupLink
  })

  emitEvent('group_member_count_updated', {
    groupId: group._id,
    memberCount: group.members.count
  })

  return {
    message: 'Chấp nhận lời mời thành công.',
    member: group.members.listUsers[memberIndex]
  }
}

// Hàm từ chối lời mời tham gia nhóm
const rejectInviteService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(groupId)
  ) {
    throw new Error('ID không hợp lệ.')
  }

  const group = await Group.findById(groupId)

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const inviteIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'pending'
  )

  if (inviteIndex === -1) {
    throw new Error('Không tìm thấy lời mời cho người dùng này.')
  }

  // Xóa lời mời
  group.members.listUsers.splice(inviteIndex, 1)
  await group.save() // Lưu thay đổi

  return {
    message: 'Đã từ chối yêu cầu tham gia nhóm thành công.',
    userId: userId
  }
}

const getAvailableMembersService = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.');
  }

  const group = await Group.findById(groupId)
    .populate({
      path: 'members.listUsers.idUser',
      select: 'displayName avt',
      populate: {
        path: 'avt', // populate toàn bộ mảng avt
        select: 'name link type', // Lấy thông tin của mỗi MyPhoto trong avt
      }
    })
    .lean();

  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  const availableMembers = group.members.listUsers.filter(
    (member) =>
      member.state === 'accepted' &&
      member.idUser._id.toString() !== group.idAdmin.toString() &&
      !group.Administrators.some(
        (admin) => admin.idUser.toString() === member.idUser._id.toString()
      )
  );

  return availableMembers.map((member) => ({
    idUser: member.idUser._id.toString(),
    displayName: member.idUser.displayName,
    avt: member.idUser.avt.map(photo => ({
      name: photo.name,
      link: photo.link,
      type: photo.type
    })), // Duyệt qua mỗi ảnh trong mảng avt để lấy thông tin chi tiết
    joinDate: new Date(member.joinDate).toISOString()
  }));
};


const cancelInviteService = async (groupId, userId, currentUserId) => {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(currentUserId)
  ) {
    throw new Error('ID không hợp lệ, vui lòng kiểm tra lại.')
  }

  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  if (group.idAdmin.toString() !== currentUserId) {
    throw new Error('Bạn không có quyền hủy lời mời.')
  }

  const adminIndex = group.Administrators.findIndex(
    (admin) => admin.idUser.toString() === userId && admin.state === 'pending'
  )

  if (adminIndex === -1) {
    throw new Error('Không tìm thấy lời mời đang chờ xác nhận.')
  }

  group.Administrators.splice(adminIndex, 1)
  await group.save()

  return group
}

// Lấy danh sách lời mời đang chờ xác nhận
const getPendingInvitesService = async (groupId) => {
  const group = await Group.findById(groupId).populate({
    path: 'Administrators.idUser',
    select: 'displayName avt',
    populate: {
      path: 'avt',
      select: 'link' // Chỉ lấy link của MyPhoto trong avatar
    },
  });

  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  // Lọc danh sách lời mời đang chờ xác nhận
  const pendingInvites = group.Administrators.filter(
    (admin) => admin.state === 'pending'
  );

  // Định dạng lại kết quả để giữ nguyên cấu trúc
  return pendingInvites.map((invite) => ({
    idUser: {
      _id: invite.idUser._id.toString(),
      displayName: invite.idUser.displayName,
      avt: invite.idUser.avt && invite.idUser.avt.length > 0
        ? invite.idUser.avt[invite.idUser.avt.length - 1].link // Lấy link của ảnh cuối cùng trong avt
        : null,
    },
    state: invite.state,
    joinDate: invite.joinDate ? invite.joinDate.toISOString() : null, // Giữ joinDate nếu có
    _id: invite._id.toString(),
  }));
};

const getRequestsService = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.');
  }

  const group = await Group.findById(groupId)
    .populate({
      path: 'members.listUsers.idUser',
      select: 'displayName account.email avt hobbies',
      populate: {
        path: 'avt',
        select: 'link' // Chỉ lấy link của MyPhoto trong avatar
      },
    })
    .select('members.listUsers');

  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  // Lọc danh sách người dùng có trạng thái 'pending' và định dạng kết quả trả về
  const requests = group.members.listUsers
    .filter((user) => user.state === 'pending')
    .map((user) => ({
      idUser: {
        _id: user.idUser._id.toString(),
        account: { email: user.idUser.account.email },
        avt: user.idUser.avt ? user.idUser.avt.map((photo) => photo.link) : [],
        hobbies: user.idUser.hobbies || [],
        displayName: user.idUser.displayName,
      },
      state: user.state,
      joinDate: user.joinDate ? user.joinDate.toISOString() : null,
      _id: user._id.toString(), // ID của lời mời
    }));

  return requests;
};


const getAcceptedAdministratorsService = async (groupId) => {
  // Tìm nhóm theo `groupId` và populate thông tin cần thiết
  const group = await Group.findById(groupId).populate({
    path: 'Administrators.idUser',
    select: 'displayName avt',
    populate: {
      path: 'avt',
      select: 'name link type' // Chỉ lấy thông tin cần thiết từ MyPhoto của avatar
    },
  });

  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  // Lọc ra các quản trị viên có trạng thái đã được chấp nhận
  const acceptedAdministrators = group.Administrators.filter(
    (admin) => admin.state === 'accepted'
  );

  // Định dạng kết quả trả về
  return acceptedAdministrators.map((admin) => ({
    idUser: {
      _id: admin.idUser._id.toString(),
      displayName: admin.idUser.displayName,
      avt: admin.idUser.avt && admin.idUser.avt.length > 0
        ? admin.idUser.avt[admin.idUser.avt.length - 1].link // Lấy link của ảnh cuối cùng trong avt
        : null,
    },
    state: admin.state,
    joinDate: admin.joinDate ? admin.joinDate.toISOString() : null, // Lấy joinDate nếu có
    _id: admin._id.toString(),
  }));
};

const getUserArticlesInGroupService = async (groupId, userId, page = 1, limit = 10) => {
  try {
    // Kiểm tra tính hợp lệ của `groupId` và `userId`
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw new Error('ID nhóm không hợp lệ.');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.');
    }

    // Phân trang
    const skip = (page - 1) * limit;

    // Tìm các bài viết của người dùng trong nhóm cụ thể
    const articles = await Article.find({
      groupID: groupId,
      createdBy: userId, // Chỉ lấy bài viết của người dùng cụ thể trong nhóm đã chỉ định
      _destroy: { $exists: false }, // Bỏ qua các bài viết bị xóa mềm
      state: 'processed', // Lọc bài viết có trạng thái 'processed' (đã duyệt)
    })
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt',
        populate: { path: 'avt', select: 'name link type' },
      })
      .populate({
        path: 'groupID',
        select: 'groupName avt backGround',
        populate: [
          { path: 'avt', select: 'name link type' },
          { path: 'backGround', select: 'name link type' },
        ],
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: { path: 'avt', select: 'name link type' },
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: { path: 'avt', select: 'name link type' },
            },
          },
        ],
      })
      .populate('listPhoto', 'name link type') 
      .lean();

    return articles.map((article) => ({
      ...article,
      totalLikes: article.totalLikes || 0,
      totalComments: article.totalComments || 0,
      listPhoto: article.listPhoto || [],
    }));
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của người dùng trong nhóm:', error);
    throw new Error('Lỗi khi lấy bài viết của người dùng trong nhóm.');
  }
};

const getUserPendingInvitesService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.')
  }

  // Tìm nhóm theo ID và kiểm tra các lời mời đang chờ đối với người dùng hiện tại
  const group = await Group.findById(groupId).populate(
    'Administrators.idUser',
    'displayName avt'
  )

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Tìm kiếm lời mời đang chờ xử lý (state là 'pending') đối với người dùng hiện tại
  const userPendingInvites = group.Administrators.filter(
    (admin) =>
      admin.idUser._id.toString() === userId && admin.state === 'pending'
  )

  // Trả về danh sách lời mời liên quan đến người dùng hiện tại
  return userPendingInvites.map((invite) => ({
    idUser: invite.idUser._id,
    displayName: invite.idUser.displayName,
    avt: invite.idUser.avt,
    joinDate: invite.joinDate
  }))
}
const acceptAdminInviteService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.')
  }

  // Tìm nhóm theo ID
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Tìm kiếm lời mời quản trị viên đang chờ (pending) cho người dùng
  const adminInviteIndex = group.Administrators.findIndex(
    (admin) => admin.idUser.toString() === userId && admin.state === 'pending'
  )

  if (adminInviteIndex === -1) {
    throw new Error(
      'Không tìm thấy lời mời quản trị viên đang chờ cho người dùng này.'
    )
  }

  // Cập nhật trạng thái lời mời thành 'accepted'
  group.Administrators[adminInviteIndex].state = 'accepted'

  // Lưu thay đổi vào cơ sở dữ liệu
  await group.save()

  return group // Trả về thông tin nhóm đã cập nhật
}

const rejectAdminInviteService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.')
  }

  // Tìm nhóm theo ID
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Tìm kiếm lời mời quản trị viên đang chờ (pending) cho người dùng
  const adminInviteIndex = group.Administrators.findIndex(
    (admin) => admin.idUser.toString() === userId && admin.state === 'pending'
  )

  if (adminInviteIndex === -1) {
    throw new Error(
      'Không tìm thấy lời mời quản trị viên đang chờ cho người dùng này.'
    )
  }

  // Xóa lời mời khỏi danh sách Administrators
  group.Administrators.splice(adminInviteIndex, 1)

  // Lưu thay đổi vào cơ sở dữ liệu
  await group.save()

  return group // Trả về thông tin nhóm đã cập nhật
}
const getUserRoleService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc người dùng không hợp lệ.')
  }

  const group = await Group.findById(groupId)

  if (!group) {
    throw new Error('Không tìm thấy nhóm.')
  }

  // Kiểm tra xem người dùng có phải là chủ nhóm không
  if (group.idAdmin.toString() === userId) {
    return 'owner'
  }

  // Kiểm tra xem người dùng có phải là quản trị viên đã được chấp nhận không
  const isAdmin = group.Administrators.some(
    (admin) => admin.idUser.toString() === userId && admin.state === 'accepted'
  )

  if (isAdmin) {
    return 'admin'
  }

  // Kiểm tra xem người dùng có phải là thành viên đã được chấp nhận không
  const isMember = group.members.listUsers.some(
    (member) =>
      member.idUser.toString() === userId && member.state === 'accepted'
  )

  if (isMember) {
    return 'member'
  }

  return 'none' // Người dùng không có vai trò trong nhóm
}
const removeAdminRoleService = async (groupId, userId) => {
  try {
    // Tìm nhóm theo groupId và kiểm tra trong danh sách quản trị viên (Administrators)
    const group = await Group.findOne({
      _id: groupId,
      'Administrators.idUser': userId
    })

    if (!group) {
      return false // Không tìm thấy nhóm hoặc người dùng không phải là quản trị viên
    }

    // Loại bỏ quản trị viên khỏi danh sách Administrators và cập nhật lại Group
    group.Administrators = group.Administrators.filter(
      (admin) => admin.idUser.toString() !== userId
    )
    await group.save()

    return true 
  } catch (error) {
    console.error('Lỗi khi xoá quản trị viên:', error.message)
    throw new Error('Lỗi khi xoá quản trị viên')
  }
}

const sendJoinRequestService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.')
  }

  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const existingMember = group.members.listUsers.find(
    (member) => member.idUser.toString() === userId
  )
  if (existingMember) {
    if (existingMember.state === 'pending') {
      throw new Error('Yêu cầu tham gia nhóm đang chờ xử lý.')
    }
    if (existingMember.state === 'accepted') {
      throw new Error('Người dùng đã là thành viên của nhóm.')
    }
  }

  group.members.listUsers.push({
    idUser: userId,
    state: 'pending',
    joinDate: new Date()
  })

  const updatedGroup = await group.save()

  return updatedGroup
}

const revokeRequestService = async (groupId, userId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc người dùng không hợp lệ.')
  }

  const updatedGroup = await Group.findByIdAndUpdate(
    groupId,
    {
      $pull: { 'members.listUsers': { idUser: userId, state: 'pending' } }
    },
    { new: true }
  )

  if (!updatedGroup) {
    throw new Error('Không tìm thấy nhóm hoặc không thể cập nhật.')
  }

  return updatedGroup
}

const editGroupService = async (groupId, userId, groupName, introduction, hobbies, rule, files) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  if (group.idAdmin.toString() !== userId) {
    throw new Error('Bạn không có quyền chỉnh sửa nhóm này.');
  }

  const hobbiesArray = Array.isArray(hobbies)
    ? hobbies
    : hobbies
    ? hobbies.split(',').map((hobby) => hobby.trim())
    : [];

  // Xử lý ảnh đại diện
  if (files?.avt) {
    const oldAvt = await MyPhoto.findById(group.avt);
    if (oldAvt) {
      await MyPhoto.findByIdAndUpdate(oldAvt._id, { _destroy: new Date() });
      await cloudStorageService.deleteImageFromStorage(oldAvt.link);
    }

    const avtPhoto = await MyPhoto.create({
      name: files.avt[0].originalname,
      idAuthor: userId,
      type: 'img',
      link: 'placeholder-url',
    });
    const avtFileName = `v1/group/${groupId}/avt/${avtPhoto._id}`;
    const avtUrl = await cloudStorageService.uploadImageStorage(files.avt[0], avtFileName);

    if (avtUrl) {
      await MyPhoto.findByIdAndUpdate(avtPhoto._id, { link: avtUrl });
      group.avt = avtPhoto._id;
    }
  }

  // Xử lý ảnh nền
  if (files?.backGround) {
    const oldBackground = await MyPhoto.findById(group.backGround);
    if (oldBackground) {
      await MyPhoto.findByIdAndUpdate(oldBackground._id, { _destroy: new Date() });
      await cloudStorageService.deleteImageFromStorage(oldBackground.link);
    }

    const backGroundPhoto = await MyPhoto.create({
      name: files.backGround[0].originalname,
      idAuthor: userId,
      type: 'img',
      link: 'placeholder-url',
    });
    const backGroundFileName = `v1/group/${groupId}/background/${backGroundPhoto._id}`;
    const backGroundUrl = await cloudStorageService.uploadImageStorage(files.backGround[0], backGroundFileName);

    if (backGroundUrl) {
      await MyPhoto.findByIdAndUpdate(backGroundPhoto._id, { link: backGroundUrl });
      group.backGround = backGroundPhoto._id;
    }
  }

  // Cập nhật thông tin nhóm
  group.groupName = groupName || group.groupName;
  group.introduction = introduction || group.introduction;
  group.hobbies = hobbiesArray.length > 0 ? hobbiesArray : group.hobbies;
  group.rule = rule || group.rule;

  return await group.save();
};



const deleteGroupService = async (groupId, userId) => {
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  if (group.idAdmin.toString() !== userId) {
    throw new Error('Bạn không có quyền xóa nhóm này.')
  }

  await Article.deleteMany({ groupID: groupId })

  group.members.listUsers = []
  group.Administrators = [] 

  group._destroy = new Date() 

  // Lưu nhóm sau khi cập nhật
  const deletedGroup = await group.save()

  return deletedGroup
}

const leaveGroupService = async (groupId, userId) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Nhóm không tồn tại.');
    }

    const memberIndex = group.members.listUsers.findIndex(
      (member) =>
        member.idUser.toString() === userId && member.state === 'accepted'
    );
    if (memberIndex === -1) {
      throw new Error('Người dùng không phải là thành viên của nhóm.');
    }

    const userArticles = await Article.find({
      groupID: groupId,
      createdBy: userId,
      state: 'processed',
      _destroy: { $exists: false },
    });

    await Article.updateMany(
      {
        groupID: groupId,
        createdBy: userId,
        state: 'processed',
        _destroy: { $exists: false },
      },
      { _destroy: new Date() }
    );

    const deletedArticleCount = userArticles.length;
    group.article.count -= deletedArticleCount;

    // Kiểm tra và filter listArticle
    if (Array.isArray(group.article.listArticle)) {
      group.article.listArticle = group.article.listArticle.filter(
        (article) => article.createdBy && article.createdBy.toString() !== userId
      );
    }

    group.Administrators = group.Administrators.filter(
      (admin) => admin.idUser.toString() !== userId
    );

    group.members.listUsers.splice(memberIndex, 1);
    group.members.count -= 1;

    if (group.members.count === 0) {
      await Group.findByIdAndDelete(groupId);
      return { message: `Đã rời nhóm và nhóm đã bị xóa do không còn thành viên.` };
    }

    await group.save();

    return {
      message: `Đã rời nhóm và xóa tất cả ${deletedArticleCount} bài viết liên quan.`,
    };
  } catch (error) {
    console.error('Lỗi khi rời nhóm:', error);
    throw new Error('Có lỗi xảy ra khi rời nhóm.'); 
  }
};

const getFriendsNotInGroupService = async (userId, groupId) => {
  try {
    // Kiểm tra ID hợp lệ
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {
      throw new Error('ID người dùng hoặc ID nhóm không hợp lệ.');
    }

    // Lấy thông tin bạn bè của người dùng cùng với thông tin chi tiết của ảnh đại diện
    const user = await User.findById(userId).populate({
      path: 'friends.idUser',
      select: 'firstName lastName displayName avt',
      populate: {
        path: 'avt',
        select: 'name link type', // Lấy chi tiết MyPhoto cho avatar
      },
    });

    if (!user) {
      throw new Error('Người dùng không tồn tại.');
    }

    // Lấy danh sách thành viên của nhóm
    const group = await Group.findById(groupId).select('members.listUsers');
    if (!group) {
      throw new Error('Nhóm không tồn tại.');
    }

    // Kiểm tra xem danh sách bạn bè có tồn tại hay không
    if (!user.friends || user.friends.length === 0) {
      throw new Error('Người dùng không có bạn bè.');
    }

    // Lọc danh sách bạn bè chưa tham gia nhóm
    const groupMemberIds = group.members.listUsers.map((member) =>
      member.idUser.toString()
    );

    const friendsNotInGroup = user.friends
      .filter(
        (friend) =>
          friend.idUser &&
          !groupMemberIds.includes(friend.idUser._id.toString())
      )
      .map((friend) => ({
        _id: friend.idUser._id,
        displayName: friend.idUser.displayName,
        avt:
          friend.idUser.avt && friend.idUser.avt.length > 0
            ? friend.idUser.avt[friend.idUser.avt.length - 1].link // Lấy link của ảnh cuối cùng trong avt nếu có
            : '', // Trả về chuỗi rỗng nếu không có ảnh
      }));

    return friendsNotInGroup;
  } catch (error) {
    console.error(
      'Lỗi khi lấy danh sách bạn bè chưa tham gia nhóm:',
      error.message || error
    );
    throw new Error('Lỗi khi lấy danh sách bạn bè chưa tham gia nhóm.');
  }
};

const inviteFriendsToGroupService = async (userId, groupId, invitedFriends) => {
  try {
    // Kiểm tra ID hợp lệ
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {
      throw new Error('ID người dùng hoặc nhóm không hợp lệ');
    }

    // Lấy thông tin nhóm
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Nhóm không tồn tại');
    }

    // Kiểm tra nếu người mời là thành viên của nhóm
    const isMember = group.members.listUsers.some(
      (member) =>
        member.idUser.toString() === userId && member.state === 'accepted'
    );

    if (!isMember) {
      throw new Error(
        'Bạn phải là thành viên của nhóm để mời người khác tham gia'
      );
    }

    const exploreGroupLink = `http://localhost:5173/group/explore-groups`; // Tạo link tới trang khám phá nhóm

    // Gửi thông báo đến từng bạn bè
    for (const friendId of invitedFriends) {
      // Kiểm tra friendId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(friendId)) {
        console.warn(`ID người dùng không hợp lệ: ${friendId}`);
        continue; // Bỏ qua ID không hợp lệ
      }

      // Kiểm tra thông tin người nhận (friendId) có tồn tại không
      const receiver = await User.findById(friendId).select('_id displayName');
      if (!receiver) {
        console.warn(`Người dùng với ID ${friendId} không tồn tại.`);
        continue; // Bỏ qua nếu người dùng không tồn tại
      }

      // Tạo thông báo cho bạn bè được mời
      const notificationMessage = `Bạn đã được mời tham gia nhóm ${group.groupName}`;
      const notification = new Notification({
        senderId: userId,
        receiverId: receiver._id, // Đảm bảo receiverId được lấy từ thông tin người nhận
        message: notificationMessage,
        link: exploreGroupLink, // Thêm link tới thông báo
        status: 'unread',
        createdAt: new Date()
      });
      await notification.save();

      // Lấy thông tin người gửi để gửi thông báo real-time
      const sender = await User.findById(userId)
      const avtLink = await getUserAvatarLink(sender);
      // Phát sự kiện real-time
      emitEvent('new_group_invite_notification', {
        senderId: {
          _id: userId,
          avt: [
            {
              _id: avtLink ? avtLink._id : '', // Đảm bảo rằng _id của avatar được truyền chính xác
              link: avtLink ? avtLink.link : ''  // Truyền link avatar
            }
          ],
          displayName: sender.displayName,
        },
        groupId,
        receiverId: receiver._id,
        message: `${sender.displayName} đã mời bạn tham gia nhóm ${group.groupName}`,
        createdAt: new Date(),
        link: exploreGroupLink // Thêm link vào sự kiện socket
      });
    }

    return invitedFriends;
  } catch (error) {
    console.error('Lỗi khi gửi lời mời tham gia nhóm:', error);
    throw new Error('Lỗi khi gửi lời mời tham gia nhóm.');
  }
};


const getAllGroupsService = async () => {
  try {
    const groups = await Group.find({})
      .populate({
        path: 'avt', // Lấy avatar của nhóm
        select: 'name link type', // Chỉ lấy các trường cần thiết
      })
      .populate({
        path: 'backGround', // Lấy background của nhóm
        select: 'name link type', // Chỉ lấy các trường cần thiết
      })
      .lean(); // Sử dụng lean() để trả về Object JS thuần tuý

    // Format lại thông tin nhóm để chỉ trả về các trường cần thiết
    const formattedGroups = groups.map((group) => ({
      _id: group._id,
      groupName: group.groupName,
      warningLevel: group.warningLevel,
      type: group.type,
      idAdmin: group.idAdmin,
      introduction: group.introduction || '',
      avt: group.avt ? group.avt.link : null,
      backGround: group.backGround ? group.backGround.link : null,
      members: {
        count: group.members?.count || 0,
        listUsers: group.members?.listUsers?.map((user) => ({
          idUser: user.idUser || '',
          state: user.state || 'pending',
          joinDate: user.joinDate || '',
        })) || [],
      },
      article: {
        count: group.article?.count || 0,
        listArticle: group.article?.listArticle?.map((article) => ({
          idArticle: article.idArticle || '',
          state: article.state || '',
        })) || [],
      },
      hobbies: group.hobbies || [],
      rule: group.rule || [],
      createdAt: group.createdAt,
      updatedAt: group.updatedAt || null,
      _destroy: !!group._destroy, // Check if the group has been deleted
    }));
    

    return formattedGroups;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm:', error.message);
    throw new Error('Lỗi khi lấy danh sách nhóm.');
  }
};

const lockGroupService = async (groupId) => {
  const group = await Group.findById(groupId);
  if (!group) {
      throw new Error('Group not found.');
  }

  group._destroy = new Date();
  await group.save();

  const admin = await Admin.findOne();  // Lấy admin hệ thống (có thể lấy dựa trên ID hoặc quyền)
  if (!admin) {
    throw new Error('Admin system not found.');
  }
  const originalPostLink = `http://localhost:5173/group/your-groups`;
  // Phát sự kiện thông báo (nếu cần)
  emitEvent('group_lock_notification', {
    senderId: admin._id,
    receiverId: group.idAdmin,
    message: `Nhóm ${group.groupName} của bạn đã bị lock bởi hệ thống khóa`,
    status: 'unread',
    createdAt: new Date(),
    link: originalPostLink,
  });

  const newNotification = new Notification({
    senderId: admin._id,  // ID của admin gửi thông báo
    receiverId: group.idAdmin,  // ID của quản trị viên nhóm
    message: `Nhóm ${group.groupName} của bạn đã bị lock bởi hệ thống khóa`,
    status: 'unread',  // Đặt trạng thái là 'unread'
    createdAt: new Date(),
    link: originalPostLink,
  });

    // Lưu thông báo vào cơ sở dữ liệu
  await newNotification.save();

  return group;
};

const unlockGroupService = async (groupId) => {
  const group = await Group.findById(groupId);
  if (!group) {
      throw new Error('Group not found.');
  }

  if (!group._destroy) {
      throw new Error('Group is not locked.');
  }

  group._destroy = undefined; // Set _destroy to null to unlock the group
  await group.save();
  
  const admin = await Admin.findOne();  // Lấy admin hệ thống (có thể lấy dựa trên ID hoặc quyền)
  if (!admin) {
    throw new Error('Admin system not found.');
  }
  const originalPostLink = `http://localhost:5173/group/${group._id}`;
  // Phát sự kiện thông báo (nếu cần)
  emitEvent('group_lock_unlock_notification', {
    senderId: admin._id,
    receiverId: group.idAdmin,
    message: `Nhóm ${group.groupName} của bạn đã được mở lock bởi hệ thống khóa`,
    status: 'unread',
    createdAt: new Date(),
    link: originalPostLink,
  });

  const newNotification = new Notification({
    senderId: admin._id,  // ID của admin gửi thông báo
    receiverId: group.idAdmin,  // ID của quản trị viên nhóm
    message: `Nhóm ${group.groupName} của bạn đã được mở lock bởi hệ thống khóa`,
    status: 'unread',  // Đặt trạng thái là 'unread'
    createdAt: new Date(),
    link: originalPostLink,
  });

    // Lưu thông báo vào cơ sở dữ liệu
  await newNotification.save();

  return group;
};

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

const getGroupDetailsService = async (groupId) => {
  // Kiểm tra tính hợp lệ của groupId
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.');
  }

  // Lấy thông tin nhóm từ database
  const groupDetails = await Group.findById(groupId)
    .populate({
      path: 'avt', // Lấy avatar của nhóm
      model: 'MyPhoto',
      select: 'name link type' // Chỉ lấy các trường cần thiết từ MyPhoto
    })
    .populate({
      path: 'backGround', // Lấy background của nhóm
      model: 'MyPhoto',
      select: 'name link type' // Chỉ lấy các trường cần thiết từ MyPhoto
    })
    .populate({
      path: 'members.listUsers',  // Lấy thông tin thành viên
      select: 'name email avatar' // Lấy các trường cần thiết của người dùng
    })
    .lean(); // Sử dụng lean() để trả về object thuần, không phải instance Mongoose

  return groupDetails;
};


export const groupService = {
  getUserGroupsService,
  getAllGroupArticlesService,
  getNotJoinedGroupsService,
  createGroupService,
  getProcessedArticlesService,
  createArticleService,
  getPendingArticlesService,
  updateArticleStateService,
  checkUserPermission,
  getGroupMembersService,
  removeMemberService,
  updateGroupRulesService,
  getRequestsService,
  acceptInviteService,
  rejectInviteService,
  getAvailableMembersService,
  addAdminService,
  cancelInviteService,
  getPendingInvitesService,
  getAcceptedAdministratorsService,
  getUserArticlesInGroupService,
  getUserPendingInvitesService,
  acceptAdminInviteService,
  rejectAdminInviteService,
  getUserRoleService,
  removeAdminRoleService,
  sendJoinRequestService,
  revokeRequestService,
  editGroupService,
  deleteGroupService,
  leaveGroupService,
  getFriendsNotInGroupService,
  inviteFriendsToGroupService,
  getAllGroupsService,
  lockGroupService,
  unlockGroupService,
  getGroupDetailsService
}
