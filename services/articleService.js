import Article from '../models/Article.js'
import Comment from '../models/Comment.js'
import MyPhoto from '../models/MyPhoto.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import Admin from '../models/Admin.js'
import Group from '../models/Group.js'
import { emitEvent } from '../sockets/socket.js'
import { groupService } from '../services/groupServices.js'
import mongoose from 'mongoose'
import { getHobbySimilarity } from '../config/cosineSimilarity.js'

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

    const userHobbies = user.hobbies || [];
    const allUsers = await User.find({ _id: { $ne: userObjectId } }).lean();
    const similarUsers = allUsers.filter((otherUser) => {
      const otherUserHobbies = otherUser.hobbies || [];
      const similarity = getHobbySimilarity(userHobbies, otherUserHobbies);
      return similarity >= 0.25; // Lọc những người có độ tương thích >= 0.3
    });

    const similarUserIds = similarUsers.map((user) => user._id);
    console.log('Similar User IDs:', similarUserIds);

    if (!user) throw new Error('Người dùng không tồn tại');

    // Lấy danh sách ID của bạn bè
    const friendIds = user.friends
      ? user.friends
          .map(friend => friend?.idUser?._id && new mongoose.Types.ObjectId(friend.idUser._id))
          .filter(Boolean)
      : [];
    console.log('friendIds', friendIds)
    // Lấy danh sách các nhóm mà người dùng tham gia
    const groups = await Group.find({
      'members.listUsers.idUser': userObjectId,
      'members.listUsers.state': 'accepted',
      _destroy: { $exists: false }
    });
    const groupIds = groups.map(group => group._id);

    const groupArticles = groups.reduce((acc, group) => {
      const processedArticles = group.article?.listArticle?.filter(
        (article) => article.state === 'processed'
      );
      if (processedArticles) {
        acc.push(...processedArticles.map(a => a.idArticle));
      }
      return acc;
    }, []);

    // Lấy danh sách những người mà người dùng theo dõi
    const followingUserIds = user.follow || [];

    const skip = (page - 1) * limit;

    // Lấy bài viết của bản thân, bài viết của bạn bè, bài viết của nhóm (trạng thái 'processed') và bài viết của những người theo dõi
    const articles = await Article.find({
      $and: [
        { _destroy: { $exists: false } }, // Lọc bài viết chưa có _destroy
        {
          $or: [
            { 
              createdBy: userObjectId,
              groupID: { $in: [null, undefined] }
            }, // Bài viết của bản thân
            { 
              createdBy: { $in: similarUserIds },
              scope: 'public', 
              groupID: { $in: [null, undefined] }
            }, // Bài viết của bản thân
            { 
              createdBy: { $in: friendIds }, 
              scope: { $in: ['public', 'friends'] }, 
              groupID: { $in: [null, undefined] }  // Không thuộc nhóm nào
            },
            { groupID: { $in: groupIds }, _id: { $in: groupArticles } },
            { 
              createdBy: { $in: followingUserIds }, 
              scope: 'public', 
              groupID: { $in: [null, undefined] }
            } // Bài viết của những người đang theo dõi (chỉ công khai)
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
      .sort({ createdAt: -1 }); // Sắp xếp bài viết theo thời gian tạo giảm dần

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

    if (article.groupID) {
      const group = await Group.findById(article.groupID);
      if (group) {
        group.article.count -= 1;  // Giảm số lượng bài viết trong nhóm
        if (group.article.count < 0) group.article.count = 0;  // Đảm bảo không giảm dưới 0
        await group.save();  // Lưu thay đổi trong nhóm
      }
    }
    
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

    const user = await User.findById(userId).populate({
      path: 'avt',
      model: 'MyPhoto',
      select: '_id link'
    });

    if (!user) throw new Error('Người dùng không tồn tại.');

    const { _id: avtId, link: avtLink } = await getUserAvatarLink(user);

    if (article.createdBy._id.toString() !== userId.toString()) {
      emitEvent('article_reported', {
        senderId: {
          _id: userId,
          avt: [
            {
              _id: avtId || '', 
              link: avtLink || '' 
            }
          ],
          displayName: 'Người dùng đã báo cáo'
        },
        articleId: postId,
        reporter: userId,
        status: 'unread',
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

    article.content = updatedContent || article.content
    article.scope = updatedScope || article.scope
    article.updatedAt = new Date() 

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
    
    // Lấy avatar từ MyPhoto nếu có
    const avtLink = await getUserAvatarLink(user);
    console.log('avtLink', avtLink);

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
          avt: avtLink ? [{ _id: avtLink._id, link: avtLink.link }] : [], // Truyền đúng định dạng avatar
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
      // Lấy avatar từ MyPhoto nếu có
      const avtLink = await getUserAvatarLink(user);
      console.log('avtLink', avtLink); // Debug kiểm tra avatar

      // Phát socket
      emitEvent('like_reply_notification', {
        senderId: {
          _id: userId,
          displayName: displayName,
          avt: avtLink ? [{ _id: avtLink._id, link: avtLink.link }] : [] // Đảm bảo định dạng avt
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

    // Lấy avatar của người chia sẻ
    const avtLink = await getUserAvatarLink(user);

    // Gửi sự kiện chia sẻ bài viết và tạo thông báo nếu cần
    if (userId !== article.createdBy._id.toString()) {
      const displayName = user.displayName || `${user.firstName} ${user.lastName}`;
      const originalPostLink = `http://localhost:5173/new-feeds/${postId}`;

      // Phát sự kiện chia sẻ bài viết
      emitEvent('share_article_notification', {
        senderId: {
          _id: userId,
          avt: [
            {
              _id: avtLink._id || '', // Đảm bảo rằng _id của avatar được truyền chính xác
              link: avtLink.link || '' // Truyền link avatar
            }
          ],
          displayName
        },
        postId,
        receiverId: article.createdBy._id,
        message: `${displayName} đã chia sẻ bài viết của bạn`,
        status: 'unread',
        createdAt: new Date(),
        originalPostLink
      });

      // Lưu thông báo vào database
      const newNotification = new Notification({
        senderId: userId,
        receiverId: article.createdBy._id,
        message: `${displayName} đã chia sẻ bài viết của bạn.`,
        status: 'unread',
        createdAt: new Date(),
        link: originalPostLink,
      });

      await newNotification.save();
    }

    // Trả về bài viết đã chia sẻ với thông tin người tạo bài viết và avatar
    return {
      ...savedArticle.toObject(),
      createdBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avt: Array.isArray(user.avt) ? user.avt : [user.avt], 
        displayName: user.displayName || `${user.firstName} ${user.lastName}`
      }
    };
  } catch (error) {
    throw new Error(`Lỗi khi chia sẻ bài viết: ${error.message}`);
  }
};

const getAllArticlesByUserService = async (userId, profileId) => {
  // Kiểm tra tính hợp lệ của userId và profileId
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(profileId)) {
    throw new Error('ID người dùng hoặc profileId không hợp lệ.');
  }

  // Trường hợp 1: Nếu userId và profileId giống nhau, lấy tất cả bài viết của người dùng
  if (userId === profileId) {
    return await Article.find({ createdBy: userId, groupID: null, _destroy: { $exists: false } })
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
      .exec();
  }

  // Trường hợp 2: Nếu userId khác profileId, kiểm tra bạn bè
  const user = await User.findById(userId).populate('friends.idUser');
  
  // Kiểm tra các mối quan hệ bạn bè
  console.log('User friends:', user.friends); // Log danh sách bạn bè của người dùng

  const isFriend = user.friends.some(friend => {
    console.log('Checking friend:', friend.idUser._id.toString(), 'against profileId:', profileId.toString());
    return friend.idUser._id.equals(profileId);
  });
  console.log('isFriend:', isFriend);
  

  console.log('isFriend:', isFriend); // Log kết quả kiểm tra bạn bè

  let scopeFilter = { _destroy: { $exists: false }, groupID: null }; // Không lấy bài viết đã bị xóa và không thuộc nhóm

  // Nếu là bạn bè, lấy bài viết có trạng thái 'public' hoặc 'friends'
  if (isFriend) {
    console.log('User and profile are friends, fetching articles with scope: public or friends');
    scopeFilter.scope = { $in: ['public', 'friends'] };
  } else {
    // Nếu không phải bạn bè, chỉ lấy bài viết có trạng thái 'public'
    console.log('User and profile are not friends, fetching articles with scope: public');
    scopeFilter.scope = 'public';
  }

  // Tìm tất cả bài viết của profileId với điều kiện scopeFilter
  return await Article.find({ createdBy: profileId, ...scopeFilter })
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
    .exec();
};

const getAllArticlesWithCommentsSystemWideService = async (page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const articles = await Article.find({
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
  if (article.groupID) {
      const group = await Group.findById(article.groupID);
      if (group) {
          // Increment the group's warning level
          group.warningLevel += 1;

          // Delete the group if its warning level reaches 3
          if (group.warningLevel >= 3) {
              await groupService.lockGroupService(group._id);
          } 
          else {
              await group.save();
          }
          group.article.count -= 1;
          await group.save();
      }
  }

  const admin = await Admin.findOne();  // Lấy admin hệ thống (có thể lấy dựa trên ID hoặc quyền)
  if (!admin) {
    throw new Error('Admin system not found');
  }
  // Phát sự kiện thông báo (nếu cần)
  emitEvent('approve_report_notification', {
    senderId: admin._id,
    receiverId: user._id,  // ID của quản trị viên nhóm
    message: `Bài viết với nội dung ${article.content} của bạn đã bị do vi phạm
     quy tắc cộng đồng và mức độ cảnh báo của bạn ${user.account.warningLevel}`,
    status: 'unread',
    createdAt: new Date()
  });

  const newNotification = new Notification({
    senderId: admin._id,  // ID của admin gửi thông báo
    receiverId: user._id,  // ID của quản trị viên nhóm
    message: `Bài viết với nội dung ${article.content} của bạn đã bị do vi phạm
     quy tắc cộng đồng và mức độ cảnh báo của bạn ${user.account.warningLevel}`,
    status: 'unread',  // Đặt trạng thái là 'unread'
    createdAt: new Date()
  });

    // Lưu thông báo vào cơ sở dữ liệu
  await newNotification.save();

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

const likeArticleService = async (postId, userId) => {
  try {
    // Tìm bài viết
    const article = await Article.findById(postId).populate('createdBy');
    if (!article) {
      throw new Error('Bài viết không tồn tại');
    }

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    // Kiểm tra nếu người dùng đã thích bài viết hay chưa
    const likedIndex = article.interact.emoticons.findIndex(
      (emoticon) =>
        emoticon._iduser?.toString() === userId &&
        emoticon.typeEmoticons === 'like'
    );

    let action = '';
    if (likedIndex > -1) {
      // Bỏ thích
      article.interact.emoticons.splice(likedIndex, 1);
      article.totalLikes = Math.max(article.totalLikes - 1, 0);
      action = 'unlike';
    } else {
      // Thích bài viết
      article.interact.emoticons.push({
        _iduser: userId,
        typeEmoticons: 'like',
        createdAt: new Date(),
      });
      article.totalLikes += 1;
      action = 'like';
    }

    // Lưu thay đổi vào bài viết
    await article.save();

    // Phát sự kiện cập nhật likes bài viết
    emitEvent('update_article_likes', {
      postId,
      totalLikes: article.totalLikes,
      action: action,
      userId: userId,
    });

    // Tạo thông báo nếu cần
    if (action === 'like' && userId !== article.createdBy._id.toString()) {
      const displayName = user.displayName || 'Người dùng';
      
      // Lấy avatar từ MyPhoto nếu cần
      const avtLink = await getUserAvatarLink(user);
      console.log('avtLink', avtLink);
      const postLink = `http://localhost:5173/new-feeds/${postId}`;
      
      // Gửi sự kiện like
      emitEvent('like_article_notification', {
        senderId: {
          _id: userId,
          avt: [
            {
              _id: avtLink ? avtLink._id : '', // Đảm bảo rằng _id của avatar được truyền chính xác
              link: avtLink ? avtLink.link : ''  // Truyền link avatar
            }
          ],
          displayName: displayName,
        },
        postId,
        receiverId: article.createdBy._id,
        message: `${displayName} đã thích bài viết của bạn`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink,
      });

      // Lưu thông báo vào database
      const newNotification = new Notification({
        senderId: userId,
        receiverId: article.createdBy._id,
        message: `${displayName} đã thích bài viết của bạn.`,
        status: 'unread',
        createdAt: new Date(),
        link: postLink,
      });

      await newNotification.save();
    }

    return {
      action,
      totalLikes: article.totalLikes,
      article,
    };
  } catch (error) {
    console.error(`Lỗi trong quá trình xử lý like: ${error.message}`);
    throw new Error(error.message);
  }
};

const getUserAvatarLink = async (user) => {
  if (user.avt && user.avt.length > 0) {
    const avtId = user.avt[user.avt.length - 1];
    const avatar = await MyPhoto.findById(avtId);
    if (avatar && avatar.link) {
      return { _id: avatar._id, link: avatar.link }; 
    }
  }
  return { _id: '', link: '' }; 
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
