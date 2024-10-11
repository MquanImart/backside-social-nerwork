// import jwt from 'jsonwebtoken'
// import { env } from '../config/environtment.js'

// const verifyToken = async (req, res, next) => {
//   const token = req.headers.token
//   if (token) {
//     // Bearer 1231232312312123123
//     const accessToken = token.split(' ')[1]
//     jwt.verify(accessToken, env.JWT_ACCESS_KEY, (err, user) => {
//       if (err) {
//         res.status(403).json('Token is not valid')
//       }
//       req.user = user
//       next()
//     })
//   } else {
//     res.status(401).json('You are not authenticated')
//   }
// }

// const verifyTokenAndAdminAuth = async (req, res, next) => {
//   verifyToken(req, res, () => { w
//     if (req.user.id == req.params.id || req.user.admin) {
//       next()
//     } else {
//       res.status(403).json('Không có quyền')
//     }
//   })
// }

// export const authMiddlewares = {
//   verifyToken
// }
