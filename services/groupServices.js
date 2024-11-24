import Group from '../models/Group.js'
import Article from '../models/Article.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import mongoose from 'mongoose'
import MyPhoto from '../models/MyPhoto.js'
import { emitEvent } from '../sockets/socket.js'
import { cloudStorageService } from './cloudStorageService.js'

const getUserGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.');
  }

  const userGroups = await Group.find({
    'members.listUsers': { $elemMatch: { idUser: userId, state: 'accepted' } }
  })
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

  return userGroups;
};


// Service lấy tất cả bài viết từ các nhóm mà người dùng đã tham gia và được duyệt
const getAllGroupArticlesService = async (userId, page, limit) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.');
    }

    const userGroups = await Group.find({
      'members.listUsers': {
        $elemMatch: { idUser: userId, state: 'accepted' },
      },
    }).select('article');

    if (!userGroups || userGroups.length === 0) return [];

    const processedArticleIds = userGroups.reduce((acc, group) => {
      if (group.article && Array.isArray(group.article.listArticle)) {
        const groupArticles = group.article.listArticle
          .filter((article) => article.state === 'processed')
          .map((article) => article.idArticle);
        return acc.concat(groupArticles);
      }
      return acc;
    }, []);

    if (processedArticleIds.length === 0) return [];

    const skip = (page - 1) * limit;
    
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

    return articles.map((article) => ({
      ...article,
      totalLikes: article.totalLikes || 0,
      totalComments: article.totalComments || 0,
      listPhoto: article.listPhoto || [],
    }));
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error);
    throw new Error('Lỗi khi lấy bài viết của nhóm.');
  }
};

// Service lấy danh sách các nhóm mà người dùng chưa tham gia
const getNotJoinedGroupsService = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.');
    }

    // Tìm các nhóm mà người dùng chưa tham gia hoặc đang ở trạng thái "pending"
    const groups = await Group.find({
      $or: [
        { 'members.listUsers.idUser': { $ne: userId } },
        {
          'members.listUsers': {
            $elemMatch: { idUser: userId, state: 'pending' }
          }
        }
      ],
      _destroy: { $exists: false }
    })
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
    .lean();

    // Thêm trường userState cho biết trạng thái tham gia của người dùng trong nhóm
    const groupsWithUserState = groups.map((group) => {
      const userState =
        group.members.listUsers.find(
          (member) => member.idUser.toString() === userId
        )?.state || 'not_joined';

      return { ...group, userState };
    });

    return groupsWithUserState;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm chưa tham gia:', error);
    throw new Error('Không thể lấy danh sách nhóm chưa tham gia.');
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
    throw new Error('ID không hợp lệ.')
  }

  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  if (group.idAdmin.toString() !== currentUserId.toString()) {
    throw new Error('Bạn không có quyền thêm quản trị viên cho nhóm này.')
  }

  const isMember = group.members.listUsers.some(
    (member) =>
      member.idUser.toString() === adminId && member.state === 'accepted'
  )

  if (!isMember) {
    throw new Error('Người dùng này không phải là thành viên hợp lệ của nhóm.')
  }

  const isAlreadyAdmin = group.Administrators.some(
    (admin) => admin.idUser.toString() === adminId
  )
  if (isAlreadyAdmin) {
    throw new Error('Người dùng này đã là quản trị viên của nhóm.')
  }

  group.Administrators.push({
    idUser: adminId,
    state: 'pending',
    joinDate: new Date()
  })

  await group.save()

  // Thông báo socket khi người dùng được thêm làm quản trị viên
  emitEvent('invite_become_admin', {
    senderId: currentUserId, // Người đã thêm admin
    receiverId: adminId, // Người nhận thông báo (quản trị viên mới)
    message: `Bạn đã được mời làm quản trị viên của nhóm ${group.groupName}.`,
    groupId: group._id,
    createdAt: new Date()
  })

  return {
    message: 'Quản trị viên đã được thêm thành công.',
    group
  }
}

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

  const notification = new Notification({
    senderId: group.idAdmin,
    receiverId: userId,
    message: `Bạn đã trở thành thành viên của nhóm ${group.groupName}.`,
    status: 'unread',
    createdAt: new Date()
  })

  await notification.save()

  emitEvent('user_accepted_notification', {
    senderId: group.idAdmin,
    receiverId: userId,
    message: `Bạn đã trở thành thành viên của nhóm ${group.groupName}.`,
    groupId: group._id,
    createdAt: new Date()
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
      _destroy: { $exists: false } // Bỏ qua các bài viết bị xóa mềm
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
      .populate('listPhoto', 'name link type') // Lấy danh sách ảnh trong bài viết
      .lean();

    // Đảm bảo trả về các trường cần thiết cho mỗi bài viết
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
    await group.save() // Lưu nhóm sau khi cập nhật

    return true // Xoá thành công
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

  // Tìm nhóm với ID groupId
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra xem người dùng đã có trong danh sách thành viên chưa
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

  // Thêm người dùng vào danh sách thành viên với trạng thái "pending"
  group.members.listUsers.push({
    idUser: userId,
    state: 'pending',
    joinDate: new Date()
  })

  // Cập nhật lại thông tin nhóm
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

  // Tìm nhóm và xóa người dùng khỏi danh sách thành viên có trạng thái `pending`
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

const editGroupService = async ({
  groupId,
  groupName,
  introduction,
  avt,
  backGround,
  hobbies,
  rule
}) => {
  // Tìm nhóm theo ID và kiểm tra tính hợp lệ
  const group = await Group.findById(groupId);
  if (!group) {
    throw new Error('Nhóm không tồn tại.');
  }

  // Xóa ảnh cũ khỏi Google Cloud Storage và cập nhật `MyPhoto` nếu có ảnh mới
  if (avt) {
    if (group.avt) {
      const oldPhoto = await MyPhoto.findById(group.avt);
      if (oldPhoto) {
        // Xóa ảnh cũ trên Google Cloud Storage
        await cloudStorageService.deleteImageFromStorage(oldPhoto.link);
        // Đánh dấu `_destroy` trong `MyPhoto`
        await MyPhoto.findByIdAndUpdate(oldPhoto._id, { _destroy: new Date() });
      }
    }
    group.avt = avt;
  }

  if (backGround) {
    if (group.backGround) {
      const oldBackgroundPhoto = await MyPhoto.findById(group.backGround);
      if (oldBackgroundPhoto) {
        // Xóa ảnh cũ trên Google Cloud Storage
        await cloudStorageService.deleteImageFromStorage(oldBackgroundPhoto.link);
        // Đánh dấu `_destroy` trong `MyPhoto`
        await MyPhoto.findByIdAndUpdate(oldBackgroundPhoto._id, { _destroy: new Date() });
      }
    }
    group.backGround = backGround;
  }

  // Cập nhật các trường nếu có
  if (groupName) group.groupName = groupName;
  if (introduction) group.introduction = introduction;

  // Kiểm tra `hobbies` và cập nhật hoặc xóa
  if (Array.isArray(hobbies)) {
    group.hobbies = hobbies.length === 0 ? [] : hobbies;
  }

  if (rule) group.rule = rule;

  // Lưu lại nhóm sau khi cập nhật
  const updatedGroup = await group.save();
  return updatedGroup;
};


// Service xóa nhóm và các dữ liệu liên quan
const deleteGroupService = async (groupId, userId) => {
  // Tìm nhóm theo ID và kiểm tra tính hợp lệ
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra quyền của người dùng (chỉ cho phép chủ nhóm xóa nhóm)
  if (group.idAdmin.toString() !== userId) {
    throw new Error('Bạn không có quyền xóa nhóm này.')
  }

  // Xóa tất cả các bài viết liên quan đến nhóm
  await Article.deleteMany({ groupID: groupId })

  // Xóa danh sách quản trị viên và thành viên
  group.members.listUsers = [] // Xóa tất cả thành viên trong nhóm
  group.Administrators = [] // Xóa tất cả quản trị viên trong nhóm

  // Đánh dấu thời gian xóa nhóm
  group._destroy = new Date() // Đặt thời gian xóa nhóm để đánh dấu là đã xóa

  // Lưu nhóm sau khi cập nhật
  const deletedGroup = await group.save()

  return deletedGroup
}

const leaveGroupService = async (groupId, userId) => {
  // Kiểm tra tính hợp lệ của các ID
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error('ID nhóm hoặc ID người dùng không hợp lệ.')
  }

  // Tìm nhóm theo ID và kiểm tra tính tồn tại
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra xem người dùng có phải là thành viên của nhóm không
  const memberIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'accepted'
  )
  if (memberIndex === -1) {
    throw new Error('Người dùng không phải là thành viên của nhóm.')
  }

  // Tìm tất cả các bài viết của người dùng trong nhóm và cập nhật `_destroy`
  const userArticles = await Article.find({
    groupID: groupId,
    createdBy: userId,
    state: 'processed', // Chỉ lấy những bài viết có trạng thái `accepted`
    _destroy: { $exists: false }
  })

  // Cập nhật `_destroy` cho các bài viết được tìm thấy
  await Article.updateMany(
    {
      groupID: groupId,
      createdBy: userId,
      state: 'processed',
      _destroy: { $exists: false }
    },
    { _destroy: new Date() }
  )

  // Cập nhật số lượng bài viết bị xóa vào chỉ số của nhóm
  const deletedArticleCount = userArticles.length
  group.article.count -= deletedArticleCount // Giảm số lượng bài viết của nhóm tương ứng

  // Cập nhật `listArticle` để loại bỏ tất cả các bài viết của người dùng đã bị xóa khỏi `listArticle`
  group.article.listArticle = group.article.listArticle.filter(
    (article) => article.createdBy.toString() !== userId
  )

  // Xóa người dùng khỏi danh sách quản trị viên nếu có
  group.Administrators = group.Administrators.filter(
    (admin) => admin.idUser.toString() !== userId
  )

  // Xóa người dùng khỏi danh sách thành viên
  group.members.listUsers.splice(memberIndex, 1)
  group.members.count -= 1 // Giảm số lượng thành viên

  // Kiểm tra nếu số thành viên còn lại là 0, thì tự động xóa nhóm
  if (group.members.count === 0) {
    await Group.findByIdAndDelete(groupId) // Xóa nhóm nếu không còn thành viên
    return { message: `Đã rời nhóm và nhóm đã bị xóa do không còn thành viên.` }
  }

  // Lưu lại thay đổi
  await group.save()

  return {
    message: `Đã rời nhóm và xóa tất cả ${deletedArticleCount} bài viết liên quan.`
  }
}

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
      throw new Error('ID người dùng hoặc nhóm không hợp lệ')
    }
    // Lấy thông tin nhóm
    const group = await Group.findById(groupId)
    if (!group) {
      throw new Error('Nhóm không tồn tại')
    }

    // Kiểm tra nếu người mời là thành viên của nhóm
    const isMember = group.members.listUsers.some(
      (member) =>
        member.idUser.toString() === userId && member.state === 'accepted'
    )

    if (!isMember) {
      throw new Error(
        'Bạn phải là thành viên của nhóm để mời người khác tham gia'
      )
    }

    // Gửi thông báo đến từng bạn bè
    for (const friendId of invitedFriends) {
      // Kiểm tra friendId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(friendId)) {
        console.warn(`ID người dùng không hợp lệ: ${friendId}`)
        continue // Bỏ qua ID không hợp lệ
      }

      // Kiểm tra thông tin người nhận (friendId) có tồn tại không
      const receiver = await User.findById(friendId).select('_id displayName')
      if (!receiver) {
        console.warn(`Người dùng với ID ${friendId} không tồn tại.`)
        continue // Bỏ qua nếu người dùng không tồn tại
      }

      // Tạo thông báo cho bạn bè được mời
      const notificationMessage = `Bạn đã được mời tham gia nhóm ${group.groupName}`
      const notification = new Notification({
        senderId: userId,
        receiverId: receiver._id, // Đảm bảo receiverId được lấy từ thông tin người nhận
        message: notificationMessage
      })
      await notification.save()

      // Lấy thông tin người gửi để gửi thông báo real-time
      const sender = await User.findById(userId).select('displayName avt')

      // Phát sự kiện real-time
      emitEvent('new_group_invite_notification', {
        senderId: {
          _id: userId,
          displayName: sender.displayName,
          avt: sender.avt ? [sender.avt] : ['']
        },
        groupId,
        receiverId: receiver._id,
        message: `${sender.displayName} đã mời bạn tham gia nhóm ${group.groupName}`,
        createdAt: new Date()
      })
    }

    return invitedFriends
  } catch (error) {
    console.error('Lỗi khi gửi lời mời tham gia nhóm:', error)
    throw new Error('Lỗi khi gửi lời mời tham gia nhóm.')
  }
}

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

  group._destroy = null; // Set _destroy to null to unlock the group
  await group.save();

  return group;
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
  unlockGroupService
}
