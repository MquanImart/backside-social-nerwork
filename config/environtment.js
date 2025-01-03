import 'dotenv/config'

export const env = {
  MONGODB_URI: process.env.MONGODB_URI,
  DATABASE_NAME: process.env.DATABASE_NAME,

  APP_HOST: process.env.APP_HOST,
  APP_PORT: process.env.APP_PORT,

  BUILD_MODE: process.env.BUILD_MODE,
  AUTHOR: process.env.AUTHOR,

  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,

  PROJECT_ID: process.env.PROJECT_ID,
  BUCKET_NAME: process.env.BUCKET_NAME,
  KEYFILENAME: process.env.KEYFILENAME,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_KEY: process.env.JWT_ACCESS_KEY,
  JWT_REFRESH_KEY: process.env.JWT_REFRESH_KEY,

  API_ENDPOINT_CCCD: process.env.API_ENDPOINT_CCCD,
  API_KEY_CCCD: process.env.API_KEY_CCCD,

  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  CLIENT_URL: process.env.CLIENT_URL
}
