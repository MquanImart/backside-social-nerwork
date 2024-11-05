import express from 'express'
import { hobbyController } from '../../controllers/hobbyController.js'

const Router = express.Router()

// Route lấy thông tin user bằng id
Router.get('/', hobbyController.getAllHobby)

export const hobbyRoute = Router
