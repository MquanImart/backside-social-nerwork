import mongoose from 'mongoose'
import validator from 'validator'

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function (value) {
        return validator.isEmail(value)
      },
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    validate: {
      validator: function (value) {
        return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/.test(value)
      },
      message:
        'Password must include uppercase, lowercase, number, and special character'
    }
  }
})

const Admin = mongoose.model('Admin', adminSchema)

export default Admin
