import { friendService } from "../services/friendService.js";

const getAllFriendByIdUser = async (req, res) => {
    const userID = req.params.UserId;
    try {
      const result = await friendService.getAllFriendByIdUser(userID);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  const getSuggestAddFriend = async (req, res) => {
    const userID = req.params.UserId;
    const page = parseInt(req.query.page) || 1;
    try {
      const result = await friendService.getSuggestAddFriend(userID, page);
      res.status(200).json(result);

    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
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
    try {
      const result = await friendService.getAllFriendRequest(userID, page);
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
    const page = req.query.page;
    try {
      const result = await friendService.getMyRequest(UserId, page);
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
export const friendController = {
    getAllFriendByIdUser,
    getSuggestAddFriend,
    addFriend,
    getAllFriendRequest,
    updateSatusFriendRequest,
    getMyRequest,
    revokeInvitation
}