const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
    username: String,
    connectionId: String,
    online: { type: Boolean, default: false },
    busy: { type: Boolean, default: false }
})

module.exports = mongoose.model('User', UserSchema)