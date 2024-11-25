import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import MyPhoto from '../models/MyPhoto.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import Group from '../models/Group.js'
import { emitEvent } from '../sockets/socket.js'
import mongoose from 'mongoose'

const getArticleByIdService = async (articleId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ. ID phải có 24 ký tự hợp lệ.');
    }

    const article = await Article.findById(articleId)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt',
        populate: {
          path: 'avt',
          model: 'MyPhoto',
          select: 'name link idAuthor type' // Lấy thông tin MyPhoto của người tạo bài viết
        }
      })
      .populate({
        path: 'listPhoto',
        model: 'MyPhoto',
        select: 'name link idAuthor type' // Lấy thông tin MyPhoto từ listPhoto
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: {
              path: 'avt',
              model: 'MyPhoto',
              select: 'name link idAuthor type' // Lấy MyPhoto từ avt của người dùng trong comment
            }
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: {
                path: 'avt',
                model: 'MyPhoto',
                select: 'name link idAuthor type' // Lấy MyPhoto từ avt của người dùng trong replyComment
              }
            }
          }
        ]
      })
      .lean(); // Sử dụng lean() để chuyển đối tượng thành JavaScript thuần túy

    if (!article) throw new Error('Bài viết không tồn tại.');

    return {
      ...article,
      totalLikes: article.totalLikes,
      totalComments: article.totalComments
    };
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error.message);
    throw new Error('Lỗi khi lấy bài viết.');
  }
};

// Service tạo bài viết mới
const createArticleService = async ({
  content,
  listPhoto,
  scope,
  hashTag,
  userId
}) => {
  try {
    // Truy xuất thông tin người tạo bài viết, bao gồm avatar và background chi tiết
    const user = await User.findById(userId)
      .select('_id firstName lastName avt backGround displayName')
      .populate([
        {
          path: 'avt',
          model: 'MyPhoto',
          select: 'name link idAuthor type'
        },
        {
          path: 'backGround',
          model: 'MyPhoto',
          select: 'name link idAuthor type'
        }
      ]);

    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    // Lấy thông tin chi tiết của các ảnh đính kèm trong bài viết
    const photoDetails = await Promise.all(
      listPhoto.map(async (photoId) => {
        const photo = await MyPhoto.findById(photoId).select('name link idAuthor type');
        return photo;
      })
    );

    // Tạo bài viết mới
    const newArticle = new Article({
      content,
      listPhoto: photoDetails.map(photo => photo._id),
      scope,
      hashTag,
      interact: { emoticons: [], comment: [] },
      createdBy: userId,
      createdAt: new Date()
    });

    // Lưu bài viết vào cơ sở dữ liệu
    const savedArticle = await newArticle.save();

    // Trả về thông tin bài viết đã lưu cùng chi tiết của avatar và background
    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avt: user.avt || [], // Trả về danh sách avatar nếu có
        backGround: user.backGround || [], // Trả về danh sách background nếu có
        displayName: user.displayName || `${user.firstName} ${user.lastName}`
      },
      listPhoto: photoDetails,
      interact: {
        emoticons: savedArticle.interact.emoticons || [],
        comment: savedArticle.interact.comment || []
      }
    };
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message);
    throw new Error(`Lỗi khi tạo bài viết: ${error.message}`);
  }
};

const getAllArticlesWithCommentsService = async (userId, page = 1, limit = 10) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID người dùng không hợp lệ. ID phải có 24 ký tự hợp lệ.');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Lấy thông tin người dùng và danh sách bạn bè
    const user = await User.findById(userObjectId).populate({
      path: 'friends',
      populate: { path: 'idUser', select: '_id' }
    });

    if (!user) throw new Error('Người dùng không tồn tại');

    const friendIds = user.friends
      ? user.friends
          .map(friend => friend?.idUser?._id && new mongoose.Types.ObjectId(friend.idUser._id))
          .filter(Boolean)
      : [];

    const groups = await Group.find({
      'members.listUsers.idUser': userObjectId,
      'members.listUsers.state': 'processed'
    });
    const groupIds = groups.map(group => group._id);

    const skip = (page - 1) * limit;

    const articles = await Article.find({
      $and: [
        { _destroy: { $exists: false } },
        {
          $or: [
            { createdBy: { $in: friendIds }, scope: { $in: ['public', 'friends'] } },
            { groupID: { $in: groupIds }, state: 'processed' },
            { createdBy: userObjectId }
          ]
        }
      ]
    })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt backGround',
        populate: [
          {
            path: 'avt',
            model: 'MyPhoto',
            select: 'name link idAuthor type'
          },
          {
            path: 'backGround',
            model: 'MyPhoto',
            select: 'name link idAuthor type'
          }
        ]
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: {
              path: 'avt',
              model: 'MyPhoto',
              select: 'name link idAuthor type'
            }
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: {
                path: 'avt',
                model: 'MyPhoto',
                select: 'name link idAuthor type'
              }
            }
          }
        ]
      })
      .populate({
        path: 'groupID',
        select: 'groupName avt backGround'
      })
      .populate({
        path: 'listPhoto',
        model: 'MyPhoto',
        select: 'name link idAuthor type'
      })
      .sort({ createdAt: -1 });

    if (!articles || articles.length === 0) {
      return { articles: [], hasMore: false };
    }

    const hasMore = articles.length === limit;

    return { articles, hasMore };
  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error.message);
    throw new Error('Lỗi khi lấy bài viết.');
  }
};

// Service xóa bài viết
const deleteArticleService = async (articleId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      throw new Error('ID bài viết không hợp lệ.');
    }

    const article = await Article.findById(articleId);
    if (!article) {
      throw new Error('Bài viết không tồn tại.');
    }

    // Xóa các bình luận liên quan đến bài viết
    await Comment.deleteMany({ _id: { $in: article.interact.comment } });

    // Đánh dấu xóa các ảnh liên quan bằng cách cập nhật thời gian _destroy cho từng ảnh
    if (article.listPhoto && article.listPhoto.length > 0) {
      await MyPhoto.updateMany(
        { _id: { $in: article.listPhoto } },
        { $set: { _destroy: new Date() } }
      );
    }

    // Đánh dấu thời gian xóa cho bài viết
    article._destroy = new Date();
    await article.save();

    // Xóa bài viết khỏi danh sách bài viết của người dùng
    await User.findByIdAndUpdate(
      article.createdBy,
      { $pull: { listArticle: articleId } },
      { new: true }
    );

    return {
      message: 'Đánh dấu xóa bài viết và các bình luận, ảnh liên quan thành công.'
    };
  } catch (error) {
    throw new Error(`Lỗi khi xóa bài viết: ${error.message}`);
  }
};

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
      'displayName avt backGround'
    );

    if (!article) throw new Error('Bài viết không tồn tại');

    article.interact.comment.push(savedComment._id);
    article.totalComments = (article.totalComments || 0) + 1;
    article.updatedAt = new Date();
    await article.save();

    const populatedComment = await Comment.findById(savedComment._id)
      .populate([
        {
          path: '_iduser',
          select: 'displayName avt backGround',
          populate: [
            { path: 'avt', model: 'MyPhoto', select: 'name link idAuthor type' },
            { path: 'backGround', model: 'MyPhoto', select: 'name link idAuthor type' }
          ]
        }
      ]);
      const postLink = `http://localhost:5173/new-feeds/${postId}`;

    emitEvent('new_comment', {
      postId,
      comment: populatedComment,
      totalComments: article.totalComments
    });

    if (_iduser.toString() !== article.createdBy._id.toString()) {
      emitEvent('new_comment_notification', {
        senderId: {
          _id: _iduser,
          displayName: populatedComment._iduser.displayName,
          avt: populatedComment._iduser.avt || [],
          backGround: populatedComment._iduser.backGround || []
        },
        postId,
        receiverId: article.createdBy._id,
        message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
        commentId: savedComment._id,
        createdAt: new Date(),
        link: postLink
      });

      const notification = new Notification({
        senderId: _iduser,
        receiverId: article.createdBy._id,
        message: `${populatedComment._iduser.displayName} đã bình luận về bài viết của bạn`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink
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

    const comment = await Comment.findById(commentId).populate({
      path: '_iduser',
      select: 'displayName avt backGround',
      populate: [
        { path: 'avt', model: 'MyPhoto', select: 'name link idAuthor type' },
        { path: 'backGround', model: 'MyPhoto', select: 'name link idAuthor type' }
      ]
    });

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

    const populatedReply = await Comment.findById(savedReply._id).populate({
      path: '_iduser',
      select: 'displayName avt backGround',
      populate: [
        { path: 'avt', model: 'MyPhoto', select: 'name link idAuthor type' },
        { path: 'backGround', model: 'MyPhoto', select: 'name link idAuthor type' }
      ]
    });

    emitEvent('new_reply', {
      postId,
      commentId,
      reply: populatedReply,
      totalComments: article.totalComments
    });
    const postLink = `http://localhost:5173/new-feeds/${postId}`;
    if (_iduser.toString() !== comment._iduser._id.toString()) {
      emitEvent('new_reply_notification', {
        senderId: {
          _id: _iduser,
          displayName: populatedReply._iduser.displayName,
          avt: populatedReply._iduser.avt || [],
          backGround: populatedReply._iduser.backGround || []
        },
        commentId,
        postId,
        receiverId: comment._iduser._id,
        message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
        replyId: savedReply._id,
        createdAt: new Date(),
        link: postLink
      });

      const notification = new Notification({
        senderId: _iduser,
        receiverId: comment._iduser._id,
        message: `${populatedReply._iduser.displayName} đã trả lời bình luận của bạn`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink
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
    const postLink = `http://localhost:5173/new-feeds/${postId}`;
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
        createdAt: new Date(),
        link: postLink
      });

      const notification = new Notification({
        senderId: userId,
        receiverId: article.createdBy._id,
        message: `Bài viết của bạn đã bị báo cáo với lý do: ${reason}`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink
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
    const article = await Article.findOne({ 'interact.comment': commentId });
    if (!article) {
      throw new Error('Bài viết chứa bình luận không tồn tại.');
    }

    const postLink = `http://localhost:5173/new-feeds/${article._id}`;
    // Chỉ gửi thông báo nếu người thích bình luận khác với người đã tạo bình luận
    if (action === 'like' && userId.toString() !== comment._iduser._id.toString()) {
      const notification = new Notification({
        senderId: userId,
        receiverId: comment._iduser._id,
        message: `${displayName} đã thích bình luận của bạn`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink 
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
        createdAt: new Date(),
        link: postLink // Thêm link tới bài viết
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
    // Tìm phản hồi bằng ID
    const reply = await Comment.findById(replyId).populate('_iduser', 'displayName avt');
    if (!reply) throw new Error('Không tìm thấy reply comment với ID đã cung cấp.');

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) throw new Error('Người dùng không tồn tại.');

    const displayName = user.displayName || 'Người dùng';

    // Kiểm tra người dùng đã like chưa
    const isLiked = reply.emoticons.some(
      (emoticon) => emoticon._iduser.toString() === userId
    );

    let action = '';

    // Nếu đã like, hủy like
    if (isLiked) {
      reply.emoticons = reply.emoticons.filter(
        (emoticon) => emoticon._iduser.toString() !== userId
      );
      reply.totalLikes -= 1;
      action = 'unlike';
    } else {
      // Nếu chưa like, thêm like
      reply.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like',
        createdAt: new Date()
      });
      reply.totalLikes += 1;
      action = 'like';
    }

    // Lưu thay đổi
    await reply.save();

    // Tìm bài viết chứa bình luận
    const article = await Article.findOne({ 'interact.comment': commentId });
    if (!article) {
      throw new Error('Bài viết chứa bình luận không tồn tại.');
    }

    const postLink = `http://localhost:5173/new-feeds/${article._id}`;
    console.log('Post Link:', postLink); // Debug kiểm tra link

    // Gửi thông báo nếu người thích khác với người tạo phản hồi
    if (action === 'like' && userId.toString() !== reply._iduser._id.toString()) {
      // Phát socket
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
        createdAt: new Date(),
        link: postLink // Thêm link vào socket
      });

      // Lưu thông báo vào cơ sở dữ liệu
      const notification = new Notification({
        senderId: userId,
        receiverId: reply._iduser._id,
        message: `${displayName} đã thích câu trả lời của bạn`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink 
      });
      console.log('Notification Data:', notification); // Debug kiểm tra thông báo
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
    // Tìm người dùng và lấy thông tin cùng ảnh đại diện từ MyPhoto
    const user = await User.findById(userId)
      .select('_id firstName lastName avt displayName')
      .populate({
        path: 'avt',
        model: 'MyPhoto',
        select: '_id name idAuthor type link', // Chọn tất cả các trường cần thiết của MyPhoto
      });

    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    // Kiểm tra bài viết gốc để chia sẻ
    const article = await Article.findById(postId).populate('createdBy');
    if (!article) {
      throw new Error('Bài viết không tồn tại');
    }
    // Tạo bài viết mới với các thông tin yêu cầu
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

    // Trả về bài viết với định dạng mong muốn, bao gồm toàn bộ thông tin của `avt` dưới dạng mảng
    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avt: Array.isArray(user.avt) ? user.avt : [user.avt], // Trả về toàn bộ mảng avt nếu là mảng, nếu không thì tạo mảng mới chứa avt
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
    .populate({
      path: 'createdBy',
      select: 'firstName lastName displayName avt',
      populate: {
        path: 'avt',
        model: 'MyPhoto',
        select: 'name link idAuthor type'
      }
    })
    .populate({
      path: 'interact.comment',
      model: 'Comment',
      populate: [
        {
          path: '_iduser',
          select: 'firstName lastName displayName avt',
          populate: {
            path: 'avt',
            model: 'MyPhoto',
            select: 'name link idAuthor type'
          }
        },
        {
          path: 'replyComment',
          model: 'Comment',
          populate: {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: {
              path: 'avt',
              model: 'MyPhoto',
              select: 'name link idAuthor type'
            }
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

const getAllArticlesWithCommentsSystemWideService = async (page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const articles = await Article.find({
      _destroy: { $exists: false }, // Exclude deleted articles
    })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName displayName avt backGround',
        populate: [
          {
            path: 'avt',
            model: 'MyPhoto',
            select: 'name link idAuthor type',
          },
          {
            path: 'backGround',
            model: 'MyPhoto',
            select: 'name link idAuthor type',
          },
        ],
      })
      .populate({
        path: 'interact.comment',
        model: 'Comment',
        populate: [
          {
            path: '_iduser',
            select: 'firstName lastName displayName avt',
            populate: {
              path: 'avt',
              model: 'MyPhoto',
              select: 'name link idAuthor type',
            },
          },
          {
            path: 'replyComment',
            model: 'Comment',
            populate: {
              path: '_iduser',
              select: 'firstName lastName displayName avt',
              populate: {
                path: 'avt',
                model: 'MyPhoto',
                select: 'name link idAuthor type',
              },
            },
          },
        ],
      })
      .populate({
        path: 'groupID',
        select: 'groupName avt backGround',
      })
      .populate({
        path: 'listPhoto',
        model: 'MyPhoto',
        select: 'name link idAuthor type',
      })
      .sort({ createdAt: -1 }); // Most recent articles first

    if (!articles || articles.length === 0) {
      return { articles: [], hasMore: false };
    }

    const hasMore = articles.length === limit;

    return { articles, hasMore };
  } catch (error) {
    console.error('Error fetching all articles system-wide:', error.message);
    throw new Error('Error fetching articles.');
  }
};

const approveReportService = async (reportId) => {
  // Find the article with the specified report
  const article = await Article.findOne({ "reports._id": reportId });
  if (!article) {
      throw new Error("Report not found.");
  }

  const report = article.reports.id(reportId);
  if (report.status !== "pending") {
      throw new Error("Report is already processed.");
  }

  // Update the report status
  report.status = "processed";
  report.handleDate = new Date();

  // Find the user who created the article
  const user = await User.findById(article.createdBy);
  if (!user) {
      throw new Error("User not found.");
  }

  // Increment the user's warning level
  user.account.warningLevel += 1;

  // Lock the user's account if the warning level reaches 3
  if (user.account.warningLevel >= 3) {
      user.status = "locked";
  }

  // Save the updated user
  await user.save();

  // Handle group warnings if the article is associated with a group
  if (article.groupId) {
      const group = await Group.findById(article.groupId);
      if (group) {
          // Increment the group's warning level
          group.warningLevel += 1;

          // Delete the group if its warning level reaches 3
          if (group.warningLevel >= 3) {
              await Group.findByIdAndUpdate(article.groupId, { _destroy: new Date() });
          } else {
              await group.save();
          }
      }
  }

  // Mark the article as deleted by updating the `_destroy` field
  article._destroy = new Date();
  await article.save();

  return report;
};



const rejectReportService = async (reportId) => {
  const article = await Article.findOne({ "reports._id": reportId });
  if (!article) {
      throw new Error("Report not found.");
  }

  const report = article.reports.id(reportId);
  if (report.status !== "pending") {
      throw new Error("Report is already processed.");
  }

  // Update the status to "rejected"
  report.status = "rejected";
  report.handleDate = new Date();
  await article.save();

  return report;
};


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
  getAllArticlesByUserService,
  getAllArticlesWithCommentsSystemWideService,
  approveReportService,
  rejectReportService
}
