import express from 'express'
import { authRoute } from './authRoute.js'
import { articleRoute } from './articleRoutes.js'
import { groupRoute } from './groupRoute.js'
import { savedRoute } from './savedRoute.js'
import { userRoute } from './userRoute.js'
import { messagesRoute } from './messagesRoutes.js'
import { notificationRoute } from './notificationRoute.js'
import { verifyToken } from '../..//middlewares/verifyToken.js'

const Router = express.Router()

Router.use('/auth', authRoute)
Router.use('/article', verifyToken, articleRoute)
Router.use('/group', verifyToken, groupRoute)
Router.use('/saved', verifyToken, savedRoute)
Router.use('/user', verifyToken, userRoute)
Router.use('/messages', verifyToken, messagesRoute)
Router.use('/notifications', verifyToken, notificationRoute)

export const APIs_V1 = Router
