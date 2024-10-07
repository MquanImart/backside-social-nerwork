import User from '../models/User.js'
import mongoose from 'mongoose'

// Service để tạo bộ sưu tập mới
const createCollectionService = async (userId, name) => {
  if (!userId || !name) {
    throw new Error('User ID và tên bộ sưu tập là bắt buộc')
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new Error('Người dùng không tìm thấy')
  }

  const newCollection = {
    _id: new mongoose.Types.ObjectId(),
    name,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  user.collections.push(newCollection)
  await user.save()

  return { collection: newCollection, msg: 'Bộ sưu tập đã được tạo' }
}

// Service để chỉnh sửa bộ sưu tập
const editCollectionService = async (userId, collectionId, newName) => {
  if (!userId || !collectionId || !newName) {
    throw new Error('User ID, Collection ID và tên mới là bắt buộc')
  }

  const user = await User.findOne({ _id: userId })
  if (!user) {
    throw new Error('Người dùng không tìm thấy')
  }

  const collectionIndex = user.collections.findIndex(
    (col) => col._id.toString() === collectionId // Sử dụng _id để tìm kiếm
  )

  if (collectionIndex === -1) {
    throw new Error('Bộ sưu tập không tồn tại')
  }

  // Kiểm tra tên bộ sưu tập
  if (user.collections[collectionIndex].name === 'Tất cả mục đã lưu') {
    throw new Error(
      'Không thể chỉnh sửa bộ sưu tập mặc định "Tất cả mục đã lưu"'
    )
  }

  // Cập nhật tên bộ sưu tập và thời gian cập nhật
  user.collections[collectionIndex].name = newName
  user.collections[collectionIndex].updatedAt = new Date()
  await user.save()

  return { msg: 'Bộ sưu tập đã được chỉnh sửa' }
}

// Service để xóa bộ sưu tập
const deleteCollectionService = async (userId, collectionId) => {
  if (!userId || !collectionId) {
    throw new Error('User ID và Collection ID là bắt buộc')
  }

  const user = await User.findOne({ _id: userId })
  if (!user) {
    throw new Error('Người dùng không tìm thấy')
  }

  const collectionIndex = user.collections.findIndex(
    (col) => col._id.toString() === collectionId // Sử dụng ID để tìm kiếm
  )

  if (collectionIndex === -1) {
    console.log('Danh sách bộ sưu tập:', user.collections) // Log để kiểm tra
    throw new Error('Bộ sưu tập không tồn tại')
  }

  // Kiểm tra tên bộ sưu tập
  if (user.collections[collectionIndex].name === 'Tất cả mục đã lưu') {
    throw new Error('Không thể xóa bộ sưu tập mặc định "Tất cả mục đã lưu"')
  }

  user.collections[collectionIndex]._destroy = new Date()
  await user.save()

  return { msg: 'Bộ sưu tập đã được xóa' }
}

// Service để thêm bài viết vào bộ sưu tập
const addArticleToCollectionService = async (
  userId,
  articleId,
  collectionName
) => {
  if (!userId || !articleId || !collectionName) {
    throw new Error('User ID, Article ID và Collection Name là bắt buộc')
  }

  const user = await User.findOne({ _id: userId })
  if (!user) {
    throw new Error('Người dùng không tìm thấy')
  }

  // Tìm bộ sưu tập hiện tại chứa bài viết
  let currentCollectionName = null
  user.collections.forEach((collection) => {
    if (collection.items.includes(articleId)) {
      currentCollectionName = collection.name
    }
  })

  // Nếu bài viết đang trong bộ sưu tập hiện tại, xóa khỏi bộ sưu tập cũ
  if (currentCollectionName) {
    const currentCollection = user.collections.find(
      (col) => col.name === currentCollectionName
    )
    currentCollection.items = currentCollection.items.filter(
      (item) => item !== articleId
    )
  }

  // Thêm bài viết vào bộ sưu tập mới
  const collection = user.collections.find((col) => col.name === collectionName)
  if (!collection) {
    throw new Error('Bộ sưu tập không tồn tại')
  }

  collection.items.push(articleId)
  await user.save()

  return { msg: 'Bài viết đã được thêm vào bộ sưu tập' }
}

// Service để xóa bài viết khỏi bộ sưu tập
const removeArticleFromCollectionService = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID và Article ID là bắt buộc')
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new Error('Người dùng không tìm thấy')
  }

  // Logic để xóa bài viết khỏi tất cả bộ sưu tập
  user.collections.forEach((collection) => {
    collection.items = collection.items.filter((item) => item !== articleId)
  })

  await user.save()

  return { msg: 'Bài viết đã được xóa khỏi tất cả bộ sưu tập' }
}

export const savedService = {
  createCollectionService,
  editCollectionService,
  deleteCollectionService,
  removeArticleFromCollectionService,
  addArticleToCollectionService
}
