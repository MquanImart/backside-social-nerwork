import Group from '../models/Group.js'
import Article from '../models/Article.js'
import mongoose from 'mongoose'

const getUserGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Tìm tất cả các nhóm mà người dùng đã tham gia
  const userGroups = await Group.find({
    'members.listUsers.idUser': userId
  }).populate('idAdmin', 'firstName lastName displayName avt') // Lấy thông tin người quản trị

  return userGroups
}

// Service lấy tất cả bài viết của nhóm mà người dùng đã tham gia và bài viết đã được duyệt
const getGroupArticlesService = async (userId) => {
  // Kiểm tra ID người dùng có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Tìm các nhóm mà người dùng đã tham gia và được phê duyệt
  const userGroups = await Group.find({
    'members.listUsers.idUser': userId,
    'members.listUsers.state': 'processed'
  })

  if (!userGroups || userGroups.length === 0) {
    throw new Error('Người dùng chưa tham gia nhóm nào.')
  }

  // Lấy danh sách ID của nhóm
  const groupIds = userGroups.map((group) => group._id)

  // Lấy các bài viết thuộc các nhóm này và ở trạng thái "processed"
  const articles = await Article.find({
    groupID: { $in: groupIds },
    state: 'processed'
  })
    .populate('createdBy', 'firstName lastName displayName avt') // Thông tin người tạo bài viết
    .populate('groupID', 'groupName avt backGround') // Thông tin nhóm chứa bài viết
    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất

  return articles
}

// Service lấy danh sách các nhóm mà người dùng chưa tham gia
const getNotJoinedGroupsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  // Tìm tất cả các nhóm mà người dùng chưa tham gia
  const notJoinedGroups = await Group.find({
    'members.listUsers.idUser': { $ne: userId } // Lấy các nhóm mà không có người dùng này trong danh sách thành viên
  })

  return notJoinedGroups
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
const addAdministratorService = async (groupId, newAdminId) => {
  const group = await Group.findById(groupId)
  if (!group) {
    throw new Error('Nhóm không tồn tại.')
  }

  // Kiểm tra xem người dùng đã là quản trị viên hay chưa
  const isAdminExist = group.Administrators.find(
    (admin) => admin.idUser.toString() === newAdminId.toString()
  )
  if (isAdminExist) {
    throw new Error('Người dùng này đã là quản trị viên.')
  }

  // Thêm người dùng vào danh sách `Administrators`
  group.Administrators.push({ idUser: newAdminId })
  group.members.count += 1 // Tăng số lượng thành viên

  // Cập nhật nhóm
  const updatedGroup = await group.save()

  return updatedGroup
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

export const groupService = {
  getUserGroupsService,
  getGroupArticlesService,
  getNotJoinedGroupsService,
  createGroupService,
  addAdministratorService,
  getProcessedArticlesService,
  createArticleService,
  getPendingArticlesService,
  updateArticleStateService,
  checkUserPermission
}
