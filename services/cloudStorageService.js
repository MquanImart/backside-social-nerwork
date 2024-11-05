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
      resolve(fileUrl)
    })

    blobStream.end(file.buffer)
  })  
}

const uploadImageUserToStorage = async (file, userId, folderType) => {
  if (!file) throw new Error('No image file provided')

  // Tạo đường dẫn lưu trữ file trong folder theo userId và folderType (avatar hoặc background)
  const fileName = `user/${userId}/${folderType}/${Date.now()}_${
    file.originalname
  }`
  const fileUpload = bucket.file(fileName)


  return new Promise((resolve, reject) => {
    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: file.mimetype }
    })

    blobStream.on('error', (error) => {
      console.error('Error uploading to Cloud Storage:', error)
      reject(`Error uploading to Cloud Storage: ${error}`)
    })

    blobStream.on('finish', () => {
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`
      resolve(fileUrl)
    })

    blobStream.end(file.buffer)
  })
}

const uploadImageStorage = async (file, fileName) => {
  if (!file || !file.buffer) {
    throw new Error('No image file or file buffer provided');
  }

  const fileUpload = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: file.mimetype || 'application/octet-stream' }
    });

    blobStream.on('error', (error) => {
      console.error('Error uploading to Cloud Storage:', error);
      reject(`Error uploading to Cloud Storage: ${error}`);
    });

    blobStream.on('finish', () => {
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
      console.log('Upload successful. File URL:', fileUrl); // Kiểm tra URL trả về
      resolve(fileUrl);
    });

    blobStream.end(file.buffer);
  });
};

const deleteImageFromStorage = async (imageUrl) => {
  const filePath = imageUrl.replace(`https://storage.googleapis.com/${bucket.name}/`, '').trim();

  try {
    await bucket.file(filePath).delete();
    console.log(`Deleted file: ${filePath}`);
  } catch (error) {
    console.error(`Failed to delete file: ${filePath}`, error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const cloudStorageService = {
  uploadImageToStorage,
  uploadImageUserToStorage,
  uploadImageStorage,
  deleteImageFromStorage
}
