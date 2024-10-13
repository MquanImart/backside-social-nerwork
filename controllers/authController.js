import { authService } from '../services/authService.js'

// Controller xử lý đăng ký
const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      address,
      gender,
      birthDate,
      userName,
      hobbies
    } = req.body

    // Lấy file avatar và background từ req.files
    const avtFile = req.files?.avt ? req.files.avt[0] : null
    const backGroundFile = req.files?.backGround
      ? req.files.backGround[0]
      : null

    // Gọi service để thực hiện logic đăng ký
    const { success, data, message, error } = await authService.registerService(
      {
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
      }
    )

    if (success) {
      return res.status(201).json({
        success,
        message: 'Tạo tài khoản thành công!',
        user: data.user
      })
    } else {
      return res.status(400).json({ success, message, error })
    }
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi máy chủ. Không thể tạo tài khoản.',
      error: error.message
    })
  }
}

// Controller xử lý đăng nhập
const login = async (req, res) => {
  const { email, password } = req.body
  const { success, data, message } = await authService.loginService(
    email,
    password
  )

  if (success) {
    return res.status(200).json({
      success,
      token: data.token,
      user: data.user
    })
  } else {
    return res.status(400).json({ success, message })
  }
}

const logout = async (req, res) => {
  try {
    // Gọi service để xử lý việc logout
    const result = await authService.logoutService(req)

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message
      })
    } else {
      return res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra.'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra trong quá trình đăng xuất.'
    })
  }
}
export const authController = {
  registerUser,
  login,
  logout
}
