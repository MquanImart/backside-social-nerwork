import mongoose from 'mongoose';
import { env } from './environtment.js';

// Kết nối tới MongoDB
export const connectDB = async () => {
  try {
    // Kết nối MongoDB mà không sử dụng các tùy chọn deprecated
    await mongoose.connect(env.MONGODB_URI);
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error);
    throw error;
  }
};

// Đóng kết nối tới MongoDB
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('Lỗi khi đóng kết nối MongoDB:', error);
    throw error;
  }
};
