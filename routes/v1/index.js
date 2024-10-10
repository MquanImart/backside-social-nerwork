import express from 'express'
import { authRoute } from './authRoute.js'
import { articleRoute } from './articleRoutes.js'
import { messagesRoute } from './messagesRoutes.js'

const Router = express.Router()

Router.use('/auth', authRoute)
Router.use('/article', articleRoute)
Router.use('/messages', messagesRoute)

export const APIs_V1 = Router
