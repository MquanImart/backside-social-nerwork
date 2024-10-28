import mongoose from 'mongoose'
import MyPhoto from '../models/MyPhoto.js'
import User from '../models/User.js'

// Hàm để lấy tất cả img và video của user theo id
const getAllPhotoByUserId = async (userId) => {
    const result = {
        img: [],
        video: [],
    }
    const allPhoto = await MyPhoto.find({idAuthor: userId})

    allPhoto.map((photo)=> {
        if (photo.type === 'img'){
            result.img.push(photo);
        } else{
            result.video.push(photo);
        }
    })
    return result;
}
//Hàm lấy tên tất cả bộ sưu tập theo user id
const getAllNameCollection = async (userId) => {

    const user = await User.findById(userId)

    if (!user) {
        throw new Error('Người dùng không tồn tại')
      }

      const activeCollections = user.collections.filter(collection => !collection._destroy);

      return activeCollections;
}

export const collectionService = {
    getAllPhotoByUserId,
    getAllNameCollection,
}
