import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Admin from '../models/Admin.js'
import { cloudStorageService } from './cloudStorageService.js'
import { env } from '../config/environtment.js'
import axios from 'axios'
import FormData from 'form-data'
import mongoose from 'mongoose'
import MyPhoto from '../models/MyPhoto.js'
import { Readable } from 'stream'
import Hobby from '../models/Hobby.js'
import {emitEvent} from '../sockets/socket.js'

const bufferToStream = (buffer) => {
  const readable = new Readable()
  readable.push(buffer)
  readable.push(null)
  return readable
}

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

function parseDate(inputDate) {
  const [day, month, year] = inputDate.split('/');
  return new Date(`${year}-${month}-${day}`);
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
        ...formData.getHeaders()
      }
    })

    const data = response.data

    if (!data.data || data.data.length === 0) {
      return {
        success: false,
        message: 'Không nhận diện được thông tin từ CCCD.'
      }
    }

    const { dob: birthDate, name, sex } = data.data[0]

    if (!birthDate) {
      return {
        success: false,
        message: 'Không thể nhận diện ngày sinh trên CCCD.'
      }
    }

    const age = calculateAge(birthDate)

    if (age < 18) {
      return {
        success: false,
        message: 'Người dùng chưa đủ 18 tuổi.'
      }
    }

    return { success: true, birthDate, name, sex, age }
  } catch (error) {
    return {
      success: false,
      message: 'Lỗi khi gọi API FPT.AI.',
      error: error.message
    }
  }
}

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
    const genderBoolean = gender === 'male';
    const existingUser = await User.findOne({
      $or: [{ 'account.email': email }, { userName }]
    });

    if (existingUser) {
      return {
        success: false,
        message: 'Email hoặc Tên người dùng đã tồn tại.'
      };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newDate = parseDate(birthDate);

    // Kiểm tra và xử lý hobbies
    let hobbyIds = [];
    if (hobbies) {
      // Tách chuỗi ID thành mảng nếu là chuỗi
      if (typeof hobbies === 'string') {
        hobbyIds = hobbies.split(',').map(hobbyId => new mongoose.Types.ObjectId(hobbyId));  // Sử dụng new mongoose.Types.ObjectId()
      } else if (Array.isArray(hobbies)) {
        hobbyIds = hobbies.map(hobbyId => new mongoose.Types.ObjectId(hobbyId));  // Sử dụng new mongoose.Types.ObjectId()
      }

      // Kiểm tra xem các ID này có tồn tại trong bảng Hobby không
      const foundHobbies = await Hobby.find({ _id: { $in: hobbyIds } });
      if (foundHobbies.length !== hobbyIds.length) {
        return {
          success: false,
          message: 'Một hoặc nhiều sở thích không hợp lệ.'
        };
      }
    }

    const newUser = new User({
      account: { email, password: hashedPassword },
      firstName,
      lastName,
      userName,
      details: { phoneNumber, address, gender: genderBoolean, birthDate: newDate },
      hobbies: hobbyIds // Lưu danh sách ID của sở thích hợp lệ
    });

    const savedUser = await newUser.save();
    const userId = savedUser._id.toString();

    let avtPhoto, backGroundPhoto;

    if (avtFile) {
      const avtLink = await cloudStorageService.uploadImageUserToStorage(avtFile, userId, 'avatar');
      avtPhoto = new MyPhoto({ name: avtFile.originalname, idAuthor: userId, type: 'img', link: avtLink });
      await avtPhoto.save();
      savedUser.avt = [avtPhoto._id];
    }

    if (backGroundFile) {
      const backGroundLink = await cloudStorageService.uploadImageUserToStorage(backGroundFile, userId, 'background');
      backGroundPhoto = new MyPhoto({ name: backGroundFile.originalname, idAuthor: userId, type: 'img', link: backGroundLink });
      await backGroundPhoto.save(); 
      savedUser.backGround = [backGroundPhoto._id];
    }

    await savedUser.save(); 

    // Chuyển các ObjectId thành đối tượng có $oid cho hobbies
    const hobbyWithOid = savedUser.hobbies.map(hobbyId => ({ "$oid": hobbyId.toString() }));

    return {
      success: true,
      data: {
        user: {
          id: savedUser._id,
          firstName,
          lastName,
          email,
          userName,
          avt: avtPhoto ? avtPhoto.link : null,
          backGround: backGroundPhoto ? backGroundPhoto.link : null,
          hobbies: hobbyWithOid  // Trả lại hobbies dưới dạng [{ "$oid": "id1" }, { "$oid": "id2" }, ...]
        }
      }
    };
  } catch (error) {
    console.error("Lỗi trong service đăng ký:", error);
    return {
      success: false,
      message: 'Có lỗi xảy ra trong quá trình tạo tài khoản.',
      error: error.message
    };
  }
};


const loginService = async (email, password) => {
  try {
    const user = await User.findOne({ 'account.email': email })
    if (!user) {
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }
    if (user.status === 'locked') {
      return { success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' }
    }
    
    const isMatch = await bcrypt.compare(password, user.account.password)
    if (!isMatch) {
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }

    await User.findByIdAndUpdate(user._id, { status: 'online' });

    const token = jwt.sign(
      { id: user._id, email: user.account.email },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    )

    emitEvent(`status-user-${user._id}`, {
      _id: user._id,
      status: "online"
    });

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
    if (req.cookies.token) {
      req.res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      })
    }
    const userId = req.params.userId;
    await User.findByIdAndUpdate(userId, { status: 'active' });
    emitEvent(`status-user-${userId}`, {
      _id: userId,
      status: "active"
    });
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

const loginAdminService = async (email, password) => {
  try {
    // Tìm admin bằng email
    const admin = await Admin.findOne({ email })
    if (!admin) {
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, admin.password)
    if (!isMatch) {
      return { success: false, message: 'Email hoặc mật khẩu không đúng.' }
    }

    // Tạo JWT token với vai trò admin
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email, 
        role: 'admin' // Thêm vai trò admin vào token
      },
      env.JWT_SECRET, 
      { expiresIn: '2h' } 
    )

    return {
      success: true,
      data: {
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          role: 'admin' // Trả về thông tin vai trò admin
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

const registerAdminService = async ({ email, password }) => {
  try {
    // Kiểm tra xem admin đã tồn tại với email này chưa
    const existingAdmin = await Admin.findOne({ email })
    if (existingAdmin) {
      return { success: false, message: 'Email này đã được sử dụng.' }
    }

    // Băm mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Tạo admin mới
    const newAdmin = new Admin({
      email,
      password: hashedPassword
    })

    // Lưu admin vào cơ sở dữ liệu
    const savedAdmin = await newAdmin.save()

    return {
      success: true,
      data: {
        id: savedAdmin._id,
        email: savedAdmin.email
      },
      message: 'Đăng ký thành công.'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Có lỗi xảy ra trong quá trình đăng ký admin.',
      error: error.message
    }
  }
}

const logoutAdminService = async (req) => {
  try {
    // Xóa cookie token nếu nó tồn tại
    if (req.cookies.token) {
      req.res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      })
    }

    return {
      success: true,
      message: 'Đăng xuất admin thành công!'
    }
  } catch (error) {
    console.error('Error in logoutAdminService:', error.message)
    return {
      success: false,
      message: 'Có lỗi xảy ra khi xử lý logout admin.'
    }
  }
}

const initiatePasswordReset = async (email) => {
  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return { success: false, message: 'Email không tồn tại.', status: 404 };
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

    return { success: true, message: 'Mã OTP đã được gửi đến email của bạn.' };
  } catch (error) {
    console.error('Lỗi trong initiatePasswordReset:', error);
    throw error;
  }
};

const verifyOtpCode = async (email, otpCode) => {
  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return { success: false, message: 'Người dùng không tồn tại.', status: 404 };
    }

    const tokenEntry = await PasswordResetToken.findOne({
      userId: user._id,
      otpCode,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenEntry) {
      return { success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.', status: 400 };
    }

    return { success: true, message: 'OTP verified successfully.' };
  } catch (error) {
    console.error('Lỗi trong verifyOtpCode:', error);
    throw error;
  }
};

const resetUserPassword = async (email, otpCode, newPassword) => {
  try {
    const user = await User.findOne({ 'account.email': email });
    if (!user) {
      return { success: false, message: 'Người dùng không tồn tại.', status: 404 };
    }

    const tokenEntry = await PasswordResetToken.findOne({
      userId: user._id,
      otpCode,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenEntry) {
      return { success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.', status: 400 };
    }

    const salt = await bcrypt.genSalt(10);
    user.account.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await PasswordResetToken.deleteOne({ _id: tokenEntry._id });

    return { success: true, message: 'Đặt lại mật khẩu thành công.' };
  } catch (error) {
    console.error('Lỗi trong resetUserPassword:', error);
    throw error;
  }
};

export const authService = {
  registerService,
  loginService,
  logoutService,
  checkCCCDService,
  loginAdminService,
  registerAdminService,
  logoutAdminService,
  initiatePasswordReset,
  verifyOtpCode,
  resetUserPassword
}
