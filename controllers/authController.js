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
      userName,
      hobbies
    } = req.body

    // Get files from the request
    const avtFile = req.files?.avt ? req.files.avt[0] : null
    const backGroundFile = req.files?.backGround
      ? req.files.backGround[0]
      : null
    const cccdFile = req.files?.cccd ? req.files.cccd[0] : null

    if (!cccdFile) {
      return res
        .status(400)
        .json({ success: false, message: 'Vui lòng cung cấp ảnh CCCD.' })
    }

    // Check CCCD and user's age
    const {
      success: cccdSuccess,
      message: cccdMessage,
      birthDate,
      age
    } = await authService.checkCCCDService(cccdFile)

    if (!cccdSuccess) {
      return res.status(400).json({ success: false, message: cccdMessage })
    }

    // Age verification: must be at least 18 years old
    if (age < 18) {
      return res
        .status(400)
        .json({ success: false, message: 'Bạn chưa đủ 18 tuổi để đăng ký.' })
    }

    // Proceed with the registration if age is verified
    const registerResult = await authService.registerService({
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
      cccdFile, // Pass the CCCD file to the service
      hobbies
    })

    if (registerResult.success) {
      return res.status(201).json({
        success: true,
        message: 'Tạo tài khoản thành công!',
        user: registerResult.data.user
      })
    } else {
      return res.status(400).json({
        success: false,
        message:
          registerResult.message || 'Đăng ký thất bại: Lỗi không xác định'
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
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

const loginAdmin = async (req, res) => {
  const { email, password } = req.body
  const { success, data, message } = await authService.loginAdminService(
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

const registerAdmin = async (req, res) => {
  const { email, password } = req.body

  const response = await authService.registerAdminService({ email, password })

  if (!response.success) {
    return res.status(400).json({ message: response.message })
  }

  return res.status(201).json({
    message: response.message,
    data: response.data
  })
}

const logoutAdmin = async (req, res) => {
  try {
    const result = await authService.logoutAdminService(req)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const authController = {
  registerUser,
  loginAdmin,
  registerAdmin,
  login,
  logout,
  logoutAdmin
}
