import Group from '../models/Group.js'
import Article from '../models/Article.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import mongoose from 'mongoose'
import { emitEvent } from '../sockets/socket.js'

const getUserGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  const userGroups = await Group.find({
    'members.listUsers': { $elemMatch: { idUser: userId, state: 'accepted' } }
  }).populate('idAdmin', 'firstName lastName displayName avt')

  return userGroups
}

// Service lấy tất cả bài viết từ các nhóm mà người dùng đã tham gia và được duyệt
const getAllGroupArticlesService = async (userId) => {
  try {
    // Kiểm tra nếu userId không hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.')
    }

    // Tìm các nhóm mà người dùng đã được chấp nhận tham gia
    const userGroups = await Group.find({
      'members.listUsers': {
        $elemMatch: {
          idUser: userId,
          state: 'accepted' // Chỉ lấy nhóm người dùng đã được chấp nhận
        }
      }
    }).select('article groupName')

    console.log('userGroups', userGroups)

    // Nếu người dùng không thuộc nhóm nào, trả về mảng rỗng
    if (!userGroups || userGroups.length === 0) {
      return []
    }

    // Lọc bài viết đã được xử lý (state === 'processed') từ các nhóm của người dùng
    const processedArticles = userGroups.reduce((acc, group) => {
      const groupArticles = group.article.listArticle
        .filter((article) => article.state === 'processed') // Lọc bài viết đã được xử lý
        .map((article) => article.idArticle)
      return acc.concat(groupArticles)
    }, [])

    console.log('Processed Articles:', processedArticles)

    // Nếu không có bài viết nào được xử lý, trả về mảng rỗng
    if (processedArticles.length === 0) {
      return []
    }

    // Tìm các bài viết dựa trên danh sách ID của các bài đã được xử lý
    const articles = await Article.find({
      _id: { $in: processedArticles }, // Chỉ tìm các bài viết có trong danh sách đã lọc
      _destroy: { $exists: false } // Lọc các bài viết chưa bị xóa
    })
      .populate('createdBy', 'firstName lastName displayName avt') // Lấy thông tin người tạo bài viết
      .populate('groupID', 'groupName avt backGround') // Lấy thông tin về nhóm của bài viết
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          { path: '_iduser', select: 'firstName lastName displayName avt' }, // Lấy thông tin người bình luận
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt'
            }
          }
        ]
      })
      .lean() // Chuyển đổi kết quả thành đối tượng JavaScript thông thường để dễ dàng xử lý

    // Nếu không có bài viết nào được tìm thấy, trả về mảng rỗng
    if (!articles || articles.length === 0) {
      return []
    }

    // Tính toán và trả về bài viết với thông tin bổ sung về lượt thích và bình luận
    const enrichedArticles = articles.map((article) => ({
      ...article,
      totalLikes: article.totalLikes || 0, // Đảm bảo totalLikes không undefined
      totalComments: article.totalComments || 0 // Đảm bảo totalComments không undefined
    }))

    return enrichedArticles
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error)
    throw new Error('Lỗi khi lấy bài viết của nhóm.')
  }
}

// Service lấy danh sách các nhóm mà người dùng chưa tham gia
const getNotJoinedGroupsService = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.')
    }

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
    }).lean()

    const groupsWithUserState = groups.map((group) => {
      const userState =
        group.members.listUsers.find(
          (member) => member.idUser.toString() === userId
        )?.state || 'not_joined'

      return { ...group, userState }
    })

    return groupsWithUserState
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm chưa tham gia:', error)
    throw new Error('Không thể lấy danh sách nhóm chưa tham gia.')
  }
}

// Hàm tạo nhóm mới
const createGroupService = async ({
  groupName,
  type,
  idAdmin,
  introduction,
  avt,
  backGround,
  hobbies,
  rule
}) => {
  const newGroup = new Group({
    groupName,
    type,
    idAdmin,
    introduction,
    avt,
    backGround,
    hobbies,
    rule,
    members: {
      count: 1,
      listUsers: [
        {
          idUser: idAdmin,
          state: 'accepted'
        }
      ]
    },
    Administrators: []
  })

  const savedGroup = await newGroup.save()

  return savedGroup
}

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

const getProcessedArticlesService = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  const groupData = await Group.findById(groupId).populate(
    'article.listArticle.idArticle'
  )

  const processedArticles = groupData.article.listArticle.filter(
    (articleItem) =>
      articleItem.state === 'processed' && !articleItem.idArticle._destroy
  )

  const articles = await Article.find({
    _id: { $in: processedArticles.map((item) => item.idArticle) },
    _destroy: { $exists: false }
  })
    .populate('createdBy', 'firstName lastName displayName avt')
    .sort({ createdAt: -1 })

  return articles
}

const createArticleService = async ({
  content,
  userId,
  groupId,
  scope,
  state,
  hashTag,
  images
}) => {
  try {
    const newArticle = new Article({
      content,
      createdBy: userId,
      groupID: groupId,
      scope,
      state: state || 'pending',
      hashTag,
      listPhoto: images,
      interact: {
        emoticons: [],
        comment: []
      }
    })

    const savedArticle = await newArticle.save()

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
    )

    if (!updatedGroup) {
      throw new Error('Không tìm thấy nhóm để cập nhật bài viết.')
    }

    return savedArticle
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message)
    throw new Error(error.message)
  }
}

const getPendingArticlesService = async (groupId) => {
  try {
    const group = await Group.findById(groupId)
    if (!group) throw new Error('Nhóm không tồn tại.')

    const pendingArticleIds = group.article.listArticle
      .filter((article) => article.state === 'pending')
      .map((article) => article.idArticle)

    if (pendingArticleIds.length === 0) return []

    const pendingArticles = await Article.find({
      _id: { $in: pendingArticleIds }
    })
      .populate('createdBy', 'firstName lastName avt displayName')
      .sort({ createdAt: -1 })

    return pendingArticles
  } catch (error) {
    console.error('Lỗi khi lấy bài viết pending:', error.message)
    throw new Error(error.message)
  }
}

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
    throw new Error('ID nhóm không hợp lệ.')
  }

  // Tìm nhóm dựa trên groupId
  const group = await Group.findById(groupId)
    .populate('members.listUsers.idUser', 'firstName lastName displayName avt')
    .select('members')

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const acceptedMembers = group.members.listUsers.filter(
    (member) => member.state === 'accepted'
  )

  return acceptedMembers
}

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
// Thêm quản trị viên
const getRequestsService = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  const group = await Group.findById(groupId)
    .populate(
      'members.listUsers.idUser',
      'displayName email avt account.email hobbies'
    )
    .select('members.listUsers')

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const requests = group.members.listUsers.filter(
    (user) => user.state === 'pending'
  )

  return requests
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
  // Kiểm tra tính hợp lệ của groupId
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  // Tìm nhóm và chuyển đổi dữ liệu
  const group = await Group.findById(groupId)
    .populate('members.listUsers.idUser', 'displayName avt')
    .lean()
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Lọc danh sách thành viên đã được chấp nhận (state: 'accepted') và không phải là idAdmin hoặc Administrators
  const availableMembers = group.members.listUsers.filter(
    (member) =>
      member.state === 'accepted' &&
      member.idUser._id.toString() !== group.idAdmin.toString() && // Loại trừ idAdmin
      !group.Administrators.some(
        (admin) => admin.idUser.toString() === member.idUser._id.toString()
      ) // Loại trừ các admin hiện tại
  )

  // Chuyển đổi dữ liệu thành định dạng mong muốn
  return availableMembers.map((member) => ({
    idUser: member.idUser._id.toString(), // Chuyển đổi ObjectId thành chuỗi
    displayName: member.idUser.displayName,
    avt: member.idUser.avt || [],
    joinDate: new Date(member.joinDate).toISOString() // Chuyển đổi Date thành ISO String
  }))
}
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
  const group = await Group.findById(groupId).populate(
    'Administrators.idUser',
    'displayName avt'
  )
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  const pendingInvites = group.Administrators.filter(
    (admin) => admin.state === 'pending'
  )
  return pendingInvites
}

const getAcceptedAdministratorsService = async (groupId) => {
  // Tìm nhóm theo `groupId`
  const group = await Group.findById(groupId).populate({
    path: 'Administrators.idUser',
    select: 'displayName avt'
  })

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Lọc ra các quản trị viên có trạng thái đã được chấp nhận
  const acceptedAdministrators = group.Administrators.filter(
    (admin) => admin.state === 'accepted'
  )

  return acceptedAdministrators
}

const getUserArticlesInGroupService = async (groupId, userId) => {
  // Kiểm tra tính hợp lệ của `groupId` và `userId`
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Tìm các bài viết của người dùng trong nhóm cụ thể
  const articles = await Article.find({
    groupID: groupId,
    createdBy: userId // Chỉ lấy bài viết của người dùng cụ thể trong nhóm đã chỉ định
  })
    .populate('createdBy', 'firstName lastName displayName avt') // Lấy thông tin người tạo bài viết
    .populate('groupID', 'groupName avt backGround') // Lấy thông tin nhóm
    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất

  return articles
}

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
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Cập nhật các trường nếu có
  if (groupName) group.groupName = groupName
  if (introduction) group.introduction = introduction
  if (avt) group.avt = avt
  if (backGround) group.backGround = backGround

  // Kiểm tra `hobbies` và cập nhật hoặc xóa
  if (Array.isArray(hobbies)) {
    if (hobbies.length === 0) {
      group.hobbies = [] // Đặt thành mảng rỗng để xóa tất cả
    } else {
      group.hobbies = hobbies // Nếu có phần tử, cập nhật `hobbies`
    }
  }

  if (rule) group.rule = rule

  // Lưu lại nhóm sau khi cập nhật
  const updatedGroup = await group.save()
  return updatedGroup
}

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
      throw new Error('ID người dùng hoặc ID nhóm không hợp lệ.')
    }

    // Lấy thông tin bạn bè của người dùng
    const user = await User.findById(userId).populate(
      'friends.idUser',
      'firstName lastName displayName avt'
    )
    if (!user) {
      throw new Error('Người dùng không tồn tại.')
    }

    // Lấy danh sách thành viên của nhóm
    const group = await Group.findById(groupId).select('members.listUsers')
    if (!group) {
      throw new Error('Nhóm không tồn tại.')
    }

    // Kiểm tra xem danh sách bạn bè có tồn tại hay không
    if (!user.friends || user.friends.length === 0) {
      throw new Error('Người dùng không có bạn bè.')
    }

    // Lọc danh sách bạn bè chưa tham gia nhóm
    const groupMemberIds = group.members.listUsers.map((member) =>
      member.idUser.toString()
    )

    const friendsNotInGroup = user.friends
      .filter(
        (friend) =>
          friend.idUser &&
          !groupMemberIds.includes(friend.idUser._id.toString())
      )
      .map((friend) => ({
        _id: friend.idUser._id,
        displayName: friend.idUser.displayName,
        avt: friend.idUser.avt || ''
      }))

    return friendsNotInGroup
  } catch (error) {
    console.error(
      'Lỗi khi lấy danh sách bạn bè chưa tham gia nhóm:',
      error.message || error
    )
    throw new Error('Lỗi khi lấy danh sách bạn bè chưa tham gia nhóm.')
  }
}
const inviteFriendsToGroupService = async (userId, groupId, invitedFriends) => {
  try {
    // Kiểm tra ID hợp lệ
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {
      throw new Error('ID người dùng hoặc nhóm không hợp lệ')
    }
    console.log('userId', userId)
    console.log('Bạn bè', invitedFriends)
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
  inviteFriendsToGroupService
}
