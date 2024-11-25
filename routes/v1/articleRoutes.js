import express from 'express'
import { articleController } from '../../controllers/articleController.js'
import multer from 'multer'

const storage = multer.memoryStorage() // Hoặc dùng diskStorage nếu cần lưu file trên ổ cứng
const upload = multer({ storage })


const Router = express.Router()

Router.get('/all', articleController.getAllArticlesWithCommentsSystemWide);
//API lấy tất cả thông tin của một bài viết
Router.get('/:postId', articleController.getArticleById)
//  API tạo bài viết ở new-feed và ở phần profile
Router.post('/', upload.array('images'), articleController.createArticle)
// API lấy tất cả bài viết của bạn bè trạng thái public và bạn bè, của group người đó tham gia (trạng thái đã duyệt), và bản thân người đó
Router.get('/', articleController.getAllArticlesWithComments)
// API xoá một bài viết với id
Router.delete('/:id', articleController.deleteArticle)
// API thêm comment (chưa có phần thông báo)
Router.post('/:postId/comments', articleController.addCommentToArticle)
// API thêm reply commnent (chưa có phần thông báo)
Router.post(
  '/:postId/comments/:commentId/reply',
  articleController.addReplyToComment
)
// API like bài viết (chưa có phần thông báo)
Router.post('/:postId/like', articleController.likeArticle)
// API report bài viết (chưa có phần thông báo)
Router.post('/:postId/report', articleController.reportArticle)
// API lưu bài viết vào 'Đã lưu'
Router.post('/:postId/save', articleController.saveArticle)
// API sửa bài chỉnh sửa bài viết (tạm thời thì chưa chỉnh sủa lại trường hợp trong group)
Router.put('/:postId/edit', articleController.editArticle)
// API like phần comment (tạm thời thì chưa có phần thông báo khi like comment)
Router.post('/:postId/comments/:commentId/like', articleController.likeComment)
// API like phần reply comment (tạm thời thì chưa có phần thông báo khi like replycomment)
Router.post(
  '/:postId/comments/:commentId/reply/:replyId/like',
  articleController.likeReplyComment
)
// API chia sẻ bài viết
Router.post('/:postId/share', articleController.shareArticle)
// API lấy tất cả bài viết của người dùng đó tạo
Router.get('/user/:userId/articles', articleController.getAllArticlesOfUser)

Router.post('/approve/:reportId', articleController.approveReport);
Router.post('/reject/:reportId', articleController.rejectReport);


export const articleRoute = Router
