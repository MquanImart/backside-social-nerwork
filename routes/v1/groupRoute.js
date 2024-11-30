// routes/groupRoutes.js
import express from 'express'
import { groupController } from '../../controllers/groupController.js'
import { groupMiddlewares } from '../../middlewares/groupMiddlewares.js'
import multer from 'multer'

const storage = multer.memoryStorage() // Hoặc dùng diskStorage nếu cần lưu file trên ổ cứng
const upload = multer({ storage })
const Router = express.Router()


Router.get('/all-groups', groupController.getAllGroups);


Router.post(
  '/create',
  upload.fields([
    { name: 'avt', maxCount: 1 },
    { name: 'backGround', maxCount: 1 }
  ]),
  groupController.createGroup
)

// Tạo bài viết mới
Router.post(
  '/:groupId/article',
  upload.array('images'),
  groupController.createGroupArticle
)

// Định nghĩa route lấy tất cả bài viết của nhóm mà người dùng đã tham gia
Router.get('/articles/:userId', groupController.getAllGroupArticles)
// Thêm route lấy danh sách nhóm của người dùng
Router.get('/:userId/joined-groups', groupController.getUserGroups)
Router.get('/:userId/not-joined-groups', groupController.getNotJoinedGroups)
// Lấy tất cả bài viết đã duyệt của group đó
Router.get('/:groupId/articles/processed', groupController.getProcessedArticles)
//API tạo group mới
Router.post(
  '/create',
  upload.fields([
    { name: 'avt', maxCount: 1 },
    { name: 'backGround', maxCount: 1 }
  ]),
  (req, res, next) => {
    next()
  },
  groupController.createGroup
)

// API để lấy bài viết chưa được duyệt của group
Router.get('/:groupId/pending-articles', groupController.getPendingArticles)
// API để duyệt bài viết
Router.post(
  '/:groupId/article/:articleId/processed',
  groupController.processedGroupArticle
)
// API để từ chối bài viết
Router.post(
  '/:groupId/article/:articleId/reject',
  groupController.rejectGroupArticle
)
// Route để lấy danh sách thành viên của nhóm
Router.get('/:groupId/members', groupController.getGroupMembers)
// Route để xóa thành viên khỏi nhóm
Router.delete('/:groupId/member/:memberId', groupController.removeMember)
// Route cập nhật quy định nhóm
Router.put('/:groupId/rules', groupController.updateGroupRules)
// Route add quản trị viên
Router.post('/:groupId/add-admin', groupController.addAdmin)
// Xử lí lời màn tham gia nhóm
Router.get('/:groupId/requests', groupController.getRequests)
Router.post('/:groupId/invite/accept', groupController.acceptInvite)
Router.post('/:groupId/invite/reject', groupController.rejectInvite)
// Danh sách thành viên có thể mời làm quản trị viên
Router.get('/:groupId/available-members', groupController.getAvailableMembers)
Router.post('/:groupId/cancel-invite', groupController.cancelInvite)
Router.get('/:groupId/pending-invites', groupController.getPendingInvites)
// API lấy danh sách quản trị viên đã được duyệt
Router.get(
  '/:groupId/accepted-admins',
  groupController.getAcceptedAdministrators
)
// Thêm route lấy tất cả bài viết của một người dùng trong một nhóm cụ thể
Router.get(
  '/:groupId/user/:userId/articles',
  groupController.getUserArticlesInGroup
)
//Route lấy lời mời của làm quản trị viên của group của một user cụ thể
Router.get(
  '/:groupId/user/:userId/pending-invites',
  groupController.getUserPendingInvites
)
// API chấp nhận lời mời làm quản trị viên thì cập nhật pending --> accteped
Router.post('/:groupId/invite/accept-admin', groupController.acceptAdminInvite)
// API từ chối lời mời làm quản trị viên thì cập nhật pending --> xoá khỏi danh sách
Router.post('/:groupId/invite/reject-admin', groupController.rejectAdminInvite)
// API lấy role của người dùng hiện tại
Router.get('/:groupId/role', groupController.getUserRole)
// API xoá role quản trị viên của userID
Router.post('/:groupId/remove-admin', groupController.removeAdminRole)
// API gửi yêu cầu tham gia nhóm
Router.post('/:groupId/join', groupController.sendJoinRequest)
// API thu hồi yêu cầu tham gia nhóm
Router.post('/:groupId/revoke-request', groupController.revokeRequest)
// API chỉnh nhóm
Router.patch(
  '/:groupId/edit',
  upload.fields([
    { name: 'avt', maxCount: 1 },
    { name: 'backGround', maxCount: 1 }
  ]),
  groupController.editGroup
)
//API xoá nhóm
Router.delete('/:groupId/delete', groupController.deleteGroup)
//API rời nhóm
Router.post('/:groupId/leave', groupController.leaveGroup)
// API để lấy danh sách bạn bè chưa tham gia nhóm
Router.get(
  '/friends-not-in-group/:userId/:groupId',
  groupController.getFriendsNotInGroup
)
// Gửi lời mời tham gia nhóm và gửi thông báo (group --> người dùng)
Router.post('/invite-member', groupController.inviteFriendsToGroup)
Router.post('/:groupId/lock', groupController.lockGroup);
Router.post('/:groupId/unlock', groupController.unlockGroup);
Router.get('/:groupId', groupController.getGroupDetails);


export const groupRoute = Router
