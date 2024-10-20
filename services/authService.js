import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { cloudStorageService } from './cloudStorageService.js'
import { env } from '../config/environtment.js'
import axios from 'axios'
import FormData from 'form-data'
import { Readable } from 'stream'

// Convert buffer to readable stream
const bufferToStream = (buffer) => {
  const readable = new Readable()
  readable.push(buffer)
  readable.push(null) // No more data to read
  return readable
}
// Calculate age based on birthDate
const calculateAge = (birthDate) => {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

const checkCCCDService = async (cccdFile) => {
  try {
    const API_ENDPOINT = env.API_ENDPOINT_CCCD
    const API_KEY = env.API_KEY_CCCD

    const formData = new FormData()
    formData.append(
      'image',
      bufferToStream(cccdFile.buffer),
      cccdFile.originalname
    )

    const response = await axios.post(API_ENDPOINT, formData, {
      headers: {
        api_key: API_KEY,
        ...formData.getHeaders() // Automatically set the form headers
      }
    })

    const data = response.data
    console.log('API Response:', data) // Log the API response for debugging

    if (!data.data || data.data.length === 0) {
      return {
        success: false,
        message: 'Không nhận diện được thông tin từ CCCD.'
      }
    }

    // Extract relevant information from API response
    const { dob: birthDate, name, sex } = data.data[0]

    if (!birthDate) {
      return {
        success: false,
        message: 'Không thể nhận diện ngày sinh trên CCCD.'
      }
    }

    const age = calculateAge(birthDate)

    // Check if the person is at least 18 years old
    if (age < 18) {
      return {
        success: false,
        message: 'Người dùng chưa đủ 18 tuổi.'
      }
    }

    // Optionally, you can verify the name and gender matches the user input
    return { success: true, birthDate, name, sex, age }
  } catch (error) {
    console.error(
      'API Error:',
      error.response ? error.response.data : error.message
    )
    return {
      success: false,
      message: 'Lỗi khi gọi API FPT.AI.',
      error: error.message
    }
  }
}

// Service for user registration
const registerService = async ({
  firstName,
  lastName,
  email,
  password,
  phoneNumber,
  address,
  gender,
  birthDate,
  userName,
  avtFile,
  backGroundFile,
  cccdFile,
  hobbies
}) => {
  try {
    const genderBoolean = gender === 'male'
    const existingUser = await User.findOne({
      $or: [{ 'account.email': email }, { userName }]
    })

    if (existingUser) {
      return {
        success: false,
        message: 'Email hoặc Tên người dùng đã tồn tại.'
      }
    }

    // Call checkCCCDService to verify CCCD and check the user's age
    const {
      success,
      message,
      age,
      birthDate: dob
    } = await checkCCCDService(cccdFile)
    if (!success) {
      return { success: false, message } // Return error from CCCD check
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const newUser = new User({
      account: { email, password: hashedPassword },
      firstName,
      lastName,
      userName,
      details: { phoneNumber, address, gender: genderBoolean, birthDate: dob },
      hobbies
    })

    const savedUser = await newUser.save()
    const userId = savedUser._id.toString()

    let avtUrl = ''
    let backGroundUrl = ''
    let cccdUrl = ''

    // Upload avatar, background, and CCCD files
    if (avtFile) {
      avtUrl = await cloudStorageService.uploadImageUserToStorage(
        avtFile,
        userId,
        'avatar'
      )
    }
    if (backGroundFile) {
      backGroundUrl = await cloudStorageService.uploadImageUserToStorage(
        backGroundFile,
        userId,
        'background'
      )
    }
    if (cccdFile) {
      cccdUrl = await cloudStorageService.uploadImageUserToStorage(
        cccdFile,
        userId,
        'cccd'
      )
    }

    savedUser.avt = avtUrl
    savedUser.backGround = backGroundUrl
    savedUser.cccdUrl = cccdUrl // Store the CCCD URL
    await savedUser.save()

    return {
      success: true,
      data: {
        user: {
          id: savedUser._id,
          firstName,
          lastName,
          email,
          userName,
          avt: avtUrl,
          backGround: backGroundUrl,
          cccdUrl, // Include CCCD URL in the response
          hobbies
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Có lỗi xảy ra trong quá trình tạo tài khoản.',
      error: error.message
    }
  }
}

// Service xử lý logic đăng nhập
const loginService = async (email, password) => {
  try {
    const user = await User.findOne({ 'account.email': email })
    if (!user) {
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }

    const isMatch = await bcrypt.compare(password, user.account.password)
    if (!isMatch) { 
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }

    const token = jwt.sign(
      { id: user._id, email: user.account.email },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    )

    return {
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          displayName: user.displayName,
          avt: user.avt,
          email: user.account.email
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Có lỗi xảy ra trong quá trình đăng nhập.',
      error: error.message
    }
  }
}

const logoutService = async (req) => {
  try {
    // Kiểm tra xem token đang được lưu ở đâu, ví dụ trong cookie
    if (req.cookies.token) {
      // Xóa cookie chứa token nếu có
      req.res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      })
    }

    // Nếu token được lưu trong localStorage phía client, bạn chỉ cần gửi phản hồi thành công
    return {
      success: true,
      message: 'Đăng xuất thành công!'
    }
  } catch (error) {
    console.error('Error in logoutService:', error.message)
    return {
      success: false,
      message: 'Có lỗi xảy ra khi xử lý logout.'
    }
  }
}

export const authService = {
  registerService,
  loginService,
  logoutService,
  checkCCCDService
}
