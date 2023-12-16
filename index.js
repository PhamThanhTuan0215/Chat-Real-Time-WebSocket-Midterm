require('dotenv').config()
const express = require('express')
const socketIO = require('socket.io')
const mongoose = require('mongoose')
const bodyParser = require('body-parser');

const app = express()
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    const username = req.query.username || ''

    res.render('index', {username})
})

app.post('/private', (req, res) => {
    const { username1, username2 } = req.body

    res.render('private', { myUsername: username1, otherUsername: username2 })
})

const PORT = process.env.PORT || 3000
const { MONGODB_URI, DB_NAME } = process.env
const LINK_WEB = process.env.LINK_WEB || 'http://localhost:' + PORT
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: DB_NAME
})
    .then(() => {
        const Message = require('./models/message')
        const PrivateMessage = require('./models/private_message')
        const User = require('./models/user')
        const httpServer = app.listen(PORT, () => console.log(LINK_WEB))
        const io = socketIO(httpServer)

        io.on('connection', (socket) => {
            Message.find()
                .populate('user', 'username') // Refers to the user's username (default: _id)
                .then(messages => {
                    socket.emit('load messages', messages.map(msg => ({
                        username: msg.user.username,
                        content: msg.content
                    })));
                })
                .catch(e => {
                    console.log('Can not load all messages from server: ' + e.message)
                })

            socket.on('user connected', (username) => {
                let dataUpdate = {
                    connectionId: socket.id,
                    online: true
                }
                User.findOneAndUpdate({ username }, dataUpdate)
                    .then(user => {
                        if (user) {
                            io.emit('user connected', user);

                            updateListUser()
                        }
                        else {
                            let newUser = new User({
                                username: username,
                                connectionId: socket.id,
                                online: true
                            })
                            newUser.save()
                                .then(u => {
                                    io.emit('user connected', u);

                                    updateListUser()
                                })
                                .catch(e => {
                                    console.log('Add new user failed: ' + e.message)
                                })
                        }
                        socket.emit('update username', username);
                    })
                    .catch(e => {
                        console.log('User connect failed: ' + e.message)
                    })
            });

            socket.on('chat message', (msg, username) => {

                User.findOne({ username: username })
                    .then(user => {
                        let message = new Message({
                            content: msg,
                            user: user._id
                        })
                        message.save()
                            .then(() => {
                                io.emit('chat message', user.username, msg)
                            })
                            .catch(e => {
                                console.log('Can not save message: ' + e.message)
                            })
                    })
                    .catch(e => {
                        console.log('Identifying the user failed: ' + e.message)
                    })
            });

            socket.on('disconnect', () => {
                let dataUpdate = {
                    online: false
                }
                User.findOneAndUpdate({ connectionId: socket.id }, dataUpdate)
                    .then(user => {
                        if (user) {
                            if (user.busy) {
                                user.busy = false
                                user.save()
                            }
                            else {
                                io.emit('user disconnected', user)

                                updateListUser()
                            }
                        }
                    })
                    .catch(e => {
                        console.log('User disconnected failed: ' + e.message)
                    })
            });

            socket.on('user private connected', async (username1, username2) => {
                let dataUpdate = {
                    connectionId: socket.id,
                    online: true,
                    busy: true
                }
                const user1 = await User.findOneAndUpdate({ username: username1 }, dataUpdate)
                const user2 = await User.findOne({ username: username2 })

                updateListUser()

                PrivateMessage.find({
                    $or: [
                        {$and: [{ user1: user1 },{ user2: user2 }]},
                        {$and: [{ user1: user2 },{ user2: user1 }]}
                      ]
                })
                    .populate('user1', 'username')
                    .populate('user2', 'username')
                    .then(privateMessages => {
                        socket.emit('load private messages', privateMessages.map(msg => ({
                            username: msg.user1.username,
                            content: msg.content
                        })));
                    })
                    .catch(e => {
                        console.log('Can not load all private messages from server: ' + e.message)
                    })
            })

            socket.on('chat private message', async (msg, username1, username2) => {

                const user1 = await User.findOne({ username: username1 })
                const user2 = await User.findOne({ username: username2 })

                let privateMessage = new PrivateMessage({
                    content: msg,
                    user1: user1._id,
                    user2: user2._id
                })
                privateMessage.save()
                    .then(() => {
                        io.to(user1.connectionId).emit('chat private message', username1, msg)
                        io.to(user2.connectionId).emit('chat private message', username1, msg)
                    })
                    .catch(e => {
                        console.log('Can not save private message: ' + e.message)
                    })
            });

            User.find()
                .then(users => {

                    users.sort((user1, user2) => {
                        if (user1.online === user2.online) {
                            return user1.username.localeCompare(user2.username)
                        }
                        return user2.online - user1.online
                    });

                    socket.emit('update user list', users)
                })
                .catch(e => {
                    console.log('Can not send user list to new client: ' + e.message)
                });

            function updateListUser() {
                User.find()
                    .then(list => {
                        list.sort((user1, user2) => {
                            if (user1.online === user2.online) {
                                return user1.username.localeCompare(user2.username)
                            }
                            return user2.online - user1.online
                        });

                        io.emit('update user list', list)
                    })
                    .catch(e => {
                        console.log('Can not update user list: ' + e.message)
                    });
            }
        });
    })
    .catch(e => console.log('Can not connect db server: ' + e.message))