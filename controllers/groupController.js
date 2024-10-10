// controllers/groupController.js
import { groupService } from '../services/groupServices.js'
import Group from '../models/Group.js'
import { cloudStorageService } from '../services/cloudStorageService.js'

const getUserGroups = async (req, res) => {
  try {
    const userId = req.params.userId

    // Gọi service để lấy danh sách nhóm mà người dùng đã tham gia
    const userGroups = await groupService.getUserGroupsService(userId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${userGroups.length} nhóm`,
      groups: userGroups
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm của người dùng:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getAllGroupArticles = async (req, res) => {
  const { userId } = req.params

  try {
    // Gọi service để lấy dữ liệu
    const articles = await groupService.getAllGroupArticlesService(userId)

    // Trả về danh sách bài viết với thông tin đã được xử lý
    res.status(200).json(articles)
  } catch (error) {
    // Xử lý lỗi và gửi thông báo lỗi cho client
    res.status(500).json({ message: error.message })
  }
}

const getNotJoinedGroups = async (req, res) => {
  try {
    const userId = req.params.userId
    const groups = await groupService.getNotJoinedGroupsService(userId)
    return res.status(200).json({ groups })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm chưa tham gia:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const createGroup = async (req, res) => {
  try {
    // Log `req.files` để kiểm tra xem tệp có được gửi lên không
    console.log('req.files:', req.files) // Log để kiểm tra xem các tệp có được truyền lên không
    console.log('req.body:', req.body) // Kiểm tra các trường khác

    const { groupName, type, idAdmin, introduction, hobbies, rule } = req.body

    // Kiểm tra các thông tin cần thiết
    if (!groupName || !type || !idAdmin) {
      return res
        .status(400)
        .json({ message: 'Vui lòng điền đầy đủ thông tin cần thiết.' })
    }

    const hobbiesArray = Array.isArray(hobbies) ? hobbies : [hobbies]
    const ruleArray = Array.isArray(rule) ? rule : [rule]

    // Kiểm tra và tải lên avatar và backGround nếu có
    let avtUrl = null
    let backGroundUrl = null

    if (req.files?.avt) {
      avtUrl = await cloudStorageService.uploadImageToStorage(req.files.avt[0])
      console.log('Uploaded avt URL:', avtUrl) // Log URL sau khi upload
    }

    if (req.files?.backGround) {
      backGroundUrl = await cloudStorageService.uploadImageToStorage(
        req.files.backGround[0]
      )
      console.log('Uploaded background URL:', backGroundUrl) // Log URL sau khi upload
    }

    // Gọi service để tạo nhóm
    const newGroup = await groupService.createGroupService({
      groupName,
      type,
      idAdmin,
      introduction,
      avt: avtUrl,
      backGround: backGroundUrl,
      hobbies: hobbiesArray,
      rule: ruleArray
    })

    console.log('New group data:', newGroup) // Log thông tin nhóm mới tạo
    return res
      .status(201)
      .json({ message: 'Nhóm được tạo thành công!', group: newGroup })
  } catch (error) {
    console.error('Lỗi khi tạo nhóm:', error.message)
    return res
      .status(500)
      .json({ message: 'Có lỗi xảy ra khi tạo nhóm.', error: error.message })
  }
}

const getProcessedArticles = async (req, res) => {
  try {
    const groupId = req.params.groupId // Lấy groupId từ URL

    // Gọi service để lấy danh sách bài viết của nhóm với trạng thái "processed" và chưa bị xóa
    const articles = await groupService.getProcessedArticlesService(groupId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${articles.length} bài viết đã được duyệt.`,
      articles
    })
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error.message)
    return res.status(500).json({
      message: 'Lỗi server khi lấy bài viết đã duyệt',
      error: error.message
    })
  }
}

const createGroupArticle = async (req, res) => {
  try {
    const { content, scope, hashTag, userId, groupId } = req.body

    // Kiểm tra các thông tin bắt buộc
    if (!content || !scope || !userId || !groupId) {
      return res
        .status(400)
        .json({ message: 'Thiếu thông tin bài viết hoặc người dùng.' })
    }

    // Xử lý upload ảnh lên Google Cloud Storage và lấy URL
    const listPhoto = req.files
      ? await Promise.all(
          req.files.map((file) =>
            cloudStorageService.uploadImageToStorage(file)
          )
        )
      : []

    console.log('URLs các ảnh đã tải lên:', listPhoto)

    // Gọi Service để tạo bài viết mới
    const savedArticle = await groupService.createArticleService({
      content,
      userId,
      groupId,
      scope,
      state: 'pending',
      hashTag,
      images: listPhoto
    })

    res.status(201).json({
      message: 'Bài viết đã được tạo với trạng thái "pending"!',
      post: savedArticle
    })
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getPendingArticles = async (req, res) => {
  try {
    const { groupId } = req.params
    const pendingArticles = await groupService.getPendingArticlesService(
      groupId
    )
    return res.status(200).json({ articles: pendingArticles })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết chờ duyệt:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Duyệt bài viết
const processedGroupArticle = async (req, res) => {
  try {
    const { groupId, articleId } = req.params
    const { userId } = req.body // Lấy userId từ body request để xác thực quyền duyệt

    // Kiểm tra quyền duyệt bài viết của user trong nhóm (ví dụ: chỉ admin hoặc moderator được duyệt)
    const hasPermission = await groupService.checkUserPermission(
      userId,
      groupId
    )
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: 'Người dùng không có quyền duyệt bài viết này.' })
    }

    // Duyệt bài viết và cập nhật trạng thái
    const approvedArticle = await groupService.updateArticleStateService(
      groupId,
      articleId,
      'processed'
    )

    return res.status(200).json({
      message: 'Bài viết đã được duyệt thành công!',
      article: approvedArticle
    })
  } catch (error) {
    console.error('Lỗi khi duyệt bài viết:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Từ chối bài viết
const rejectGroupArticle = async (req, res) => {
  try {
    const { groupId, articleId } = req.params
    const { userId } = req.body // Lấy userId từ body của request

    // Kiểm tra quyền duyệt bài viết của user trong nhóm (ví dụ: chỉ admin hoặc moderator được duyệt)
    const hasPermission = await groupService.checkUserPermission(
      userId,
      groupId
    )
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: 'Người dùng không có quyền duyệt bài viết này.' })
    }

    // Gọi service để từ chối bài viết
    const rejectedArticle = await groupService.updateArticleStateService(
      groupId,
      articleId,
      'rejected'
    )
    return res
      .status(200)
      .json({ message: 'Bài viết đã bị từ chối!', article: rejectedArticle })
  } catch (error) {
    console.error('Lỗi khi từ chối bài viết:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId

    // Gọi service để lấy danh sách thành viên của nhóm
    const members = await groupService.getGroupMembersService(groupId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${members.length} thành viên của nhóm.`,
      members
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thành viên của nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params
    const { requesterId } = req.body // Lấy ID của người yêu cầu xóa thành viên

    // Tìm thông tin nhóm
    const group = await Group.findById(groupId)
    if (!group) {
      return res.status(404).json({ message: 'Nhóm không tồn tại.' })
    }

    // Kiểm tra nếu người yêu cầu không phải là Admin hoặc Owner của nhóm
    if (
      group.idAdmin.toString() !== requesterId &&
      !group.Administrators.some(
        (admin) => admin.idUser.toString() === requesterId
      )
    ) {
      return res.status(403).json({
        message:
          'Lỗi xác thực quyền. Bạn không có quyền thực hiện hành động này.'
      })
    }

    // Kiểm tra nếu người yêu cầu là quản trị viên nhưng đang muốn xóa một quản trị viên khác (không được phép)
    if (
      group.idAdmin.toString() !== requesterId &&
      group.Administrators.some((admin) => admin.idUser.toString() === memberId)
    ) {
      return res.status(403).json({
        message: 'Quản trị viên không thể xóa các quản trị viên khác.'
      })
    }

    // Kiểm tra nếu đang xóa chính người tạo nhóm (không được phép)
    if (group.idAdmin.toString() === memberId) {
      return res.status(403).json({ message: 'Không thể xóa người tạo nhóm.' })
    }

    // Tiếp tục xóa thành viên nếu các kiểm tra quyền thành công
    const updatedGroup = await groupService.removeMemberService(
      groupId,
      memberId
    )
    return res.status(200).json({
      message: 'Thành viên đã được xóa khỏi nhóm thành công!',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Lỗi khi xóa thành viên:', error.message)
    return res.status(400).json({ message: error.message })
  }
}

// Controller để cập nhật quy định nhóm
const updateGroupRules = async (req, res) => {
  try {
    const groupId = req.params.groupId // Lấy groupId từ URL
    const { rules, userId } = req.body // Lấy danh sách quy định mới từ body request

    // Lấy userId từ req.user (đã xác thực)
    if (!userId) {
      return res.status(403).json({ message: 'Người dùng không hợp lệ.' })
    }

    // Gọi service để cập nhật quy định
    const updatedGroup = await groupService.updateGroupRulesService(
      groupId,
      rules,
      userId
    )

    return res.status(200).json({
      message: 'Cập nhật quy định nhóm thành công!',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Lỗi khi cập nhật quy định nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const addAdmin = async (req, res) => {
  try {
    const { groupId } = req.params // Lấy `groupId` từ URL params
    const { adminId, currentUserId } = req.body // Lấy `adminId` từ body request
    //const currentUserId = req.userId // Giả sử `userId` có trong `req` từ middleware xác thực

    // Gọi service để thêm quản trị viên với trạng thái `pending`
    const updatedGroup = await groupService.addAdminService(
      groupId,
      adminId,
      currentUserId
    )

    return res.status(200).json({
      message: 'Đã gửi lời mời cho người dùng để trở thành quản trị viên!',
      updatedGroup
    })
  } catch (error) {
    console.error('Error adding admin:', error.message)
    return res.status(500).json({
      message: 'Có lỗi xảy ra khi thêm quản trị viên.',
      error: error.message
    })
  }
}

const getRequests = async (req, res) => {
  try {
    const groupId = req.params.groupId // Lấy groupId từ params

    // Gọi service để lấy danh sách yêu cầu tham gia nhóm
    const requests = await groupService.getRequestsService(groupId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${requests.length} yêu cầu tham gia nhóm.`,
      requests
    })
  } catch (error) {
    console.error('Lỗi khi lấy yêu cầu tham gia nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Hàm chấp nhận lời mời tham gia nhóm
const acceptInvite = async (req, res) => {
  const { groupId } = req.params
  const { userId } = req.body // userId được truyền từ body

  try {
    const result = await groupService.acceptInviteService(groupId, userId)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi khi chấp nhận lời mời:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Hàm từ chối lời mời tham gia nhóm
const rejectInvite = async (req, res) => {
  const { groupId } = req.params
  const { userId } = req.body // userId được truyền từ body

  try {
    const result = await groupService.rejectInviteService(groupId, userId)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Lỗi khi từ chối lời mời:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getAvailableMembers = async (req, res) => {
  try {
    const { groupId } = req.params

    // Gọi service để lấy danh sách các thành viên có thể mời làm quản trị viên
    const availableMembers = await groupService.getAvailableMembersService(
      groupId
    )

    // Trả về kết quả nếu thành công
    return res.status(200).json({
      message: `Lấy thành công ${availableMembers.length} thành viên có thể mời làm quản trị viên.`,
      availableMembers
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thành viên có thể mời:', error.message)
    return res.status(500).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

const cancelInvite = async (req, res) => {
  try {
    const { groupId } = req.params
    const { userId, currentUserId } = req.body

    const group = await groupService.cancelInviteService(
      groupId,
      userId,
      currentUserId
    )
    return res
      .status(200)
      .json({ message: 'Đã hủy lời mời thành công.', group })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

// Controller lấy danh sách lời mời đang chờ xác nhận
const getPendingInvites = async (req, res) => {
  try {
    const { groupId } = req.params

    const pendingInvites = await groupService.getPendingInvitesService(groupId)
    return res.status(200).json({
      message: `Lấy thành công ${pendingInvites.length} lời mời đang chờ.`,
      pendingInvites
    })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

const getAcceptedAdministrators = async (req, res) => {
  const { groupId } = req.params

  try {
    // Gọi service để lấy danh sách quản trị viên đã được chấp nhận
    const acceptedAdministrators =
      await groupService.getAcceptedAdministratorsService(groupId)
    res.status(200).json({
      message: `Lấy thành công ${acceptedAdministrators.length} quản trị viên.`,
      acceptedAdministrators
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

const getUserArticlesInGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.params

    // Gọi service để lấy tất cả các bài viết của người dùng trong nhóm cụ thể
    const articles = await groupService.getUserArticlesInGroupService(
      groupId,
      userId
    )

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${articles.length} bài viết của người dùng trong nhóm.`,
      articles
    })
  } catch (error) {
    console.error(
      'Lỗi khi lấy bài viết của người dùng trong nhóm:',
      error.message
    )
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getUserPendingInvites = async (req, res) => {
  try {
    const { groupId, userId } = req.params // Lấy groupId và userId từ params
    // Kiểm tra tính hợp lệ của các ID
    if (!groupId || !userId) {
      return res.status(400).json({ message: 'Thiếu groupId hoặc userId' })
    }

    // Gọi service để lấy danh sách lời mời quản trị viên của người dùng trong nhóm
    const pendingInvites = await groupService.getUserPendingInvitesService(
      groupId,
      userId
    )

    // Trả về kết quả nếu thành công
    return res.status(200).json({
      message: `Lấy thành công ${pendingInvites.length} lời mời làm quản trị viên.`,
      pendingInvites
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lời mời:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const acceptAdminInvite = async (req, res) => {
  try {
    const { groupId } = req.params
    const { userId } = req.body

    if (!groupId || !userId) {
      return res
        .status(400)
        .json({ message: 'Thiếu thông tin groupId hoặc userId.' })
    }

    // Gọi service để cập nhật trạng thái lời mời thành 'accepted'
    const updatedGroup = await groupService.acceptAdminInviteService(
      groupId,
      userId
    )

    return res.status(200).json({
      message: 'Lời mời quản trị viên đã được chấp nhận thành công.',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Lỗi khi chấp nhận lời mời quản trị viên:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const rejectAdminInvite = async (req, res) => {
  try {
    const { groupId } = req.params
    const { userId } = req.body

    if (!groupId || !userId) {
      return res
        .status(400)
        .json({ message: 'Thiếu thông tin groupId hoặc userId.' })
    }

    // Gọi service để xóa lời mời khỏi danh sách admin nếu đang ở trạng thái pending
    const updatedGroup = await groupService.rejectAdminInviteService(
      groupId,
      userId
    )

    return res.status(200).json({
      message:
        'Lời mời quản trị viên đã bị từ chối và xóa khỏi danh sách thành công.',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Lỗi khi từ chối lời mời quản trị viên:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const getUserRole = async (req, res) => {
  try {
    const { groupId } = req.params
    const { userId } = req.query

    if (!groupId || !userId) {
      return res.status(400).json({ message: 'Thiếu groupId hoặc userId.' })
    }

    // Gọi service để lấy vai trò của người dùng
    const role = await groupService.getUserRoleService(groupId, userId)

    return res.status(200).json({ role })
  } catch (error) {
    console.error('Lỗi khi lấy vai trò người dùng:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const removeAdminRole = async (req, res) => {
  try {
    const { groupId } = req.params // Lấy groupId từ URL params
    const { userId } = req.body // Lấy userId từ body request

    // Kiểm tra đầu vào
    if (!groupId || !userId) {
      return res
        .status(400)
        .json({ message: 'Thiếu thông tin groupId hoặc userId.' })
    }

    // Gọi service để chuyển quyền quản trị viên sang thành viên
    const result = await groupService.removeAdminRoleService(groupId, userId)

    if (result) {
      return res.status(200).json({
        message:
          'Người dùng đã rời khỏi vai trò quản trị viên và trở thành thành viên.'
      })
    } else {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy quản trị viên này trong nhóm.' })
    }
  } catch (error) {
    console.error(
      'Lỗi khi chuyển quyền từ quản trị viên thành viên:',
      error.message
    )
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
const sendJoinRequest = async (req, res) => {
  try {
    const { groupId } = req.params
    const { userId } = req.body

    // Kiểm tra dữ liệu đầu vào
    if (!groupId || !userId) {
      return res.status(400).json({ message: 'Thiếu groupId hoặc userId' })
    }

    // Gọi service để thực hiện yêu cầu tham gia nhóm
    const result = await groupService.sendJoinRequestService(groupId, userId)

    return res.status(200).json({
      message: 'Yêu cầu tham gia nhóm đã được gửi thành công!',
      result
    })
  } catch (error) {
    console.error('Lỗi khi gửi yêu cầu tham gia nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const revokeRequest = async (req, res) => {
  try {
    const { groupId } = req.params // Lấy ID của nhóm
    const { userId } = req.body // Lấy userId từ body request

    // Gọi service để hủy yêu cầu tham gia nhóm
    const result = await groupService.revokeRequestService(groupId, userId)

    // Trả về thông báo thành công
    return res
      .status(200)
      .json({ message: 'Yêu cầu tham gia nhóm đã được thu hồi.' })
  } catch (error) {
    console.error('Lỗi khi thu hồi yêu cầu tham gia nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const editGroup = async (req, res) => {
  try {
    const { groupId } = req.params
    const { groupName, introduction, hobbies, rule, userId } = req.body

    // Tìm nhóm theo ID để kiểm tra quyền của người dùng
    const group = await Group.findById(groupId)
    if (!group) {
      return res.status(404).json({ message: 'Nhóm không tồn tại.' })
    }

    // Kiểm tra xem userId có phải là chủ nhóm không
    if (group.idAdmin.toString() !== userId) {
      return res.status(403).json({
        message:
          'Bạn không có quyền chỉnh sửa nhóm này vì bạn không phải là chủ nhóm.'
      })
    }

    // Kiểm tra và cập nhật ảnh đại diện và ảnh nền nếu có
    let avtUrl = group.avt
    let backGroundUrl = group.backGround
    if (req.files?.avt) {
      avtUrl = await cloudStorageService.uploadImageToStorage(req.files.avt[0])
    }
    if (req.files?.backGround) {
      backGroundUrl = await cloudStorageService.uploadImageToStorage(
        req.files.backGround[0]
      )
    }

    // Gọi hàm service để cập nhật nhóm
    const updatedGroup = await groupService.editGroupService({
      groupId,
      groupName,
      introduction,
      avt: avtUrl,
      backGround: backGroundUrl,
      hobbies: hobbies ? JSON.parse(hobbies) : [], // Kiểm tra hobbies và chuyển thành mảng rỗng nếu không có
      rule
    })

    return res
      .status(200)
      .json({ message: 'Cập nhật nhóm thành công!', group: updatedGroup })
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa nhóm:', error.message)
    return res.status(500).json({
      message: 'Có lỗi xảy ra khi chỉnh sửa nhóm.',
      error: error.message
    })
  }
}

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params // Lấy `groupId` từ params
    const { userId } = req.query // Lấy `userId` từ query params

    // Gọi service để xóa nhóm và tất cả dữ liệu liên quan
    const result = await groupService.deleteGroupService(groupId, userId)

    // Trả về thông báo thành công cùng dữ liệu nhóm đã xóa
    return res
      .status(200)
      .json({ message: 'Nhóm đã được xóa thành công!', group: result })
  } catch (error) {
    console.error('Lỗi khi xóa nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params // Lấy ID của nhóm từ params
    const { userId } = req.body // Lấy userId từ body request

    // Gọi service để rời nhóm
    const result = await groupService.leaveGroupService(groupId, userId)

    return res.status(200).json({
      message: 'Rời nhóm thành công và xóa tất cả dữ liệu liên quan.',
      result
    })
  } catch (error) {
    console.error('Lỗi khi rời nhóm:', error.message)
    return res
      .status(500)
      .json({ message: 'Có lỗi xảy ra khi rời nhóm.', error: error.message })
  }
}

export const groupController = {
  getUserGroups,
  getAllGroupArticles,
  createGroup,
  getNotJoinedGroups,
  getProcessedArticles,
  createGroupArticle,
  getPendingArticles,
  processedGroupArticle,
  rejectGroupArticle,
  getGroupMembers,
  removeMember,
  updateGroupRules,
  addAdmin,
  getRequests,
  acceptInvite,
  rejectInvite,
  getAvailableMembers,
  cancelInvite,
  getPendingInvites,
  getAcceptedAdministrators,
  getUserArticlesInGroup,
  getUserPendingInvites,
  acceptAdminInvite,
  rejectAdminInvite,
  getUserRole,
  removeAdminRole,
  sendJoinRequest,
  revokeRequest,
  editGroup,
  deleteGroup,
  leaveGroup
}
