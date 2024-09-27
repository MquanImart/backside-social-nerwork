import express from 'express'
import { authRoute } from './authRoute.js'
import { articleRoute } from './articleRoutes.js'

const Router = express.Router()

Router.use('/auth', authRoute)
Router.use('/article', articleRoute)

export const APIs_V1 = Router
