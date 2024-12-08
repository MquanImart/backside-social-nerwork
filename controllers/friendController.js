import { friendService } from "../services/friendService.js";

const getAllFriendByIdUser = async (req, res) => {
    const userID = req.params.UserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
      const result = await friendService.getAllFriendByIdUser(userID, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  const getSuggestAddFriend = async (req, res) => {
    const userID = req.params.UserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
      const result = await friendService.getSuggestAddFriend(userID, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách đề xuất' });
    }
  };
  const addFriend = async (req, res) => {
    const senderId = req.params.UserId;
    const receiverId = req.query.receiverId;
    try {
      const result = await friendService.addFriend(senderId, receiverId);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  const getAllFriendRequest = async (req, res) => {
    const userID = req.params.UserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
      const result = await friendService.getAllFriendRequest(userID, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };
  const updateSatusFriendRequest = async (req, res) => {
    const RequestId = req.params.RequestId;
    const status = req.query.status;
    try {
      const result = await friendService.updateSatusFriendRequest(RequestId, status);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };
  const getMyRequest = async (req, res) => {
    const UserId = req.params.UserId;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    try {
      const result = await friendService.getMyRequest(UserId, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };
  const revokeInvitation = async (req, res) => {
    const RequestId = req.params.RequestId;
    try {
      const result = await friendService.revokeInvitation(RequestId);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  const unFriend = async (req, res) => {
    const { userId } = req.params
    const friendId = req.query.friendId;
    try {
      const result = await friendService.unFriend(
        userId,
        friendId
      )
  
      return res.status(200).json(result)
    } catch (error) {
      console.error('Lỗi:', error)
      return res.status(500).json({ msg: 'Lỗi server' })
    }
  }
  const getFriendSuggestions = async (req, res) => {
    const userID = req.params.UserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
      const result = await friendService.getFriendSuggestions(userID, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách đề xuất' });
    }
  };
export const friendController = {
    getAllFriendByIdUser,
    getSuggestAddFriend,
    addFriend,
    getAllFriendRequest,
    updateSatusFriendRequest,
    getMyRequest,
    revokeInvitation,
    unFriend,
    getFriendSuggestions
}