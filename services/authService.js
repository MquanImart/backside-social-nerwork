import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { cloudStorageService } from './cloudStorageService.js'
import { env } from '../config/environtment.js'

// Service thực hiện logic đăng ký người dùng
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
  hobbies
}) => {
  try {
    // Kiểm tra xem email hoặc username đã tồn tại chưa
    const genderBoolean = gender === 'male' ? true : false
    const existingUser = await User.findOne({
      $or: [{ 'account.email': email }, { userName }]
    })
    if (existingUser) {
      return {
        success: false,
        message: 'Email hoặc Tên người dùng đã tồn tại.'
      }
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Tạo người dùng mới
    const newUser = new User({
      account: {
        email,
        password: hashedPassword
      },
      firstName,
      lastName,
      userName,
      details: {
        phoneNumber,
        address,
        gender: genderBoolean,
        birthDate
      },
      hobbies
    })

    const savedUser = await newUser.save()
    const userId = savedUser._id.toString()

    let avtUrl = ''
    let backGroundUrl = ''

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

    savedUser.avt = avtUrl
    savedUser.backGround = backGroundUrl
    await savedUser.save()

    return {
      success: true,
      data: {
        user: {
          id: savedUser._id,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          email: savedUser.account.email,
          userName: savedUser.userName,
          avt: savedUser.avt,
          backGround: savedUser.backGround,
          hobbies: savedUser.hobbies
        }
      }
    }
  } catch (error) {
    console.error('Error in registerService:', error.message)
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
      { expiresIn: '1h' }
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
  logoutService
}
