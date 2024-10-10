import { Storage } from '@google-cloud/storage'
import { env } from '../config/environtment.js'

const storage = new Storage({
  projectId: env.PROJECT_ID,
  keyFilename: env.KEYFILENAME
})

const bucket = storage.bucket(env.BUCKET_NAME)

// Hàm tải ảnh lên Google Cloud Storage
const uploadImageToStorage = async (file) => {
  if (!file) throw new Error('No image file provided')
  const fileName = `${Date.now()}_${file.originalname}`
  const fileUpload = bucket.file(fileName)

  console.log('Uploading file:', fileName) // Log tên file đang upload

  return new Promise((resolve, reject) => {
    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: file.mimetype }
    })

    blobStream.on('error', (error) => {
      console.error('Error uploading to Cloud Storage:', error)
      reject(`Error uploading to Cloud Storage: ${error}`)
    })

    blobStream.on('finish', () => {
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}     `
      console.log('File uploaded successfully:', fileUrl) // Log URL sau khi upload thành công
      resolve(fileUrl)
    })

    blobStream.end(file.buffer)
  })
}

export const cloudStorageService = {
  uploadImageToStorage
}
