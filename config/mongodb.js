import mongoose from 'mongoose'
import { env } from './environtment.js'
// Kết nối tới MongoDB
export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    console.log('Kết nối thành công tới MongoDB')
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error)
    throw error
  }
}
// Đóng kết nối tới MongoDB
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect()
    console.log('Đã đóng kết nối với MongoDB')
  } catch (error) {
    console.error('Lỗi khi đóng kết nối MongoDB:', error)
    throw error
  }
}
