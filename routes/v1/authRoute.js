import express from 'express'
import { authController } from '../../controllers/authController.js'

const Router = express.Router()

Router.post('/register', authController.register)
Router.post('/login', authController.login)
// Router.post('/refresh', authController.requestRefreshToken)
// Router.post('/forgot-password', authController.forgotPassword)

export const authRoute = Router
