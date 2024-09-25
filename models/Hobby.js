const mongoose = require('mongoose')

const hobbySchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  _destroy: Date
})

module.exports = mongoose.model('Hobby', hobbySchema)
