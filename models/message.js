const mongoose = require('mongoose')
const Schema = mongoose.Schema

const MessageSchema = new Schema({
    content: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

module.exports = mongoose.model('Message', MessageSchema)