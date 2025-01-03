import mongoose from 'mongoose'

const hobbySchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  _destroy: Date
})

const Hobby = mongoose.model('Hobby', hobbySchema)

export default Hobby
