import Group from '../models/Group.js'
import Article from '../models/Article.js'
import mongoose from 'mongoose'

const getUserGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Tìm tất cả các nhóm mà người dùng đã tham gia với trạng thái `accepted`
  const userGroups = await Group.find({
    'members.listUsers': { $elemMatch: { idUser: userId, state: 'accepted' } } // Điều kiện để tìm nhóm mà người dùng có trạng thái `accepted`
  }).populate('idAdmin', 'firstName lastName displayName avt') // Lấy thông tin người quản trị

  return userGroups
}

// Service lấy tất cả bài viết từ các nhóm mà người dùng đã tham gia và được duyệt
const getAllGroupArticlesService = async (userId) => {
  try {
    // Kiểm tra ID của người dùng
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ.')
    }

    // Lấy tất cả nhóm mà người dùng đã tham gia và được chấp nhận
    const userGroups = await Group.find({
      'members.listUsers.idUser': userId,
      'members.listUsers.state': 'accepted'
    }).select('article groupName') // Chỉ lấy trường article và groupName

    if (!userGroups || userGroups.length === 0) {
      return [] // Người dùng chưa tham gia nhóm nào
    }

    // Lấy tất cả bài viết có trạng thái 'processed' trong các nhóm đã tham gia
    const processedArticles = []
    userGroups.forEach((group) => {
      // Lọc bài viết với `state: processed`
      const processedGroupArticles = group.article.listArticle
        .filter((article) => article.state === 'processed')
        .map((article) => article.idArticle)

      processedArticles.push(...processedGroupArticles)
    })

    // Kiểm tra danh sách ID bài viết đã được lọc
    if (processedArticles.length === 0) {
      return [] // Không có bài viết nào trong các nhóm đã tham gia
    }

    // Tìm tất cả bài viết theo danh sách ID đã lọc
    const articles = await Article.find({
      _id: { $in: processedArticles },
      _destroy: { $exists: false } // Chỉ lấy bài viết chưa bị xóa mềm
    })
      .populate('createdBy', 'firstName lastName displayName avt')
      .populate('groupID', 'groupName avt backGround')
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          { path: '_iduser', select: 'firstName lastName displayName avt' },
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
      .lean()

    if (!articles || articles.length === 0) {
      return [] // Không có bài viết nào trong các nhóm đã tham gia
    }

    // Hàm tính tổng số bình luận và phản hồi
    const calculateTotalComments = (comments) => {
      if (!comments) return 0
      let totalComments = comments.length
      comments.forEach((comment) => {
        if (comment.replyComment && comment.replyComment.length > 0) {
          totalComments += calculateTotalComments(comment.replyComment)
        }
      })
      return totalComments
    }

    // Thêm thông tin tính toán vào từng bài viết
    const enrichedArticles = articles.map((article) => {
      if (!article) return null

      // Tính tổng số lượt thích của bài viết
      const totalLikes = article.interact.emoticons.filter(
        (emoticon) => emoticon.typeEmoticons === 'like'
      ).length

      // Tính tổng số bình luận của bài viết
      const totalComments = calculateTotalComments(article.interact.comment)

      return {
        ...article,
        totalLikes,
        totalComments
      }
    })

    return enrichedArticles
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error)
    throw new Error('Lỗi khi lấy bài viết của nhóm.')
  }
}

// Service lấy danh sách các nhóm mà người dùng chưa tham gia
const getNotJoinedGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Lấy tất cả các nhóm mà người dùng chưa tham gia hoặc đang ở trạng thái `pending`
  const groups = await Group.find({
    $or: [
      { 'members.listUsers.idUser': { $ne: userId } }, // Nhóm mà người dùng chưa tham gia
      {
        'members.listUsers': {
          $elemMatch: { idUser: userId, state: 'pending' }
        }
      } // Nhóm có người dùng ở trạng thái `pending`
    ]
  })

  // Tạo một mảng để chứa trạng thái của người dùng trong từng nhóm
  const groupsWithUserState = groups.map((group) => {
    // Tìm trạng thái của người dùng trong nhóm (nếu có)
    const userState =
      group.members.listUsers.find(
        (member) => member.idUser.toString() === userId
      )?.state || 'not_joined'
    return { ...group.toObject(), userState } // Thêm trạng thái của người dùng vào kết quả trả về
  })

  return groupsWithUserState
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
  // Tạo đối tượng nhóm mới
  const newGroup = new Group({
    groupName,
    type,
    idAdmin, // Người sở hữu nhóm chính
    introduction,
    avt,
    backGround,
    hobbies,
    rule,
    members: {
      count: 1,
      listUsers: [{ idUser: idAdmin }] // Người tạo nhóm được thêm vào danh sách thành viên
    },
    Administrators: [] // Danh sách ban đầu trống
  })

  // Lưu nhóm vào cơ sở dữ liệu
  const savedGroup = await newGroup.save()

  return savedGroup
}

// Hàm thêm một quản trị viên mới (Administrator) vào nhóm
const addAdminService = async (groupId, adminId, currentUserId) => {
  // Kiểm tra tính hợp lệ của `groupId`, `adminId`, và `currentUserId`
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(adminId) ||
    !mongoose.Types.ObjectId.isValid(currentUserId)
  ) {
    throw new Error('ID không hợp lệ.')
  }

  // Tìm nhóm dựa trên `groupId`
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra xem người dùng hiện tại có phải là chủ nhóm (idAdmin) hay không
  if (group.idAdmin.toString() !== currentUserId.toString()) {
    throw new Error('Bạn không có quyền thêm quản trị viên cho nhóm này.')
  }

  // Kiểm tra xem `adminId` có phải là thành viên đã được chấp nhận trong nhóm không
  const isMember = group.members.listUsers.some(
    (member) =>
      member.idUser.toString() === adminId && member.state === 'accepted'
  )

  if (!isMember) {
    throw new Error('Người dùng này không phải là thành viên hợp lệ của nhóm.')
  }

  // Kiểm tra xem người này đã là quản trị viên hay chưa
  const isAlreadyAdmin = group.Administrators.some(
    (admin) => admin.idUser.toString() === adminId
  )
  if (isAlreadyAdmin) {
    throw new Error('Người dùng này đã là quản trị viên của nhóm.')
  }

  // Thêm vào danh sách `Administrators` với trạng thái 'pending'
  group.Administrators.push({
    idUser: adminId,
    state: 'pending',
    joinDate: new Date()
  })

  // Lưu lại nhóm sau khi cập nhật
  await group.save()

  return group // Trả về nhóm sau khi cập nhật
}

const getProcessedArticlesService = async (groupId) => {
  // Kiểm tra ID của nhóm có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  // Lấy dữ liệu nhóm và tìm các bài viết `processed` trong `listArticle`
  const groupData = await Group.findById(groupId).populate(
    'article.listArticle.idArticle'
  )

  // Lọc các bài viết `processed`
  const processedArticles = groupData.article.listArticle.filter(
    (articleItem) => articleItem.state === 'processed'
  )

  // Trả về dữ liệu đầy đủ của từng bài viết
  const articles = await Article.find({
    _id: { $in: processedArticles.map((item) => item.idArticle) }
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
    // Tạo đối tượng bài viết mới với thông tin đầu vào và trạng thái 'pending'
    const newArticle = new Article({
      content,
      createdBy: userId,
      groupID: groupId,
      scope,
      state: state || 'pending', // Đặt trạng thái mặc định là 'pending'
      hashTag,
      listPhoto: images,
      interact: {
        emoticons: [],
        comment: []
      }
    })

    // Lưu bài viết vào cơ sở dữ liệu
    const savedArticle = await newArticle.save()

    // Cập nhật nhóm tương ứng bằng cách thêm ID của bài viết vào danh sách `listArticle` của nhóm với trạng thái 'pending'
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
    // Tìm nhóm với ID đã cho
    const group = await Group.findById(groupId)
    if (!group) throw new Error('Nhóm không tồn tại.')

    // Lấy danh sách các ID bài viết có trạng thái 'pending'
    const pendingArticleIds = group.article.listArticle
      .filter((article) => article.state === 'pending')
      .map((article) => article.idArticle)

    // Nếu không có bài viết nào thì trả về mảng rỗng
    if (pendingArticleIds.length === 0) return []

    // Tìm tất cả các bài viết trong `Article` với ID trong `pendingArticleIds`
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
    // Tìm nhóm chứa bài viết cần cập nhật
    const group = await Group.findOneAndUpdate(
      { _id: groupId, 'article.listArticle.idArticle': articleId },
      {
        'article.listArticle.$.state': newState, // Cập nhật state của bài viết trong `listArticle`
        updatedAt: new Date() // Cập nhật thời gian `updatedAt` cho nhóm
      },
      { new: true }
    )

    if (!group) {
      throw new Error(
        'Không tìm thấy nhóm hoặc bài viết trong nhóm để cập nhật.'
      )
    }

    return group
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái bài viết:', error.message)
    throw new Error(error.message)
  }
}

// Hàm kiểm tra quyền của user trong group
const checkUserPermission = async (userId, groupId) => {
  try {
    const group = await Group.findById(groupId)
    if (!group) return false

    // Kiểm tra nếu người dùng là admin hoặc nằm trong danh sách quản trị viên
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
    .populate('members.listUsers.idUser', 'firstName lastName displayName avt') // Lấy thông tin người dùng
    .select('members') // Chỉ lấy trường members

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Lọc ra danh sách thành viên có trạng thái accepted
  const acceptedMembers = group.members.listUsers.filter(
    (member) => member.state === 'accepted'
  )

  return acceptedMembers // Trả về danh sách thành viên đã chấp nhận
}

const removeMemberService = async (groupId, memberId) => {
  if (
    !mongoose.Types.ObjectId.isValid(groupId) ||
    !mongoose.Types.ObjectId.isValid(memberId)
  ) {
    throw new Error('ID nhóm hoặc thành viên không hợp lệ.')
  }

  // Tìm nhóm và xóa thành viên khỏi danh sách
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Xóa thành viên khỏi danh sách thành viên
  group.members.listUsers = group.members.listUsers.filter(
    (member) => member.idUser.toString() !== memberId
  )
  group.members.count = group.members.listUsers.length

  // Xóa thành viên khỏi danh sách quản trị viên (nếu có)
  group.Administrators = group.Administrators.filter(
    (admin) => admin.idUser.toString() !== memberId
  )

  // Xóa tất cả các bài viết của người dùng trong nhóm
  await Article.updateMany(
    { groupID: groupId, createdBy: memberId },
    { $set: { _destroy: Date.now() } }
  )

  // Lưu nhóm sau khi cập nhật
  await group.save()

  return group
}

const updateGroupRulesService = async (groupId, rules, userId) => {
  // Tìm nhóm theo groupId
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra quyền của người dùng
  if (group.idAdmin.toString() !== userId) {
    throw new Error('Bạn không có quyền cập nhật quy định này.')
  }

  // Cập nhật quy định nhóm
  group.rule = rules // Cập nhật quy định
  await group.save()

  return group
}
// Thêm quản trị viên

const getRequestsService = async (groupId) => {
  // Kiểm tra xem groupId có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new Error('ID nhóm không hợp lệ.')
  }

  // Tìm nhóm dựa trên groupId và lấy danh sách người dùng
  const group = await Group.findById(groupId)
    .populate(
      'members.listUsers.idUser',
      'displayName email avt account.email hobbies'
    ) // Lấy thông tin người dùng
    .select('members.listUsers') // Chỉ lấy trường members

  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Lọc ra danh sách người dùng có trạng thái pending
  const requests = group.members.listUsers.filter(
    (user) => user.state === 'pending'
  )

  return requests // Trả về danh sách yêu cầu tham gia nhóm
}

// Hàm chấp nhận lời mời tham gia nhóm
const acceptInviteService = async (groupId, userId) => {
  // Kiểm tra xem userId và groupId có hợp lệ không
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(groupId)
  ) {
    throw new Error('ID không hợp lệ.')
  }

  // Tìm nhóm dựa trên groupId
  const group = await Group.findById(groupId)

  // Kiểm tra nếu không tìm thấy nhóm
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Tìm thành viên trong danh sách thành viên với trạng thái là 'pending'
  const memberIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'pending'
  )

  // Kiểm tra nếu không tìm thấy thành viên đang chờ
  if (memberIndex === -1) {
    throw new Error('Không tìm thấy lời mời cho người dùng này.')
  }

  // Cập nhật trạng thái thành viên thành 'accepted'
  group.members.listUsers[memberIndex].state = 'accepted'
  await group.save() // Lưu thay đổi

  // Trả về thông tin thành viên đã cập nhật
  return {
    message: 'Chấp nhận lời mời thành công.',
    member: group.members.listUsers[memberIndex]
  }
}

// Hàm từ chối lời mời tham gia nhóm
const rejectInviteService = async (groupId, userId) => {
  // Kiểm tra xem userId và groupId có hợp lệ không
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(groupId)
  ) {
    throw new Error('ID không hợp lệ.')
  }

  // Tìm nhóm dựa trên groupId
  const group = await Group.findById(groupId)

  // Kiểm tra nếu không tìm thấy nhóm
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra xem người dùng đã có trong danh sách lời mời chưa
  const inviteIndex = group.members.listUsers.findIndex(
    (member) =>
      member.idUser.toString() === userId && member.state === 'pending'
  )

  // Kiểm tra nếu không tìm thấy lời mời
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
  revokeRequestService
}
