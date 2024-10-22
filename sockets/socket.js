import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173', // Địa chỉ front-end
      credentials: true // Cho phép gửi cookie qua CORS nếu cần
    }
  })

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    // Xử lý khi người dùng ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
    })
  })
}

// Hàm để phát ra sự kiện từ các nơi khác trong ứng dụng
export const emitEvent = (event, data) => {
  if (io) {
    console.log(`Emitting event: ${event}`, data) // Add a log to ensure this is being called
    io.emit(event, data) // Emit event to all connected clients
  } else {
    console.error('Socket.io is not initialized')
  }
}
