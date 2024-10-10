import express from 'express'
import { authRoute } from './authRoute.js'
import { articleRoute } from './articleRoutes.js'
import { groupRoute } from './groupRoute.js'
import { savedRoute } from './savedRoute.js'
import { userRoute } from './userRoute.js'
import { messagesRoute } from './messagesRoutes.js'

const Router = express.Router()

Router.use('/auth', authRoute)
Router.use('/article', articleRoute)
Router.use('/group', groupRoute)
Router.use('/saved', savedRoute)
Router.use('/user', userRoute)
Router.use('/messages', messagesRoute)

export const APIs_V1 = Router
