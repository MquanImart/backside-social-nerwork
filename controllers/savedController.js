import { savedService } from '../services/savedService.js'

// Tạo bộ sưu tập mới
const createCollection = async (req, res) => {
  const { userId, name } = req.body

  try {
    const { collection, msg } = await savedService.createCollectionService(
      userId,
      name
    )
    res.status(201).json({ collection, msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

// Chỉnh sửa bộ sưu tập
const deleteCollection = async (req, res) => {
  const { userId } = req.body
  const { collectionId } = req.params

  try {
    const { msg } = await savedService.deleteCollectionService(
      userId,
      collectionId
    )
    res.status(200).json({ msg })
  } catch (err) {
    res.status(400).json({ msg: err.message }) // Gửi thông báo lỗi về client
  }
}

// Chỉnh sửa bộ sưu tập
const editCollection = async (req, res) => {
  const { userId } = req.body
  const { collectionId } = req.params
  const { newName } = req.body

  try {
    const { msg } = await savedService.editCollectionService(
      userId,
      collectionId,
      newName
    )
    res.status(200).json({ msg })
  } catch (err) {
    res.status(400).json({ msg: err.message }) // Gửi thông báo lỗi về client
  }
}

// Xóa bài viết khỏi bộ sưu tập
const removeArticleFromCollection = async (req, res) => {
  const { articleId } = req.params
  const { userId } = req.body

  try {
    const msg = await savedService.removeArticleFromCollectionService(
      userId,
      articleId
    )
    res.status(200).json({ msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

// Thêm bài viết vào bộ sưu tập
const addArticleToCollection = async (req, res) => {
  const { articleId, collectionId } = req.params
  const { userId } = req.body

  try {
    const msg = await savedService.addArticleToCollectionService(
      userId,
      articleId,
      collectionId
    )
    res.status(200).json({ msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

export const savedController = {
  createCollection,
  editCollection,
  deleteCollection,
  removeArticleFromCollection,
  addArticleToCollection
}
