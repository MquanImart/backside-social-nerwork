import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import Group from '../models/Group.js'
import { emitEvent } from '../sockets/socket.js'
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

    // Lấy danh sách ID của bạn bè
    const friendIds = user.friends
      ? user.friends.map((friend) => {
          if (friend && friend.idUser && friend.idUser._id) {
            const friendId = friend.idUser._id.toString()
            if (mongoose.Types.ObjectId.isValid(friendId)) {
              return new mongoose.Types.ObjectId(friendId)
            }
          }
          return null
        })
      : []

    // Lấy tất cả nhóm mà người dùng đã tham gia
    const groups = await Group.find({
      'members.listUsers.idUser': userObjectId,
      'members.listUsers.state': 'processed'
    })

    // Lấy danh sách ID của nhóm
    const groupIds = groups.map((group) => group._id)

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

    if (!articles || articles.length === 0) {
      return []
    }

    // Trả về tất cả thông tin của các bài viết
    return articles
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

// Service thêm bình luận vào bài viết + socket thông báo rồi(chưa format lại thông báo) + chưa socket số comment
const addCommentToArticleService = async ({
  postId,
  content,
  _iduser,
  img = []
}) => {
  try {
    // Tạo bình luận mới với tham chiếu đến người dùng
    const newComment = new Comment({
      _iduser,
      content,
      img,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Lưu bình luận mới
    const savedComment = await newComment.save()

    // Tìm bài viết và thêm bình luận vào mảng comment
    const article = await Article.findById(postId).populate(
      'createdBy',
      'displayName avt'
    )
    if (!article) throw new Error('Bài viết không tồn tại')

    // Thêm bình luận vào mảng comment của bài viết
    article.interact.comment.push(savedComment._id)

    // Cập nhật totalComments
    article.totalComments = (article.totalComments || 0) + 1
    article.updatedAt = new Date()

    // Lưu bài viết đã cập nhật
    await article.save()

    // Lấy thông tin bình luận đã lưu kèm người dùng
    const populatedComment = await Comment.findById(savedComment._id).populate(
      '_iduser',
      'displayName avt'
    )

    // Phát sự kiện WebSocket thông báo đến client
    emitEvent('new_comment_notification', {
      senderId: {
        _id: _iduser,
        displayName: populatedComment._iduser.displayName,
        avt: populatedComment._iduser.avt
          ? [populatedComment._iduser.avt]
          : ['']
      },
      postId,
      receiverId: article.createdBy._id, // Thông báo cho tác giả của bài viết
      message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
      commentId: savedComment._id,
      createdAt: new Date()
    })

    // Tùy chọn: Tạo thông báo lưu vào database
    const notification = new Notification({
      senderId: _iduser,
      receiverId: article.createdBy._id, // Thông báo cho tác giả của bài viết
      message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
      status: 'unread',
      createdAt: new Date()
    })
    await notification.save()

    // Trả về bình luận đã được populate thông tin
    return populatedComment
  } catch (error) {
    throw new Error(`Lỗi khi thêm bình luận: ${error.message}`)
  }
}

// Service thêm phản hồi vào bình luận + socket thông báo rồi(chưa format lại thông báo) + chưa socket số comment
const addReplyToCommentService = async ({
  postId,
  commentId,
  content,
  _iduser
}) => {
  try {
    // Find the article to ensure it exists
    const article = await Article.findById(postId).populate({
      path: 'interact.comment',
      model: 'Comment'
    })
    if (!article) throw new Error('Bài viết không tồn tại')

    // Find the comment that the reply will be added to
    const comment = await Comment.findById(commentId).populate(
      '_iduser',
      'displayName avt'
    )
    if (!comment) throw new Error('Bình luận không tồn tại')

    // Create a new reply comment
    const newReply = new Comment({
      _iduser,
      content,
      img: [],
      replyComment: [],
      emoticons: [],
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Save the new reply
    const savedReply = await newReply.save()

    // Add the reply to the original comment's replyComment array
    comment.replyComment.push(savedReply._id)
    await comment.save()

    // Populate the _iduser field with user's displayName and avt for the new reply
    const populatedReply = await Comment.findById(savedReply._id).populate(
      '_iduser',
      'displayName avt'
    )

    // Emit WebSocket notification to notify the author of the comment
    emitEvent('new_reply_notification', {
      senderId: {
        _id: _iduser,
        displayName: populatedReply._iduser.displayName,
        avt: populatedReply._iduser.avt ? [populatedReply._iduser.avt] : ['']
      },
      commentId,
      postId,
      receiverId: comment._iduser._id, // Notify the author of the comment
      message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
      replyId: savedReply._id,
      createdAt: new Date()
    })

    // Optionally, create a notification in the database
    const notification = new Notification({
      senderId: _iduser,
      receiverId: comment._iduser._id, // Notify the author of the comment
      message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
      status: 'unread',
      createdAt: new Date()
    })
    await notification.save()

    // Return the populated reply
    return populatedReply
  } catch (error) {
    throw new Error(`Lỗi khi thêm trả lời bình luận: ${error.message}`)
  }
}
// socket thông báo rồi(chưa format lại thông báo) + chưa socket số like
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
// socket thông báo rồi(chưa format lại thông báo)
const reportArticleService = async (postId, userId, reason) => {
  try {
    // Find the article by its ID and populate the author info
    const article = await Article.findById(postId).populate(
      'createdBy',
      'displayName avt'
    )
    if (!article) throw new Error('Bài viết không tồn tại.')

    // Check if the user has already reported the article
    const existingReport = article.reports.find(
      (report) => report._idReporter.toString() === userId.toString()
    )

    if (existingReport) {
      throw new Error('Bạn đã báo cáo bài viết này trước đó.')
    }

    // Add a new report to the `reports` array
    article.reports.push({
      _idReporter: userId,
      reason,
      reportDate: new Date(),
      status: 'pending' // Default status for a new report
    })

    // Try saving the updated article
    await article.save()

    // Emit WebSocket notification to the author of the article
    emitEvent('article_reported', {
      senderId: {
        _id: userId,
        displayName: 'Người dùng đã báo cáo' // You can fetch the displayName of the reporter if necessary
      },
      articleId: postId,
      reporter: userId, // ID of the user who reported
      reason: reason,
      receiverId: article.createdBy._id, // Notify the author of the article
      message: `Bài viết của bạn đã bị báo cáo với lý do: ${reason}`,
      createdAt: new Date()
    })

    // Optionally create a notification in the database for the author
    const notification = new Notification({
      senderId: userId, // The user who reported
      receiverId: article.createdBy._id, // Notify the author of the article
      message: `Bài viết của bạn đã bị báo cáo với lý do: ${reason}`,
      status: 'unread',
      createdAt: new Date()
    })
    await notification.save()

    // Return the updated article if the save was successful
    return article
  } catch (error) {
    // Log the error for debugging purposes
    console.error(`Lỗi khi báo cáo bài viết: ${error.message}`)
    // Re-throw the error to be handled by the calling function/controller
    throw new Error(`Không thể báo cáo bài viết: ${error.message}`)
  }
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
// socket thông báo rồi (chưa format lại thông báo)) + (chưa tính số like)
const likeCommentService = async (commentId, userId) => {
  try {
    const comment = await Comment.findById(commentId).populate('_iduser')
    console.log('comment', comment)
    if (!comment) {
      throw new Error('Bình luận không tồn tại.')
    }

    const user = await User.findById(userId)
    if (!user) {
      throw new Error('Người dùng không tồn tại')
    }

    const displayName = user.displayName || 'Người dùng'
    const avt =
      user.avt && user.avt.length > 0 ? user.avt[user.avt.length - 1] : ''

    // Check if the user has already liked the comment
    const likedIndex = comment.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser.toString() === userId &&
        emoticon.typeEmoticons === 'like'
    )

    let action = '' // Default action is unlike

    if (likedIndex > -1) {
      // If already liked, remove the like
      comment.emoticons.splice(likedIndex, 1)
      action = 'unlike'
    } else {
      // If not liked, add a new like
      comment.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like'
      })
      action = 'like'
    }

    // Save the changes to the database
    await comment.save()

    // If the action was 'like', create and emit a notification
    if (action === 'like') {
      const notification = new Notification({
        senderId: userId,
        receiverId: comment._iduser._id, // Receiver is the author of the comment
        message: `${displayName} đã thích bình luận của bạn`,
        status: 'unread',
        createdAt: new Date()
      })

      await notification.save()

      // Emit the WebSocket event to notify the receiver
      emitEvent('like_comment_notification', {
        senderId: {
          _id: userId,
          avt: avt ? [avt] : [''], // Avatar of the liker
          displayName: displayName
        },
        commentId,
        receiverId: comment._iduser._id,
        message: `${displayName} đã thích bình luận của bạn`,
        status: 'unread',
        createdAt: new Date()
      })
    }

    return comment
  } catch (error) {
    throw new Error(`Lỗi khi xử lý like bình luận: ${error.message}`)
  }
}

// socket thông báo rồi (chưa format lại thông báo)) + (chưa tính số like)
const likeReplyCommentService = async (commentId, replyId, userId) => {
  console.log(
    `Like reply comment với commentId: ${commentId}, replyId: ${replyId}, userId: ${userId}`
  )

  // Tìm reply comment
  const reply = await Comment.findById(replyId).populate(
    '_iduser',
    'displayName avt'
  )
  if (!reply)
    throw new Error('Không tìm thấy reply comment với ID đã cung cấp.')

  console.log(
    'Dữ liệu của reply sau khi truy xuất từ MongoDB:',
    JSON.stringify(reply, null, 2)
  )

  // Tìm user đã thực hiện like/unlike
  const user = await User.findById(userId)
  if (!user) throw new Error('Người dùng không tồn tại.')

  const displayName = user.displayName || 'Người dùng'

  // Kiểm tra xem người dùng đã like reply comment này chưa
  const isLiked = reply.emoticons.some(
    (emoticon) => emoticon._iduser.toString() === userId
  )

  let action = '' // Store the action (like/unlike)

  if (isLiked) {
    // Nếu đã like, xóa like
    reply.emoticons = reply.emoticons.filter(
      (emoticon) => emoticon._iduser.toString() !== userId
    )
    action = 'unlike'
  } else {
    // Nếu chưa like, thêm like mới
    reply.emoticons.push({
      _iduser: userId,
      typeEmoticons: 'like',
      createdAt: new Date()
    })
    action = 'like'
  }

  // Lưu lại thay đổi
  await reply.save()
  console.log(
    'Cập nhật reply comment sau khi like/unlike:',
    JSON.stringify(reply, null, 2)
  )

  // Emit WebSocket notification if the action was 'like'
  if (action === 'like') {
    emitEvent('like_reply_notification', {
      senderId: {
        _id: userId,
        displayName: displayName,
        avt: user.avt ? [user.avt] : ['']
      },
      commentId,
      replyId,
      receiverId: reply._iduser._id, // Notify the author of the reply
      message: `${displayName} đã thích câu trả lời của bạn`,
      createdAt: new Date()
    })

    // Optionally create a notification in the database
    const notification = new Notification({
      senderId: userId,
      receiverId: reply._iduser._id, // Notify the author of the reply
      message: `${displayName} đã thích câu trả lời của bạn`,
      status: 'unread',
      createdAt: new Date()
    })
    await notification.save()
  }

  return reply // Trả về reply đã được cập nhật
}

// Service - shareArticleService
const shareArticleService = async ({ postId, content, scope, userId }) => {
  // Kiểm tra người dùng có tồn tại không
  const user = await User.findById(userId)
  if (!user) {
    throw new Error('Người dùng không tồn tại')
  }
  // Kiểm tra thông tin đầu vào
  if (!postId) {
    return res.status(400).json({ message: 'Thiếu postId hoặc userId' })
  }

  const article = await Article.findById(postId).populate('createdBy')
  if (!article) {
    return res.status(404).json({ message: 'Bài viết không tồn tại' })
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

  // Lưu thông báo vào database
  const notification = new Notification({
    senderId: userId,
    receiverId: article.createdBy._id,
    message: `${
      user.displayName || `${user.firstName} ${user.lastName}`
    } đã chia sẻ bài viết của bạn.`,
    status: 'unread',
    createdAt: new Date()
  })

  await notification.save()

  // Trả về bài viết mới và thông tin người chia sẻ
  return {
    ...savedArticle.toObject(),
    createdBy: {
      _id: user._id,
      displayName: user.displayName || `${user.firstName} ${user.lastName}`,
      avt: user.avt ? user.avt[user.avt.length - 1] : '' // Avatar của người chia sẻ
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
