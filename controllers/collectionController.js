import { collectionService } from "../services/collectionService.js"

const getAllPhotoByUserId = async (req, res) => {
    const { userId } = req.params
    try {
      const result = await collectionService.getAllPhotoByUserId(
        userId
      )
  
      return res.status(200).json(result)
    } catch (error) {
      console.error('Lỗi:', error)
      return res.status(500).json({ msg: 'Lỗi server' })
    }
  }
  const getAllNameCollection = async (req, res) => {
    const { userId } = req.params
    try {
      const result = await collectionService.getAllNameCollection(
        userId
      )
  
      return res.status(200).json(result)
    } catch (error) {
      console.error('Lỗi:', error)
      return res.status(500).json({ msg: 'Lỗi server' })
    }
  }
  export const collectionController = {
    getAllPhotoByUserId,
    getAllNameCollection
  }
  