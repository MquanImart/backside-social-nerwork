import { articleService } from '../services/articleService.js'
import Article from '../models/Article.js'

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

const getAllArticlesWithComments = async (req, res) => {
  try {
    const userId = req.query.userId || req.user._id // Lấy userId từ query params hoặc từ xác thực nếu có
    if (!userId) {
      return res.status(400).json({ message: 'Thiếu userId' }) // Nếu không có userId, trả về lỗi
    }

    // Gọi service để lấy danh sách bài viết kèm bình luận
    const articles = await articleService.getAllArticlesWithCommentsService(
      userId
    )

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
// articleController.js
const likeArticle = async (req, res) => {
  try {
    const { postId } = req.params
    const { userId } = req.body

    // Kiểm tra `postId` và `userId` có hợp lệ không
    if (!postId || !userId) {
      return res.status(400).json({ message: 'Thiếu postId hoặc userId' })
    }

    // Kiểm tra nếu biến `Article` đã được import đúng
    const article = await Article.findById(postId)
    if (!article) {
      return res.status(404).json({ message: 'Bài viết không tồn tại' })
    }

    // Kiểm tra cấu trúc của emoticons
    if (!Array.isArray(article.interact.emoticons)) {
      return res.status(500).json({ message: 'Dữ liệu tương tác không hợp lệ' })
    }

    // Kiểm tra người dùng đã like chưa
    const likedIndex = article.interact.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser?.toString() === userId && // Kiểm tra null-safety cho `_iduser`
        emoticon.typeEmoticons === 'like'
    )

    if (likedIndex > -1) {
      // Nếu đã like, hủy like
      article.interact.emoticons.splice(likedIndex, 1)
    } else {
      // Nếu chưa like, thêm like
      article.interact.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like',
        createdAt: new Date()
      })
    }

    await article.save()
    return res.status(200).json(article)
  } catch (error) {
    console.error('Lỗi trong quá trình xử lý like:', error)
    return res
      .status(500)
      .json({ message: 'Đã xảy ra lỗi', error: error.message })
  }
}

export const articleController = {
  createArticle,
  getAllArticlesWithComments,
  deleteArticle,
  addCommentToArticle,
  addReplyToComment,
  likeArticle
}
