import { articleService } from '../services/articleService.js'
import Article from '../models/Article.js'
import User from '../models/User.js'
import { cloudStorageService } from '../services/cloudStorageService.js'
import { emitEvent } from '../sockets/socket.js'
import MyPhoto from '../models/MyPhoto.js'
import Notification from '../models/Notification.js' // Import Notification model
import { checkBadWords } from '../config/badWords.js'

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
    const { content, scope, hashTag, userId } = req.body;

    if (checkBadWords(content).found) {
      return res.status(400).json({
        message: 'Nội dung bài viết chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa trước khi đăng.',
      });
    }
    

    // Nếu có file thì upload, nếu không thì listPhoto sẽ là một mảng rỗng
    const listPhoto = req.files?.length > 0
      ? await Promise.all(
          req.files.map(async (file) => {
            const imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            const fileType = imageExtensions.includes(fileExtension) ? "img" : "video";

            const newPhoto = new MyPhoto({
              name: file.originalname,
              idAuthor: userId,
              type: fileType,
              link: "placeholder_link",
            });

            const savedPhoto = await newPhoto.save();
            const fileName = `v1/user/${userId}/article/${savedPhoto._id}`;
            const link = await cloudStorageService.uploadImageStorage(file, fileName);

            await MyPhoto.findByIdAndUpdate(savedPhoto._id, { link });

            return savedPhoto._id; // Trả về ObjectId của ảnh/video
          })
        )
      : [];

    // Gọi dịch vụ tạo bài viết
    const savedArticle = await articleService.createArticleService({
      content,
      listPhoto,
      scope,
      hashTag,
      userId,
    });

    // Phản hồi khi bài viết được tạo thành công
    res.status(201).json({
      message: 'Tạo bài viết thành công',
      post: savedArticle,
    });
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error);
    res.status(500).json({
      message: 'Đã xảy ra lỗi trên máy chủ. Vui lòng thử lại sau.',
      error: error.message,
    });
  }
};



const getAllArticlesWithComments = async (req, res) => {
  try {
    const userId = req.query.userId || req.user._id;
    const page = parseInt(req.query.page) || 1; // Số trang, mặc định là 1
    const limit = parseInt(req.query.limit) || 10; // Số bài viết mỗi lần tải, mặc định là 10

    if (!userId) {
      return res.status(400).json({ message: 'Thiếu userId' });
    }

    // Gọi service để lấy danh sách bài viết kèm bình luận và phân trang
    const articles = await articleService.getAllArticlesWithCommentsService(userId, page, limit);

    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

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

// const likeArticle = async (req, res) => {
//   try {
//     const { postId } = req.params;
//     const { userId } = req.body;

//     if (!postId || !userId) {
//       return res.status(400).json({ message: 'Thiếu postId hoặc userId' });
//     }


//     const article = await Article.findById(postId).populate('createdBy');
//     if (!article) {
//       return res.status(404).json({ message: 'Bài viết không tồn tại' });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'Người dùng không tồn tại' });
//     }

//     const displayName = user.displayName || 'Người dùng';
//     const avt = user.avt && user.avt.length > 0 ? user.avt[user.avt.length - 1] : '';

//     const likedIndex = article.interact.emoticons.findIndex(
//       (emoticon) =>
//         emoticon._iduser?.toString() === userId &&
//         emoticon.typeEmoticons === 'like'
//     );

//     let action = '';

//     if (likedIndex > -1) {
//       article.interact.emoticons.splice(likedIndex, 1);
//       article.totalLikes = Math.max(article.totalLikes - 1, 0);
//       action = 'unlike';
//     } else {
//       article.interact.emoticons.push({
//         _iduser: userId,
//         typeEmoticons: 'like',
//         createdAt: new Date()
//       });
//       article.totalLikes += 1;
//       action = 'like';
//     }

//     await article.save();

//     emitEvent('update_article_likes', {
//       postId,
//       totalLikes: article.totalLikes,
//       action: action,
//       userId: userId
//     });

//     // Chỉ tạo thông báo nếu userId khác với createdBy._id
//     if (action === 'like' && userId !== article.createdBy._id.toString()) {
//       const postLink = `http://localhost:5173/new-feeds/${postId}`;
//       emitEvent('like_article_notification', {
//         senderId: {
//           _id: userId,
//           avt: avt ? [avt] : [''],
//           displayName: displayName
//         },
//         postId,
//         receiverId: article.createdBy._id,
//         message: `${displayName} đã thích bài viết của bạn`,
//         status: 'unread',
//         createdAt: new Date(),
//         link: postLink
//       });

//       const newNotification = new Notification({
//         senderId: userId,
//         receiverId: article.createdBy._id,
//         message: `${displayName} đã thích bài viết của bạn.`,
//         status: 'unread',
//         createdAt: new Date(),
//         link: postLink
//       });

//       await newNotification.save();
//     }

//     return res.status(200).json({
//       message: action === 'like' ? 'Đã thích bài viết' : 'Đã bỏ thích bài viết',
//       totalLikes: article.totalLikes,
//       action: action,
//       article: article
//     });
//   } catch (error) {
//     console.error('Lỗi trong quá trình xử lý like:', error);
//     return res.status(500).json({ message: 'Đã xảy ra lỗi', error: error.message });
//   }
// };
const likeArticle = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!postId || !userId) {
      return res.status(400).json({ message: 'Thiếu postId hoặc userId' });
    }

    const result = await articleService.likeArticleService(postId, userId);

    return res.status(200).json({
      message: result.action === 'like' ? 'Đã thích bài viết' : 'Đã bỏ thích bài viết',
      totalLikes: result.totalLikes,
      action: result.action,
      article: result.article,
    });
  } catch (error) {
    console.error('Lỗi trong quá trình xử lý like:', error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi', error: error.message });
  }
};



const shareArticle = async (req, res) => {
  const { postId } = req.params;
  const { content, scope, userId } = req.body; // Lấy nội dung, phạm vi và userId từ request body

  if (content && checkBadWords(content).found) {
    return res.status(400).json({
      message: 'Nội dung bài viết chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa trước khi cập nhật.',
    });
  }
  
  try {
    // Gọi service để chia sẻ bài viết
    const sharedArticle = await articleService.shareArticleService({
      postId,
      content,
      scope,
      userId
    });

    return res.status(201).json({
      message: 'Bài viết đã được chia sẻ thành công',
      post: sharedArticle
    });
  } catch (error) {
    console.error('Lỗi khi chia sẻ bài viết:', error);
    return res.status(500).json({
      message: 'Đã xảy ra lỗi khi chia sẻ bài viết',
      error: error.message
    });
  }
};



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
    const { postId } = req.params;
    const { content, scope } = req.body;

    // Kiểm tra nội dung nhạy cảm trước khi chỉnh sửa
    if (content && checkBadWords(content).found) {
      return res.status(400).json({
        message: 'Nội dung bài viết chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa trước khi cập nhật.',
      });
    }

    // Gọi dịch vụ chỉnh sửa bài viết
    const updatedArticle = await articleService.editArticleService(postId, content, scope);

    // Phản hồi khi bài viết được chỉnh sửa thành công
    res.status(200).json({
      message: 'Chỉnh sửa bài viết thành công',
      post: updatedArticle,
    });
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa bài viết:', error);
    res.status(500).json({
      message: 'Lỗi khi chỉnh sửa bài viết',
      error: error.message,
    });
  }
};


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

const getAllArticlesOfUser = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ params
    const { profileId } = req.query; // Lấy profileId từ query params

    if (!userId || !profileId) {
      return res.status(400).json({ message: 'Thiếu userId hoặc profileId' });
    }

    // Gọi service để lấy tất cả bài viết của người dùng theo userId và profileId
    const articles = await articleService.getAllArticlesByUserService(userId, profileId);

    if (!articles || articles.length === 0) {
      return res.status(200).json({ message: 'Không có bài viết nào', data: articles });
    }

    return res.status(200).json(articles);  // Trả về danh sách bài viết
  } catch (error) {
    console.error('Lỗi khi lấy tất cả bài viết của người dùng:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getAllArticlesWithCommentsSystemWide = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Defaults to page 1
    const limit = parseInt(req.query.limit) || 10; // Defaults to 10 articles per page

    // Service call to fetch all articles system-wide
    const articles = await articleService.getAllArticlesWithCommentsSystemWideService(page, limit);

    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const approveReport = async (req, res) => {
  try {
      const { reportId } = req.params;
      const report = await articleService.approveReportService(reportId);

      res.status(200).json({
          message: "Report approved successfully.",
          report,
      });
  } catch (error) {
      console.error("Error approving report:", error.message);
      res.status(500).json({ message: error.message });
  }
};

const rejectReport = async (req, res) => {
  try {
      const { reportId } = req.params;
      const report = await articleService.rejectReportService(reportId);

      res.status(200).json({
          message: "Report rejected successfully.",
          report,
      });
  } catch (error) {
      console.error("Error rejecting report:", error.message);
      res.status(500).json({ message: error.message });
  }
};


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
  getAllArticlesOfUser,
  getAllArticlesWithCommentsSystemWide,
  approveReport,
  rejectReport
}
