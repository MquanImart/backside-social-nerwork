import express from 'express'
import http from 'http' // Tạo HTTP server
import exitHook from 'async-exit-hook'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import { connectDB, disconnectDB } from './config/mongodb.js'
import { env } from './config/environtment.js'
import { APIs_V1 } from './routes/v1/index.js'
import cors from 'cors' // Import cors
import { initSocket } from './sockets/socket.js'

const START_SERVER = () => {
  const app = express()

  // Tạo HTTP server từ Express app
  const server = http.createServer(app)

  // Parse body và cookie
  const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:4000'], // Cho phép nhiều địa chỉ front-end
    credentials: true // Cho phép gửi cookie qua CORS nếu cần
  };
  
  app.use(bodyParser.json({ limit: '50mb' })) // Tăng giới hạn cho JSON
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })) // Tăng giới hạn cho URL encoded

  app.use(cors(corsOptions))
  app.use(cookieParser())
  app.use(express.json())

  app.use('/v1', APIs_V1)

  // Khởi tạo socket.io
  initSocket(server) // Khởi tạo WebSocket

  // Khởi động server
  server.listen(env.APP_PORT, env.APP_HOST, () => {
    console.log(
      `3. Hi ${env.AUTHOR}, Back-end Server is running successfully at http://${env.APP_HOST}:${env.APP_PORT}/`
    )
  })

  // Xử lí khi server bị tắt
  exitHook(async () => {
    console.log('4. Server is shutting down....')
    await disconnectDB()
    console.log('5. Disconnected from MongoDB Cloud Atlas')
  })
}

// Kết nối với MongoDB và sau đó khởi động server
;(async () => {
  try {
    console.log('1. Connecting to MongoDB')
    await connectDB()
    console.log('2. Connected to MongoDB')

    // Sau khi kết nối thành công, khởi động server
    START_SERVER()
  } catch (error) {
    console.error('Error during server start-up:', error)
    process.exit(1) // Nếu lỗi, thoát ứng dụng với mã lỗi
  }
})()
