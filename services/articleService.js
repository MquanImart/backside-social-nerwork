import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import Group from '../models/Group.js'
import { emitEvent } from '../sockets/socket.js'
import mongoose from 'mongoose'

const getArticleByIdService = async (articleId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ. ID phải có 24 ký tự hợp lệ.')
    }

    const article = await Article.findById(articleId)
      .populate('createdBy', 'firstName lastName displayName avt')
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

    return {
      ...article.toObject(),
      totalLikes: article.totalLikes,
      totalComments: article.totalComments
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
    const user = await User.findById(userId).select('_id firstName lastName avt displayName'); // Chỉ lấy các trường cần thiết từ user

    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    const newArticle = new Article({
      content,
      listPhoto,
      scope,
      hashTag,
      interact: { emoticons: [], comment: [] }, // Đảm bảo khởi tạo mảng rỗng
      createdBy: userId,
      createdAt: new Date()
    });

    const savedArticle = await newArticle.save();

    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avt: user.avt,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`
      },
      interact: {
        emoticons: savedArticle.interact.emoticons || [], // Đảm bảo mảng rỗng nếu không có dữ liệu
        comment: savedArticle.interact.comment || [] // Đảm bảo mảng rỗng nếu không có dữ liệu
      }
    };
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message);
    throw new Error(`Lỗi khi tạo bài viết: ${error.message}`);
  }
};




const getAllArticlesWithCommentsService = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.')
    }

    const userObjectId = new mongoose.Types.ObjectId(userId)

    const user = await User.findById(userObjectId).populate({
      path: 'friends',
      populate: { path: 'idUser', select: '_id' }
    })

    if (!user) throw new Error('Người dùng không tồn tại')

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

    const groups = await Group.find({
      'members.listUsers.idUser': userObjectId,
      'members.listUsers.state': 'processed'
    })

    const groupIds = groups.map((group) => group._id)

    const articles = await Article.find({
      $and: [
        { _destroy: { $exists: false } },
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

    return articles
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error.message)
    throw new Error('Lỗi khi lấy bài viết.')
  }
}

// Service xóa bài viết
const deleteArticleService = async (articleId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ.')
    }

    const article = await Article.findById(articleId)
    if (!article) {
      throw new Error('Bài viết không tồn tại.')
    }

    await Comment.deleteMany({ _id: { $in: article.interact.comment } })

    article._destroy = new Date()
    await article.save()

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
    const newComment = new Comment({
      _iduser,
      content,
      img,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedComment = await newComment.save();

    const article = await Article.findById(postId).populate(
      'createdBy',
      'displayName avt'
    );
    if (!article) throw new Error('Bài viết không tồn tại');

    article.interact.comment.push(savedComment._id);
    article.totalComments = (article.totalComments || 0) + 1;
    article.updatedAt = new Date();
    await article.save();

    const populatedComment = await Comment.findById(savedComment._id).populate(
      '_iduser',
      'displayName avt'
    );

    // Phát sự kiện WebSocket thông báo bình luận mới (cho tất cả các client)
    emitEvent('new_comment', {
      postId,
      comment: populatedComment,
      totalComments: article.totalComments // Cập nhật số lượng bình luận
    });

    // Chỉ gửi thông báo nếu người bình luận khác với người tạo bài viết
    if (_iduser.toString() !== article.createdBy._id.toString()) {
      emitEvent('new_comment_notification', {
        senderId: {
          _id: _iduser,
          displayName: populatedComment._iduser.displayName,
          avt: populatedComment._iduser.avt ? [populatedComment._iduser.avt] : ['']
        },
        postId,
        receiverId: article.createdBy._id,
        message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
        commentId: savedComment._id,
        createdAt: new Date()
      });

      // Lưu thông báo vào database
      const notification = new Notification({
        senderId: _iduser,
        receiverId: article.createdBy._id,
        message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
        status: 'unread',
        createdAt: new Date()
      });
      await notification.save();
    }

    return populatedComment;
  } catch (error) {
    throw new Error(`Lỗi khi thêm bình luận: ${error.message}`);
  }
};


// Service thêm phản hồi vào bình luận + socket thông báo rồi(chưa format lại thông báo) + chưa socket số comment
const addReplyToCommentService = async ({
  postId,
  commentId,
  content,
  _iduser
}) => {
  try {
    const article = await Article.findById(postId).populate({
      path: 'interact.comment',
      model: 'Comment'
    });
    if (!article) throw new Error('Bài viết không tồn tại');

    const comment = await Comment.findById(commentId).populate(
      '_iduser',
      'displayName avt'
    );
    if (!comment) throw new Error('Bình luận không tồn tại');

    const newReply = new Comment({
      _iduser,
      content,
      img: [],
      replyComment: [],
      emoticons: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedReply = await newReply.save();

    comment.replyComment.push(savedReply._id);
    await comment.save();

    article.totalComments = (article.totalComments || 0) + 1;
    await article.save();

    const populatedReply = await Comment.findById(savedReply._id).populate(
      '_iduser',
      'displayName avt'
    );

    // Phát sự kiện WebSocket thông báo phản hồi mới (cho tất cả các client)
    emitEvent('new_reply', {
      postId,
      commentId,
      reply: populatedReply,
      totalComments: article.totalComments
    });

    // Chỉ gửi thông báo nếu người trả lời khác với người tạo bình luận
    if (_iduser.toString() !== comment._iduser._id.toString()) {
      emitEvent('new_reply_notification', {
        senderId: {
          _id: _iduser,
          displayName: populatedReply._iduser.displayName,
          avt: populatedReply._iduser.avt ? [populatedReply._iduser.avt] : ['']
        },
        commentId,
        postId,
        receiverId: comment._iduser._id,
        message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
        replyId: savedReply._id,
        createdAt: new Date()
      });

      const notification = new Notification({
        senderId: _iduser,
        receiverId: comment._iduser._id,
        message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
        status: 'unread',
        createdAt: new Date()
      });
      await notification.save();
    }

    return populatedReply;
  } catch (error) {
    throw new Error(`Lỗi khi thêm trả lời bình luận: ${error.message}`);
  }
};


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
    article.interact.emoticons.splice(likedIndex, 1)
    await article.save()
    return { message: 'Đã hủy thích bài viết', article }
  } else {
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
    const article = await Article.findById(postId).populate(
      'createdBy',
      'displayName avt'
    );
    if (!article) throw new Error('Bài viết không tồn tại.');

    const existingReport = article.reports.find(
      (report) => report._idReporter.toString() === userId.toString()
    );

    if (existingReport) {
      throw new Error('Bạn đã báo cáo bài viết này trước đó.');
    }

    article.reports.push({
      _idReporter: userId,
      reason,
      reportDate: new Date(),
      status: 'pending'
    });

    await article.save();

    // Kiểm tra nếu người báo cáo khác với người tạo bài viết, thì mới gửi thông báo
    if (article.createdBy._id.toString() !== userId.toString()) {
      emitEvent('article_reported', {
        senderId: {
          _id: userId,
          displayName: 'Người dùng đã báo cáo'
        },
        articleId: postId,
        reporter: userId,
        reason: reason,
        receiverId: article.createdBy._id,
        message: `Bài viết của bạn đã bị báo cáo với lý do: ${reason}`,
        createdAt: new Date()
      });

      const notification = new Notification({
        senderId: userId,
        receiverId: article.createdBy._id,
        message: `Bài viết của bạn đã bị báo cáo với lý do: ${reason}`,
        status: 'unread',
        createdAt: new Date()
      });
      await notification.save();
    }

    return article;
  } catch (error) {
    throw new Error(`Không thể báo cáo bài viết: ${error.message}`);
  }
};


const saveArticleService = async (postId, userId) => {
  try {
    const user = await User.findById(userId)
    if (!user) {
      throw new Error('Không tìm thấy người dùng với ID đã cung cấp.')
    }

    let userCollection = user.collections.find(
      (collection) => collection.name === 'Tất cả mục đã lưu'
    )

    if (!userCollection) {
      userCollection = {
        _id: new mongoose.Types.ObjectId().toString(),
        name: 'Tất cả mục đã lưu',
        items: [postId],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      user.collections.push(userCollection)
    } else {
      const isArticleSaved = userCollection.items.includes(postId)
      if (isArticleSaved) {
        throw new Error('Bài viết đã có trong bộ sưu tập.')
      }

      userCollection.items.push(postId)
      userCollection.updatedAt = new Date()
    }

    await user.save()

    return userCollection
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
    const comment = await Comment.findById(commentId).populate('_iduser');
    if (!comment) {
      throw new Error('Bình luận không tồn tại.');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    const displayName = user.displayName || 'Người dùng';
    const avt = user.avt && user.avt.length > 0 ? user.avt[user.avt.length - 1] : '';

    const likedIndex = comment.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser.toString() === userId &&
        emoticon.typeEmoticons === 'like'
    );

    let action = '';

    if (likedIndex > -1) {
      comment.emoticons.splice(likedIndex, 1);
      comment.totalLikes -= 1;
      action = 'unlike';
    } else {
      comment.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like'
      });
      comment.totalLikes += 1;
      action = 'like';
    }

    await comment.save();

    // Chỉ gửi thông báo nếu người thích bình luận khác với người đã tạo bình luận
    if (action === 'like' && userId.toString() !== comment._iduser._id.toString()) {
      const notification = new Notification({
        senderId: userId,
        receiverId: comment._iduser._id,
        message: `${displayName} đã thích bình luận của bạn`,
        status: 'unread',
        createdAt: new Date()
      });

      await notification.save();

      emitEvent('like_comment_notification', {
        senderId: {
          _id: userId,
          avt: avt ? [avt] : [''],
          displayName: displayName
        },
        commentId,
        receiverId: comment._iduser._id,
        message: `${displayName} đã thích bình luận của bạn`,
        status: 'unread',
        createdAt: new Date()
      });
    }

    // Phát sự kiện socket để cập nhật số like và trạng thái like/unlike
    emitEvent('update_comment_likes', {
      commentId: commentId,
      totalLikes: comment.totalLikes,
      action: action,
      userId: userId
    });

    return comment;
  } catch (error) {
    throw new Error(`Lỗi khi xử lý like bình luận: ${error.message}`);
  }
};

// socket thông báo rồi (chưa format lại thông báo)) + (chưa tính số like)
const likeReplyCommentService = async (commentId, replyId, userId) => {
  try {
    const reply = await Comment.findById(replyId).populate('_iduser', 'displayName avt');
    if (!reply) throw new Error('Không tìm thấy reply comment với ID đã cung cấp.');

    const user = await User.findById(userId);
    if (!user) throw new Error('Người dùng không tồn tại.');

    const displayName = user.displayName || 'Người dùng';

    const isLiked = reply.emoticons.some(
      (emoticon) => emoticon._iduser.toString() === userId
    );

    let action = '';

    if (isLiked) {
      reply.emoticons = reply.emoticons.filter(
        (emoticon) => emoticon._iduser.toString() !== userId
      );
      reply.totalLikes -= 1;
      action = 'unlike';
    } else {
      reply.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like',
        createdAt: new Date()
      });
      reply.totalLikes += 1;
      action = 'like';
    }

    await reply.save();

    // Chỉ gửi thông báo nếu người thích khác với người tạo phản hồi
    if (action === 'like' && userId.toString() !== reply._iduser._id.toString()) {
      emitEvent('like_reply_notification', {
        senderId: {
          _id: userId,
          displayName: displayName,
          avt: user.avt ? [user.avt] : ['']
        },
        commentId,
        replyId,
        receiverId: reply._iduser._id,
        message: `${displayName} đã thích câu trả lời của bạn`,
        createdAt: new Date()
      });

      const notification = new Notification({
        senderId: userId,
        receiverId: reply._iduser._id,
        message: `${displayName} đã thích câu trả lời của bạn`,
        status: 'unread',
        createdAt: new Date()
      });
      await notification.save();
    }

    // Phát sự kiện socket để cập nhật số like và trạng thái like/unlike
    emitEvent('update_reply_likes', {
      commentId,
      replyId,
      totalLikes: reply.totalLikes,
      action: action,
      userId: userId
    });

    return reply;
  } catch (error) {
    throw new Error(`Lỗi khi xử lý like reply: ${error.message}`);
  }
};


// Service - shareArticleService
const shareArticleService = async ({ postId, content, scope, userId }) => {
  try {
    const user = await User.findById(userId).select('_id firstName lastName avt displayName');
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    const article = await Article.findById(postId).populate('createdBy');
    if (!article) {
      throw new Error('Bài viết không tồn tại');
    }

    const newArticle = new Article({
      content,
      scope,
      sharedPostId: postId,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      interact: {
        emoticons: [],
        comment: []
      }
    });

    const savedArticle = await newArticle.save();

    // Trả về bài viết với định dạng mong muốn
    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avt: user.avt ? user.avt[user.avt.length - 1] : '',
        displayName: user.displayName || `${user.firstName} ${user.lastName}`
      }
    };
  } catch (error) {
    throw new Error(`Lỗi khi chia sẻ bài viết: ${error.message}`);
  }
};



const getAllArticlesByUserService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID người dùng không hợp lệ.')
  }

  const articles = await Article.find({ createdBy: userId })
    .populate('createdBy', 'firstName lastName displayName avt')
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

  const articlesWithCounts = articles.map((article) => {
    if (!article) return null
    return {
      ...article.toObject(),
      totalLikes: article.totalLikes,
      totalComments: article.totalComments
    }
  })

  return articlesWithCounts
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
