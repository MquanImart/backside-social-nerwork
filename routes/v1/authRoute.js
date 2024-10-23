import express from 'express'
import { authController } from '../../controllers/authController.js'
import upload from '../../middlewares/multerConfig.js'
import { verifyToken } from '../../middlewares/verifyToken.js'

const Router = express.Router()

// Route đăng nhập với user
Router.post('/login', authController.login)
// Route đăng ký với upload avatar và background
Router.post(
  '/register',
  upload.fields([
    { name: 'avt', maxCount: 1 },
    { name: 'backGround', maxCount: 1 },
    { name: 'cccd', maxCount: 1 } // CCCD field
  ]),
  authController.registerUser
)

Router.post('/logout', verifyToken, authController.logout)

// Route đăng nhập với admin
Router.post('/login-admin', authController.loginAdmin)
Router.post('/register-admin', authController.registerAdmin)

export const authRoute = Router
