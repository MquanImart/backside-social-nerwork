import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import User from '../models/User.js'
import Group from '../models/Group.js'
import mongoose from 'mongoose'

const getArticleByIdService = async (articleId) => {
  try {
    // Kiểm tra `articleId` có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ. ID phải có 24 ký tự hợp lệ.')
    }

    // Tìm bài viết trong cơ sở dữ liệu
    const article = await Article.findById(articleId)
      .populate('createdBy', 'firstName lastName displayName avt') // Nếu bạn có field createdBy
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
      .exec()

    if (!article) throw new Error('Bài viết không tồn tại.')

    // Tính tổng số lượt thích của bài viết
    const totalLikes = article.interact.emoticons.filter(
      (emoticon) => emoticon.typeEmoticons === 'like'
    ).length

    // Hàm tính tổng số bình luận và phản hồi
    const calculateTotalComments = (comments) => {
      if (!comments) return 0
      let totalComments = comments.length
      comments.forEach((comment) => {
        if (comment.replyComment && comment.replyComment.length > 0) {
          totalComments += calculateTotalComments(comment.replyComment)
        }
      })
      return totalComments
    }

    // Tính tổng số bình luận của bài viết
    const totalComments = calculateTotalComments(article.interact.comment)

    // Trả về bài viết cùng với tổng số lượt thích và tổng số bình luận
    return {
      ...article.toObject(),
      totalLikes,
      totalComments
    }
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error.message)
    throw new Error('Lỗi khi lấy bài viết.')
  }
}

// Service tạo bài viết mới
const createArticleService = async ({
  content,
  listPhoto,
  scope,
  hashTag,
  userId
}) => {
  try {
    console.log('Dữ liệu nhận được từ client:', {
      content,
      listPhoto,
      scope,
      hashTag,
      userId
    })

    // Kiểm tra nếu người dùng tồn tại
    const user = await User.findById(userId)
    if (!user) {
      throw new Error('Người dùng không tồn tại')
    }

    // Tạo một đối tượng `Article` mới với thông tin người tạo trong `createdBy`
    const newArticle = new Article({
      content, // Nội dung bài viết
      listPhoto, // URLs hình ảnh được tải lên
      scope, // Phạm vi hiển thị: public, friends, private
      hashTag, // Danh sách các hashtag liên quan
      interact: { emoticons: [], comment: [] }, // Khởi tạo các trường tương tác rỗng
      createdBy: userId, // ID người tạo bài viết
      createdAt: new Date() // Thời gian tạo bài viết
    })

    // Lưu bài viết mới vào cơ sở dữ liệu
    const savedArticle = await newArticle.save()

    // Thêm ID bài viết vào danh sách `listArticle` của người dùng
    user.listArticle.push(savedArticle._id)
    await user.save()

    // Trả về đối tượng bài viết đầy đủ kèm thông tin người tạo
    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        displayName: user.displayName || `${user.firstName} ${user.lastName}` // Sử dụng `displayName` nếu có, ngược lại ghép `firstName` + `lastName`
      }
    }
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message)
    throw new Error(`Lỗi khi tạo bài viết: ${error.message}`)
  }
}

const getAllArticlesWithCommentsService = async (userId) => {
  try {
    // Kiểm tra `userId` có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
    }

    // Chuyển đổi `userId` sang ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId)

    // Lấy thông tin người dùng và danh sách bạn bè
    const user = await User.findById(userObjectId).populate({
      path: 'friends',
      populate: { path: 'idUser', select: '_id' }
    })

    if (!user) throw new Error('Người dùng không tồn tại')

    console.log('Danh sách bạn bè:', user.friends)

    // Lấy danh sách ID của bạn bè và kiểm tra định dạng
    const friendIds = user.friends
      ? user.friends.map((friend) => {
          if (friend && friend.idUser && friend.idUser._id) {
            const friendId = friend.idUser._id.toString()
            if (mongoose.Types.ObjectId.isValid(friendId)) {
              return new mongoose.Types.ObjectId(friendId) // Chuyển đổi `friendId` thành ObjectId
            }
            console.warn(`ID bạn bè không hợp lệ: ${friendId}`)
          }
          return null
        })
      : []

    console.log('Danh sách ID bạn bè:', friendIds)

    if (friendIds.length === 0) {
      console.log('Danh sách bạn bè rỗng, không có bài viết để hiển thị.')
      return []
    }

    // Lấy tất cả nhóm mà người dùng đã tham gia
    const groups = await Group.find({
      'members.listUsers.idUser': userObjectId,
      'members.listUsers.state': 'processed'
    })

    console.log('Danh sách nhóm đã tham gia:', groups)

    // Lấy danh sách ID của nhóm
    const groupIds = groups.map((group) => group._id)

    console.log('Danh sách ID nhóm đã tham gia:', groupIds)

    // Tìm các bài viết từ bạn bè, nhóm đã tham gia và của bản thân người dùng
    const articles = await Article.find({
      $and: [
        { _destroy: { $exists: false } }, // Thêm điều kiện lọc bài viết chưa bị xóa mềm
        {
          $or: [
            // Điều kiện 1: Bài viết của bạn bè với chế độ hiển thị là `public` hoặc `friends`
            {
              createdBy: { $in: friendIds },
              scope: { $in: ['public', 'friends'] }
            },
            // Điều kiện 2: Bài viết thuộc nhóm mà người dùng đã tham gia và đã được duyệt
            {
              groupID: { $in: groupIds },
              state: 'processed'
            },
            // Điều kiện 3: Bài viết của chính bản thân người dùng
            {
              createdBy: userObjectId
            }
          ]
        }
      ]
    })
      .populate({
        path: 'createdBy',
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
        path: 'groupID',
        select: 'groupName avt backGround'
      })
      .sort({ createdAt: -1 })

    console.log('Bài viết tìm được:', articles)

    if (!articles || articles.length === 0) {
      console.log(
        'Không có bài viết nào được tìm thấy với các điều kiện hiện tại.'
      )
      return []
    }

    // Hàm tính tổng số bình luận và phản hồi
    const calculateTotalComments = (comments) => {
      if (!comments) return 0
      let totalComments = comments.length
      comments.forEach((comment) => {
        if (comment.replyComment && comment.replyComment.length > 0) {
          totalComments += calculateTotalComments(comment.replyComment)
        }
      })
      return totalComments
    }

    // Thêm thuộc tính `totalComments` cho từng bài viết
    const articlesWithCommentCount = articles.map((article) => {
      if (!article) return null
      const totalComments = calculateTotalComments(
        article.interact.comment || []
      )
      return { ...article.toObject(), totalComments }
    })

    return articlesWithCommentCount
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error.message)
    throw new Error('Lỗi khi lấy bài viết.')
  }
}

// Service xóa bài viết
const deleteArticleService = async (articleId) => {
  try {
    // Kiểm tra ID của bài viết có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ.')
    }

    // Tìm bài viết cần xóa
    const article = await Article.findById(articleId)
    if (!article) {
      throw new Error('Bài viết không tồn tại.')
    }

    // Xóa các bình luận liên quan đến bài viết này
    await Comment.deleteMany({ _id: { $in: article.interact.comment } })

    // Cập nhật trường `_destroy` cho bài viết thay vì xóa thẳng
    article._destroy = new Date()
    await article.save()

    // Xóa bài viết khỏi `listArticle` của người dùng
    await User.findByIdAndUpdate(
      article.createdBy,
      { $pull: { listArticle: articleId } },
      { new: true }
    )

    return {
      message: 'Đánh dấu xóa bài viết và các bình luận liên quan thành công.'
    }
  } catch (error) {
    throw new Error(`Lỗi khi xóa bài viết: ${error.message}`)
  }
}

// Service thêm bình luận vào bài viết
const addCommentToArticleService = async ({
  postId,
  content,
  _iduser,
  img = []
}) => {
  // Tìm thông tin người dùng để lấy `displayName`
  const user = await User.findById(_iduser).select('displayName avt') // Chỉ lấy `displayName` và `avt`
  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }

  // Tạo bình luận mới với thông tin người dùng
  const newComment = new Comment({
    _iduser,
    content,
    img,
    displayName: user.displayName, // Thêm `displayName` vào comment
    userAvatar: user.avt, // Thêm `userAvatar` vào comment nếu cần
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // Lưu bình luận vào CSDL
  const savedComment = await newComment.save()

  // Tìm bài viết và thêm bình luận vào danh sách comment
  const article = await Article.findById(postId).populate('interact.comment')
  if (!article) throw new Error('Bài viết không tồn tại')

  // Thêm comment vào bài viết
  article.interact.comment.push(savedComment._id)
  article.updatedAt = new Date()

  // Lưu bài viết đã cập nhật
  await article.save()

  // Trả về comment đã lưu kèm thông tin `displayName` và `avt` của user
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

const reportArticleService = async (postId, userId, reason) => {
  const article = await Article.findById(postId)
  if (!article) throw new Error('Bài viết không tồn tại.')

  // Kiểm tra nếu người dùng đã báo cáo bài viết này trước đó
  const existingReport = article.reports.find(
    (report) => report._idReporter.toString() === userId.toString()
  )

  if (existingReport) {
    throw new Error('Bạn đã báo cáo bài viết này trước đó.')
  }

  // Thêm báo cáo mới vào mảng `reports`
  article.reports.push({
    _idReporter: userId,
    reason,
    reportDate: new Date(),
    status: 'pending'
  })

  await article.save() // Kiểm tra lỗi tại dòng này nếu CSDL không lưu được
  return article
}

const saveArticleService = async (postId, userId) => {
  try {
    // Tìm người dùng theo `userId`
    const user = await User.findById(userId)
    if (!user) {
      throw new Error('Không tìm thấy người dùng với ID đã cung cấp.')
    }

    // Kiểm tra xem bộ sưu tập "Tất cả mục đã lưu" đã tồn tại hay chưa
    let userCollection = user.collections.find(
      (collection) => collection.name === 'Tất cả mục đã lưu'
    )

    // Nếu bộ sưu tập chưa tồn tại, tạo mới và thêm vào mảng `collections` của người dùng
    if (!userCollection) {
      userCollection = {
        _id: new mongoose.Types.ObjectId().toString(), // Tạo ID mới cho bộ sưu tập
        name: 'Tất cả mục đã lưu',
        items: [postId], // Thêm `postId` đầu tiên vào `items`
        createdAt: new Date(),
        updatedAt: new Date()
      }
      user.collections.push(userCollection)
    } else {
      // Kiểm tra xem bài viết đã tồn tại trong bộ sưu tập hay chưa
      const isArticleSaved = userCollection.items.includes(postId)
      if (isArticleSaved) {
        throw new Error('Bài viết đã có trong bộ sưu tập.')
      }
      // Nếu chưa có, thêm `postId` vào danh sách `items`
      userCollection.items.push(postId)
      userCollection.updatedAt = new Date() // Cập nhật thời gian sửa đổi
    }

    // Lưu thay đổi trong tài liệu người dùng
    await user.save()

    return userCollection // Trả về bộ sưu tập đã được cập nhật
  } catch (error) {
    console.error(`Lỗi khi lưu bài viết: ${error.message}`)
    throw new Error(`Lỗi khi lưu bài viết: ${error.message}`)
  }
}

const editArticleService = async (postId, updatedContent, updatedScope) => {
  try {
    const article = await Article.findById(postId)
    if (!article) {
      throw new Error('Bài viết không tồn tại')
    }

    // Cập nhật nội dung và phạm vi bài viết
    article.content = updatedContent || article.content
    article.scope = updatedScope || article.scope
    article.updatedAt = new Date() // Cập nhật thời gian sửa

    const updatedArticle = await article.save()
    return updatedArticle
  } catch (error) {
    console.error(`Lỗi khi chỉnh sửa bài viết: ${error.message}`)
    throw new Error(`Lỗi khi chỉnh sửa bài viết: ${error.message}`)
  }
}

const likeCommentService = async (commentId, userId) => {
  try {
    // Tìm bình luận cần thích theo `commentId`
    const comment = await Comment.findById(commentId)
    if (!comment) {
      throw new Error('Bình luận không tồn tại.')
    }

    // Kiểm tra xem người dùng đã like bình luận này chưa
    const likedIndex = comment.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser.toString() === userId &&
        emoticon.typeEmoticons === 'like'
    )

    if (likedIndex > -1) {
      // Nếu đã like, bỏ like bằng cách xóa dữ liệu
      comment.emoticons.splice(likedIndex, 1)
    } else {
      // Nếu chưa like, thêm like mới vào mảng `emoticons`
      comment.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like'
      })
    }

    // Lưu thay đổi vào CSDL
    await comment.save()

    return comment
  } catch (error) {
    throw new Error(`Lỗi khi xử lý like bình luận: ${error.message}`)
  }
}

const likeReplyCommentService = async (commentId, replyId, userId) => {
  console.log(
    `Like reply comment với commentId: ${commentId}, replyId: ${replyId}, userId: ${userId}`
  )

  // Tìm reply comment
  const reply = await Comment.findById(replyId)
  if (!reply)
    throw new Error('Không tìm thấy reply comment với ID đã cung cấp.')

  console.log(
    'Dữ liệu của reply sau khi truy xuất từ MongoDB:',
    JSON.stringify(reply, null, 2)
  )

  // Kiểm tra và cập nhật `emoticons`
  const isLiked = reply.emoticons.some(
    (emoticon) => emoticon._iduser.toString() === userId
  )
  if (isLiked) {
    reply.emoticons = reply.emoticons.filter(
      (emoticon) => emoticon._iduser.toString() !== userId
    )
  } else {
    reply.emoticons.push({
      _iduser: userId,
      typeEmoticons: 'like',
      createdAt: new Date()
    })
  }

  // Lưu lại thay đổi
  await reply.save()
  console.log(
    'Cập nhật reply comment sau khi like/unlike:',
    JSON.stringify(reply, null, 2)
  )

  return reply // Trả về reply đã được cập nhật
}

const shareArticleService = async ({ postId, content, scope, userId }) => {
  // Kiểm tra người dùng có tồn tại không
  const user = await User.findById(userId)
  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }

  // Tạo bài viết mới
  const newArticle = new Article({
    content,
    scope,
    sharedPostId: postId, // ID của bài viết được chia sẻ
    createdBy: userId, // ID của người tạo bài viết
    createdAt: new Date(),
    updatedAt: new Date(),
    interact: {
      emoticons: [],
      comment: []
    }
  })

  const savedArticle = await newArticle.save()

  return {
    ...savedArticle.toObject(),
    createdBy: {
      _id: user._id,
      displayName: user.displayName || `${user.firstName} ${user.lastName}`
    }
  }
}

const getAllArticlesByUserService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  const articles = await Article.find({ createdBy: userId })
    .populate('createdBy', 'firstName lastName displayName avt')
    .populate('interact.comment')
    .exec()

  const calculateTotalComments = (comments) => {
    if (!comments) return 0
    let totalComments = comments.length
    comments.forEach((comment) => {
      if (comment.replyComment && comment.replyComment.length > 0) {
        totalComments += calculateTotalComments(comment.replyComment)
      }
    })
    return totalComments
  }

  // Thêm thuộc tính `totalComments` cho từng bài viết
  const articlesWithCommentCount = articles.map((article) => {
    if (!article) return null
    const totalComments = calculateTotalComments(article.interact.comment || [])
    return { ...article.toObject(), totalComments }
  })

  return articlesWithCommentCount // Trả về danh sách bài viết
}

export const articleService = {
  getArticleByIdService,
  createArticleService,
  getAllArticlesWithCommentsService,
  deleteArticleService,
  addCommentToArticleService,
  addReplyToCommentService,
  likeArticleService,
  reportArticleService,
  saveArticleService,
  editArticleService,
  likeCommentService,
  likeReplyCommentService,
  shareArticleService,
  getAllArticlesByUserService
}
