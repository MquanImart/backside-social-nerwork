import { registerService, loginService } from '../services/authService.js'
import User from '../models/User.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/environtment.js'

// Đăng ký người dùng mới
const register = async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10)
    const hashed = await bcrypt(req.body.password, salt)

    //Create user
    const newUser = await new User({
      username: req.body.username,
      email: req.body.email,
      password: hashed
    })

    // Saved to db
    const user = await newUser.save()
    res.status(200).json(user)
  } catch (err) {
    res.status(500).json({ msg: err.message })
  }
}
// const loginUser = async (req, res) => {
//   try {
//     const user = await findOne({ username: req.body.username })
//     if (!user) {
//       res.status(404).json('Sai tên đăng nhập')
//     }
//     const validPassword = await bcrypt.compare(req.body.password, user.password)
//     if (!validPassword) {
//       res.status(404).json('Sai mật khẩu')
//     }
//     if (user && validPassword) {
//       const accessToken = generateAccessToken(user)
//       const refreshToken = generateRefreshToken(user)
//       res.cookie('refreshToken', refreshToken, {
//         httpOnly: true,
//         secure: false,
//         path: '/',
//         smaeSite: 'strict'
//       })
//       const { password, ...others } = user._doc
//       res.status(200).json(...others, accessToken, refreshToken)
//     }
//   } catch (error) {
//     res.status(500).json({ msg: err.message })
//   }
// }

// Đăng nhập người dùng
const login = async (req, res) => {
  try {
    const { token, user, msg } = await loginService(req.body)
    res.status(200).json({ token, user, msg })
  } catch (err) {
    res.status(400).json({ msg: err.message })
  }
}

//GENERATE ACCESS TOKEN
// const generateAccessToken = (user) => {
//   return jwt.sign(
//     {
//       id: user.id,
//       admin: user.admin
//     },
//     env.JWT_ACCESS_KEY,
//     {
//       exipresIn: '30s'
//     }
//   )
// }
// //GENERATE REFRESH TOKEN
// const generateRefreshToken = (user) => {
//   return jwt.sign(
//     {
//       id: user.id,
//       admin: user.admin
//     },
//     env.JWT_ACCESS_KEY,
//     {
//       exipresIn: '365d'
//     }
//   )
// }

// const requestRefreshToken = async (req, res) => {
//   // take refresh token from user
//   const refreshToken = req.cookies.refreshToken
// }

//Store Soke
// 1) Local Storage
// XSS
// 2) HTTPONLY COOKIE
// CSRF --> SAMESITE
// 3) REDUX STORE --> ACCESS TOKEN
// HTTPONLY COOKIE --> REFRESH TOKEN
export const authController = {
  register,
  login
  // requestRefreshToken
}
