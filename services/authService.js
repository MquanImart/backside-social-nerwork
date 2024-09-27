import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { env } from '../config/environtment.js'

// Service đăng ký người dùng mới
export const registerService = async ({
  firstName,
  lastName,
  userName,
  email,
  password,
  confirmPassword
}) => {
  if (password !== confirmPassword) {
    throw new Error('Mật khẩu không khớp')
  }

  // Kiểm tra xem email đã tồn tại chưa
  let user = await User.findOne({ 'account.email': email })
  if (user) {
    throw new Error('Email đã tồn tại')
  }

  // Kiểm tra xem userName đã tồn tại chưa
  user = await User.findOne({ userName })
  if (user) {
    throw new Error('Tên người dùng đã tồn tại')
  }

  // Tạo người dùng mới
  user = new User({
    account: { email, password },
    firstName,
    lastName
  })

  await user.save()

  // Tạo token JWT
  const payload = { id: user._id }
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' })

  return { token, msg: 'Đăng ký thành công' }
}

// Service đăng nhập người dùng
export const loginService = async ({ email, password }) => {
  // Kiểm tra xem email có tồn tại trong cơ sở dữ liệu không
  const user = await User.findOne({ 'account.email': email })
  if (!user) {
    throw new Error('Email hoặc mật khẩu không hợp lệ')
  }

  // Kiểm tra xem mật khẩu có khớp không (ở đây bạn đang lưu mật khẩu dạng plaintext)
  if (user.account.password !== password) {
    throw new Error('Email hoặc mật khẩu không hợp lệ')
  }

  // Tạo token JWT
  const payload = { id: user._id }
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' })

  return { token, user, msg: 'Đăng nhập thành công' }
}
