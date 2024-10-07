// controllers/groupController.js
import { groupService } from '../services/groupServices.js'

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

const getGroupArticles = async (req, res) => {
  try {
    const userId = req.params.userId

    // Gọi service để lấy danh sách bài viết của các nhóm mà người dùng đã tham gia
    const articles = await groupService.getGroupArticlesService(userId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${articles.length} bài viết`,
      articles
    })
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
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
    // Lấy thông tin nhóm từ request body
    const {
      groupName,
      type,
      idAdmin,
      introduction,
      avt,
      backGround,
      hobbies,
      rule
    } = req.body

    // Kiểm tra các thông tin cần thiết
    if (!groupName || !type || !idAdmin) {
      return res
        .status(400)
        .json({ message: 'Vui lòng điền đầy đủ thông tin cần thiết.' })
    }

    // Gọi service để tạo nhóm
    const newGroup = await groupService.createGroupService({
      groupName,
      type,
      idAdmin,
      introduction,
      avt,
      backGround,
      hobbies,
      rule
    })

    // Trả về nhóm vừa được tạo
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

// Controller để thêm một quản trị viên mới vào nhóm
const addAdministrator = async (req, res) => {
  try {
    const { groupId, newAdminId } = req.body

    if (!groupId || !newAdminId) {
      return res
        .status(400)
        .json({ message: 'Vui lòng cung cấp ID nhóm và ID quản trị viên mới.' })
    }

    // Gọi service để thêm quản trị viên mới
    const updatedGroup = await groupService.addAdministratorService(
      groupId,
      newAdminId
    )

    return res.status(200).json({
      message: 'Quản trị viên mới đã được thêm thành công!',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Lỗi khi thêm quản trị viên:', error.message)
    return res.status(500).json({
      message: 'Có lỗi xảy ra khi thêm quản trị viên.',
      error: error.message
    })
  }
}
const getProcessedArticles = async (req, res) => {
  try {
    const groupId = req.params.groupId // Lấy groupId từ URL

    // Gọi service để lấy danh sách bài viết của nhóm với trạng thái "approved"
    const articles = await groupService.getProcessedArticlesService(groupId)

    // Trả về kết quả
    return res.status(200).json({
      message: `Lấy thành công ${articles.length} bài viết đã được duyệt.`,
      articles
    })
  } catch (error) {
    console.error('Lỗi khi lấy bài viết của nhóm:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

const createGroupArticle = async (req, res) => {
  try {
    console.log('Body Request:', req.body) // Kiểm tra đầu vào của `req.body`

    const { content, userId, groupId, scope, hashTag } = req.body

    if (!content || !userId || !groupId) {
      return res.status(400).json({
        message:
          'Thiếu thông tin bài viết hoặc người tạo bài viết. Vui lòng kiểm tra lại dữ liệu đầu vào.'
      })
    }

    const images = req.files ? req.files.map((file) => file.path) : []

    const newArticle = await groupService.createArticleService({
      content,
      userId,
      groupId,
      scope,
      state: 'pending',
      hashTag,
      images
    })

    return res.status(201).json({
      message: 'Bài viết đã được tạo với trạng thái "pending"!',
      post: newArticle
    })
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message)
    return res.status(500).json({ message: 'Lỗi server', error: error.message })
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

    // Gọi service để xóa thành viên khỏi nhóm
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
    return res.status(400).json({ message: error.message }) // Trả về lỗi với mã 400
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
    const { groupId } = req.params // Nhận groupId từ params
    const userId = req.body.userId // Nhận userId từ body
    const adminId = req.body.adminId // Nhận adminId từ body

    const updatedGroup = await groupService.addAdministrator(
      groupId,
      userId,
      adminId
    )
    return res.status(200).json({
      message: 'Quản trị viên đã được thêm thành công',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Error adding administrator:', error)
    return res.status(500).json({
      message: 'Lỗi khi thêm quản trị viên',
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

export const groupController = {
  getUserGroups,
  getGroupArticles,
  createGroup,
  addAdministrator,
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
  rejectInvite
}
