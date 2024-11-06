import { authService } from '../services/authService.js'
import { cloudStorageService } from '../services/cloudStorageService.js';
import User from '../models/User.js';
import PasswordResetToken from '../models/passwordResetToken.js';
import { env } from '../config/environtment.js';
import bcrypt from 'bcryptjs'
import transporter from '../config/emailConfig.js'

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

    // Kiểm tra các file
    const avtFile = req.files?.avt ? req.files.avt[0] : null;
    const backGroundFile = req.files?.backGround ? req.files.backGround[0] : null;
    const cccdFile = req.files?.cccd ? req.files.cccd[0] : null;

    console.log("Các tệp tải lên:", { avtFile, backGroundFile, cccdFile });

    if (!cccdFile) {
      console.log("Thiếu ảnh CCCD.");
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ảnh CCCD.' });
    }

    // Kiểm tra CCCD
    const { success: cccdSuccess, message: cccdMessage, birthDate, age } = await authService.checkCCCDService(cccdFile);
    console.log("Kết quả kiểm tra CCCD:", { cccdSuccess, cccdMessage, birthDate, age });

    if (!cccdSuccess) {
      return res.status(400).json({ success: false, message: cccdMessage });
    }

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
      birthDate,
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

    const cccdUrl = await cloudStorageService.uploadImageUserToStorage(cccdFile, userId, 'cccd');
    console.log("URL CCCD:", cccdUrl);

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

// Quên mật khẩu - gửi mã OTP qua email
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      otpCode,
      expiresAt,
    });

    const message = `
      <h2>Mã OTP đặt lại mật khẩu</h2>
      <p>Mã OTP của bạn là:</p>
      <h3>${otpCode}</h3>
      <p>Mã này sẽ hết hạn sau 5 phút.</p>
    `;

    await transporter.sendMail({
      from: env.EMAIL_USER,
      to: user.account.email,
      subject: 'OTP đặt lại mật khẩu',
      html: message,
    });

    res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });
  } catch (error) {
    console.error('Lỗi trong forgotPassword:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otpCode } = req.body;

  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại.' });
    }

    const tokenEntry = await PasswordResetToken.findOne({
      userId: user._id,
      otpCode,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenEntry) {
      return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    }

    res.status(200).json({ message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Lỗi trong verifyOtp:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

const resetPassword = async (req, res) => {
  const { email, otpCode, newPassword } = req.body;

  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại.' });
    }

    const tokenEntry = await PasswordResetToken.findOne({
      userId: user._id,
      otpCode,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenEntry) {
      return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.account.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    
    await PasswordResetToken.deleteOne({ _id: tokenEntry._id });

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công.' });
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
