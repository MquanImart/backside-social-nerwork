import express from 'express'
import { articleController } from '../../controllers/articleController.js'
import multer from 'multer'

const storage = multer.memoryStorage() // Hoặc dùng diskStorage nếu cần lưu file trên ổ cứng
const upload = multer({ storage })

// Sử dụng middleware upload cho route post

const Router = express.Router()

Router.get('/:postId', articleController.getArticleById)
Router.post('/', upload.array('images'), articleController.createArticle)
Router.get('/', articleController.getAllArticlesWithComments)
Router.delete('/:id', articleController.deleteArticle)
Router.post('/:postId/comments', articleController.addCommentToArticle)
Router.post(
  '/:postId/comments/:commentId/reply',
  articleController.addReplyToComment
)
Router.post('/:postId/like', articleController.likeArticle)
Router.post('/:postId/report', articleController.reportArticle)
Router.post('/:postId/save', articleController.saveArticle)
Router.put('/:postId/edit', articleController.editArticle)
Router.post('/:postId/comments/:commentId/like', articleController.likeComment)
Router.post(
  '/:postId/comments/:commentId/reply/:replyId/like',
  articleController.likeReplyComment
)
Router.post('/:postId/share', articleController.shareArticle)

export const articleRoute = Router
