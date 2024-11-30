import { authService } from '../services/authService.js'
import { cloudStorageService } from '../services/cloudStorageService.js';

// Controller xử lý đăng ký
const registerUser = async (req, res) => {
  try {
    console.log("Dữ liệu yêu cầu:", req.body);

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
    } = req.body;

    const avtFile = req.files?.avt ? req.files.avt[0] : null;
    const backGroundFile = req.files?.backGround ? req.files.backGround[0] : null;
    const cccdFile = req.files?.cccd ? req.files.cccd[0] : null;

    // Kiểm tra ảnh CCCD
    if (!cccdFile) {
      console.log("Thiếu ảnh CCCD.");
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ảnh CCCD.' });
    }

    // Gọi dịch vụ checkCCCD để lấy thông tin từ CCCD
    const { success: cccdSuccess, message: cccdMessage, birthDate, age } = await authService.checkCCCDService(cccdFile);
    if (!cccdSuccess) {
      return res.status(400).json({ success: false, message: cccdMessage });
    }

    // Kiểm tra tuổi
    if (age < 18) {
      console.log("Tuổi không đủ 18:", age);
      return res.status(400).json({ success: false, message: 'Bạn chưa đủ 18 tuổi để đăng ký.' });
    }

    const registerResult = await authService.registerService({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      address,
      gender,
      birthDate,  // Gán ngày sinh từ CCCD
      userName,
      avtFile,
      backGroundFile,
      hobbies
    });

    console.log("Kết quả đăng ký:", registerResult);

    if (!registerResult.success) {
      return res.status(400).json({
        success: false,
        message: registerResult.message || 'Đăng ký thất bại: Lỗi không xác định'
      });
    }

    const userId = registerResult.data.user.id;

    // Upload ảnh CCCD và gán vào URL
    const cccdUrl = await cloudStorageService.uploadImageUserToStorage(cccdFile, userId, 'cccd');
    console.log("URL CCCD:", cccdUrl);

    // Trả về thông tin người dùng đăng ký thành công
    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản thành công!',
      user: { ...registerResult.data.user, cccdUrl }
    });
  } catch (error) {
    console.error("Lỗi trong quá trình đăng ký:", error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ. Không thể tạo tài khoản.',
      error: error.message,
      stack: error.stack
    });
  }
};

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

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const result = await authService.initiatePasswordReset(email);
    return res.status(result.success ? 200 : result.status).json({
      message: result.message,
    });
  } catch (error) {
    console.error('Lỗi trong forgotPassword:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otpCode } = req.body;
  try {
    const result = await authService.verifyOtpCode(email, otpCode);
    return res.status(result.success ? 200 : result.status).json({
      message: result.message,
    });
  } catch (error) {
    console.error('Lỗi trong verifyOtp:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

const resetPassword = async (req, res) => {
  const { email, otpCode, newPassword } = req.body;
  try {
    const result = await authService.resetUserPassword(email, otpCode, newPassword);
    return res.status(result.success ? 200 : result.status).json({
      message: result.message,
    });
  } catch (error) {
    console.error('Lỗi trong resetPassword:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

export const authController = {
  registerUser,
  loginAdmin,
  registerAdmin,
  login,
  logout,
  logoutAdmin,
  forgotPassword,
  verifyOtp,
  resetPassword
}
