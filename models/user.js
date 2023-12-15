const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
    username: String,
    userId: String,
    online: { type: Boolean, default: false }
})

module.exports = mongoose.model('User', UserSchema)