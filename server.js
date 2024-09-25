import express from 'express'
import exitHook from 'async-exit-hook'
import { connectDB, disconnectDB } from './config/mongodb.js'
import { env } from './config/environtment.js'
//import cookieParser from 'cookie-parser'

const START_SERVER = () => {
  const app = express()

  // Parse body và cookie
  app.use(express.json())
  //app.use(cookieParser())

  // Khởi động server
  app.listen(env.APP_PORT, env.APP_HOST, () => {
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
