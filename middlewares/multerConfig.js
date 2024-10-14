import multer from 'multer'

// Cấu hình multer với bộ nhớ tạm thời (in-memory storage) và giới hạn kích thước file
const upload = multer({
  storage: multer.memoryStorage(), // Lưu tạm trong bộ nhớ
  limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn kích thước file là 5MB
})

// Export multer để sử dụng trong các route khác
export default upload
