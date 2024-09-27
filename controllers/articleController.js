import { articleService } from '../services/articleService.js'

// Tạo bài viết
const createArticle = async (req, res) => {
  try {
    const savedArticle = await articleService.createArticleService(req.body)
    res
      .status(201)
      .json({ message: 'Post created successfully', post: savedArticle })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Lấy danh sách bài viết kèm bình luận
const getAllArticlesWithComments = async (req, res) => {
  try {
    const articles = await articleService.getAllArticlesWithCommentsService()
    res.status(200).json(articles)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Xóa bài viết
const deleteArticle = async (req, res) => {
  try {
    await articleService.deleteArticleService(req.params.id)
    res.status(200).json({ message: 'Bài viết đã được xóa' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Thêm bình luận vào bài viết
const addCommentToArticle = async (req, res) => {
  try {
    const savedComment = await articleService.addCommentToArticleService({
      postId: req.params.postId,
      ...req.body
    })
    res.status(200).json(savedComment)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Thêm phản hồi vào bình luận
const addReplyToComment = async (req, res) => {
  try {
    const savedReply = await articleService.addReplyToCommentService({
      postId: req.params.postId,
      commentId: req.params.commentId,
      ...req.body
    })
    res.status(201).json(savedReply)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const articleController = {
  createArticle,
  getAllArticlesWithComments,
  deleteArticle,
  addCommentToArticle,
  addReplyToComment
}
