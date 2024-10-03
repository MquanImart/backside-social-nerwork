import express from 'express'
import { authRoute } from './authRoute.js'
import { articleRoute } from './articleRoutes.js'
import { groupRoute } from './groupRoute.js'

const Router = express.Router()

Router.use('/auth', authRoute)
Router.use('/article', articleRoute)
Router.use('/group', groupRoute)

export const APIs_V1 = Router
