const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PrivateMessageSchema = new Schema({
    content: String,
    timestamp: { type: Date, default: Date.now },
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

module.exports = mongoose.model('PrivateMessage', PrivateMessageSchema)