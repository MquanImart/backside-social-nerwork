import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import User from '../models/User.js'

// Service tạo bài viết mới
const createArticleService = async ({
  content,
  listPhoto,
  scope,
  hashTag,
  userId
}) => {
  // Kiểm tra nếu người dùng tồn tại
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  // Tạo một đối tượng article mới với thông tin người tạo trong `createdBy`
  const newArticle = new Article({
    content,
    listPhoto, // URLs hình ảnh
    scope, // Phạm vi hiển thị: public, friends, private
    hashTag,
    interact: { emoticons: [], comment: [] },
    createdBy: userId, // Truyền _id của người tạo bài viết vào trường createdBy
    createdAt: new Date()
  })

  // Lưu bài viết vào cơ sở dữ liệu
  const savedArticle = await newArticle.save()

  // Thêm ID của bài viết vào danh sách bài viết của người dùng
  user.listArticle.push(savedArticle._id)
  await user.save()

  return savedArticle
}

// Service lấy tất cả các bài viết với bình luận
const getAllArticlesWithCommentsService = async () => {
  const articles = await Article.find()
    .populate({
      path: 'idHandler',
      select: 'firstName lastName displayName avt'
    })
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
    .populate({
      path: 'createdBy',
      select: 'firstName lastName displayName avt',
      model: 'User'
    })
    .sort({ createdAt: -1 })

  // Hàm tính tổng số bình luận và phản hồi
  const calculateTotalComments = (comments) => {
    let totalComments = comments.length // Bắt đầu từ số lượng bình luận chính
    comments.forEach((comment) => {
      if (comment.replyComment && comment.replyComment.length > 0) {
        totalComments += calculateTotalComments(comment.replyComment) // Cộng số lượng phản hồi của bình luận đó
      }
    })
    return totalComments
  }

  // Thêm thuộc tính `totalComments` cho từng bài viết
  const articlesWithCommentCount = articles.map((article) => {
    const totalComments = calculateTotalComments(article.interact.comment || [])
    return { ...article.toObject(), totalComments } // `toObject()` để chuyển đổi Mongoose Document thành plain object
  })

  return articlesWithCommentCount
}

// Service xóa bài viết
const deleteArticleService = async (articleId) => {
  await Article.findByIdAndDelete(articleId)
}

// Service thêm bình luận vào bài viết
const addCommentToArticleService = async ({
  postId,
  content,
  _iduser,
  img = []
}) => {
  // Tạo bình luận mới
  const newComment = new Comment({
    _iduser,
    content,
    img,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // Lưu bình luận vào CSDL
  const savedComment = await newComment.save()

  // Tìm bài viết và thêm bình luận vào danh sách comment
  const article = await Article.findById(postId)
  if (!article) throw new Error('Bài viết không tồn tại')

  // Thêm comment vào bài viết
  article.interact.comment.push(savedComment._id)
  article.updatedAt = new Date()

  await article.save()

  return savedComment
}

// Service thêm phản hồi vào bình luận
const addReplyToCommentService = async ({
  postId,
  commentId,
  content,
  _iduser
}) => {
  const article = await Article.findById(postId).populate({
    path: 'interact.comment',
    model: 'Comment'
  })
  if (!article) throw new Error('Bài viết không tồn tại')

  const comment = await Comment.findById(commentId)
  if (!comment) throw new Error('Bình luận không tồn tại')

  const newReply = new Comment({
    _iduser,
    content,
    img: [],
    replyComment: [],
    emoticons: [],
    createdAt: new Date()
  })

  const savedReply = await newReply.save()

  comment.replyComment.push(savedReply._id)
  await comment.save()

  return savedReply
}

const likeArticleService = async (postId, userId) => {
  const article = await Article.findById(postId)
  if (!article) {
    throw new Error('Bài viết không tồn tại')
  }

  // Kiểm tra xem người dùng đã like chưa
  const likedIndex = article.interact.emoticons.findIndex(
    (emoticon) =>
      emoticon._iduser.toString() === userId &&
      emoticon.typeEmoticons === 'like'
  )

  if (likedIndex > -1) {
    // Nếu đã like, xóa dữ liệu của userId trong danh sách emoticons
    article.interact.emoticons.splice(likedIndex, 1)
    await article.save()
    return { message: 'Đã hủy thích bài viết', article }
  } else {
    // Nếu chưa like, thêm dữ liệu mới vào danh sách emoticons
    article.interact.emoticons.push({
      _iduser: userId,
      typeEmoticons: 'like',
      createdAt: new Date()
    })
    await article.save()
    return { message: 'Đã thích bài viết', article }
  }
}

export const articleService = {
  createArticleService,
  getAllArticlesWithCommentsService,
  deleteArticleService,
  addCommentToArticleService,
  addReplyToCommentService,
  likeArticleService
}
