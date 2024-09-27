import { registerService, loginService } from '../services/authService.js'

// Đăng ký người dùng mới
const register = async (req, res) => {
  try {
    const { token, msg } = await registerService(req.body)
    res.status(201).json({ token, msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

// Đăng nhập người dùng
const login = async (req, res) => {
  try {
    const { token, user, msg } = await loginService(req.body)
    res.status(200).json({ token, user, msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

export const authController = {
  register,
  login
}
