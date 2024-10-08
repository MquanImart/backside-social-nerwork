import { articleService } from '../services/articleService.js'
import Article from '../models/Article.js'
import { Storage } from '@google-cloud/storage'
import { env } from '../config/environtment.js'

const storage = new Storage({
  projectId: env.PROJECT_ID,
  keyFilename: env.KEYFILENAME
})

const bucket = storage.bucket(env.BUCKET_NAME)

// Hàm tải ảnh lên Google Cloud Storage
const uploadImageToStorage = async (file) => {
  if (!file) throw new Error('No image file provided')
  const fileName = `${Date.now()}_${file.originalname}`
  const fileUpload = bucket.file(fileName)

  return new Promise((resolve, reject) => {
    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: file.mimetype }
    })

    blobStream.on('error', (error) =>
      reject(`Error uploading to Cloud Storage: ${error}`)
    )
    blobStream.on('finish', () =>
      resolve(
        `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`
      )
    )
    blobStream.end(file.buffer)
  })
}

const getArticleById = async (req, res) => {
  try {
    const articleId = req.params.postId // Lấy ID bài viết từ params
    const article = await articleService.getArticleByIdService(articleId) // Gọi service

    if (!article) {
      return res.status(404).json({ message: 'Bài viết không tồn tại.' })
    }

    res.status(200).json(article)
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Tạo bài viết

const createArticle = async (req, res) => {
  try {
    const { content, scope, hashTag, userId } = req.body

    // Upload từng file trong `req.files` và lưu các URL
    const listPhoto = await Promise.all(
      req.files.map((file) => uploadImageToStorage(file))
    )

    const savedArticle = await articleService.createArticleService({
      content,
      listPhoto,
      scope,
      hashTag,
      userId
    })

    res
      .status(201)
      .json({ message: 'Post created successfully', post: savedArticle })
  } catch (error) {
    console.error('Error creating article:', error)
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

    if (!postId || !userId) {
      return res.status(400).json({ message: 'Thiếu postId hoặc userId' })
    }

    const article = await Article.findById(postId)
    if (!article) {
      return res.status(404).json({ message: 'Bài viết không tồn tại' })
    }

    if (!Array.isArray(article.interact.emoticons)) {
      return res.status(500).json({ message: 'Dữ liệu tương tác không hợp lệ' })
    }

    const likedIndex = article.interact.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser?.toString() === userId &&
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

const reportArticle = async (req, res) => {
  try {
    const { postId } = req.params
    const { userId, reason } = req.body

    const updatedArticle = await articleService.reportArticleService(
      postId,
      userId,
      reason
    )

    return res.status(200).json({
      message: 'Báo cáo bài viết thành công.',
      article: updatedArticle
    })
  } catch (error) {
    console.error('Lỗi khi báo cáo bài viết:', error)
    return res.status(500).json({
      message: 'Đã xảy ra lỗi khi báo cáo bài viết.',
      error: error.message
    })
  }
}

// Lưu bài viết vào bộ sưu tập 'Tất cả mục đã lưu'
const saveArticle = async (req, res) => {
  try {
    const { postId } = req.params
    const { userId } = req.body

    if (!postId || !userId) {
      return res
        .status(400)
        .json({ message: 'Thiếu thông tin postId hoặc userId' })
    }

    console.log(
      'Yêu cầu lưu bài viết với postId:',
      postId,
      'và userId:',
      userId
    )

    const updatedCollection = await articleService.saveArticleService(
      postId,
      userId
    )

    return res.status(200).json({
      message: 'Lưu bài viết thành công.',
      collection: updatedCollection
    })
  } catch (error) {
    console.error('Lỗi khi lưu bài viết:', error.message)
    return res.status(500).json({
      message: 'Đã xảy ra lỗi khi lưu bài viết.',
      error: error.message
    })
  }
}

// Hàm chỉnh sửa bài viết
const editArticle = async (req, res) => {
  try {
    const { postId } = req.params
    const { content, scope } = req.body

    const updatedArticle = await articleService.editArticleService(
      postId,
      content,
      scope
    )
    res
      .status(200)
      .json({ message: 'Chỉnh sửa bài viết thành công', post: updatedArticle })
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa bài viết:', error)
    res
      .status(500)
      .json({ message: 'Lỗi khi chỉnh sửa bài viết', error: error.message })
  }
}

// Hàm xử lý like comment
const likeComment = async (req, res) => {
  try {
    const { commentId } = req.params
    const { userId } = req.body

    if (!commentId || !userId) {
      return res.status(400).json({ message: 'Thiếu commentId hoặc userId' })
    }

    const updatedComment = await articleService.likeCommentService(
      commentId,
      userId
    )

    res.status(200).json({
      message: 'Xử lý like/unlike bình luận thành công.',
      comment: updatedComment
    })
  } catch (error) {
    res.status(500).json({
      message: 'Lỗi server khi xử lý like bình luận',
      error: error.message
    })
  }
}

// Hàm like/unlike reply comment
const likeReplyComment = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params
    const { userId } = req.body

    const updatedReply = await articleService.likeReplyCommentService(
      commentId,
      replyId,
      userId
    )

    res.status(200).json({
      message: 'Like/unlike reply comment thành công.',
      reply: updatedReply
    })
  } catch (error) {
    console.error('Lỗi khi xử lý like/unlike reply comment:', error)
    res.status(500).json({
      message: 'Lỗi khi xử lý like/unlike reply comment.',
      error: error.message
    })
  }
}

const shareArticle = async (req, res) => {
  const { postId } = req.params
  const { content, scope, userId } = req.body // Lấy nội dung, phạm vi và userId từ request body

  try {
    // Gọi service để tạo bài viết mới với sharedPostId là id của bài viết được chia sẻ
    const sharedArticle = await articleService.shareArticleService({
      postId,
      content,
      scope,
      userId
    })

    return res.status(201).json({
      message: 'Bài viết đã được chia sẻ thành công',
      post: sharedArticle
    })
  } catch (error) {
    console.error('Lỗi khi chia sẻ bài viết:', error)
    return res.status(500).json({
      message: 'Đã xảy ra lỗi khi chia sẻ bài viết',
      error: error.message
    })
  }
}
const getAllArticlesOfUser = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id // Lấy userId từ params hoặc xác thực
    if (!userId) {
      return res.status(400).json({ message: 'Thiếu userId' })
    }

    // Gọi service để lấy tất cả bài viết của người dùng
    const articles = await articleService.getAllArticlesByUserService(userId)
    res.status(200).json(articles)
  } catch (error) {
    console.error('Lỗi khi lấy tất cả bài viết của người dùng:', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

export const articleController = {
  getArticleById,
  createArticle,
  getAllArticlesWithComments,
  deleteArticle,
  addCommentToArticle,
  addReplyToComment,
  likeArticle,
  reportArticle,
  saveArticle,
  editArticle,
  likeComment,
  likeReplyComment,
  shareArticle,
  getAllArticlesOfUser
}
