import express from 'express'
import { collectionController } from '../../controllers/collectionController.js'

const Router = express.Router()

// Route lấy thông tin user bằng id
Router.get('/photo/:userId', collectionController.getAllPhotoByUserId)
Router.get('/name/:userId', collectionController.getAllNameCollection)

export const collectionRoute = Router
