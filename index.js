require('dotenv').config()
const express = require('express')
const socketIO = require('socket.io')
const mongoose = require('mongoose')

const app = express()
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('index')
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
        const User = require('./models/user')
        const httpServer = app.listen(PORT, () => console.log(LINK_WEB))
        const io = socketIO(httpServer)

        io.on('connection', (socket) => {
            Message.find()
                .populate('user', 'username')
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
                    userId: socket.id,
                    online: true
                }
                User.findOneAndUpdate({ username }, dataUpdate)
                    .then(user => {
                        if(user) {
                            io.emit('user connected', user);

                            User.find()
                                .then(list => {
                                    console.log(list)
                                    io.emit('update user list', list);
                                })
                                .catch(e => {
                                    console.log('Can not update user list: ' + e.message);
                                });
                        }
                        else {
                            let newUser = new User({
                                username: username,
                                userId: socket.id,
                                online: true
                            })
                            newUser.save()
                                .then(u => {
                                    io.emit('user connected', u);

                                    User.find()
                                        .then(list => {
                                            io.emit('update user list', list);
                                        })
                                        .catch(e => {
                                            console.log('Can not update user list: ' + e.message);
                                        });
                                })
                                .catch(e => {
                                    console.log('Add new user failed: ' + e.message)
                                })
                        }
                        socket.emit('update username', username);
                        console.log('User connected: ' + username)
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
                User.findOneAndUpdate({ userId: socket.id }, dataUpdate)
                    .then(user => {
                        if(user) {
                            io.emit('user disconnected', user);
                            console.log('User disconnected: ' + user.username)

                            User.find()
                                .then(list => {
                                    io.emit('update user list', list);
                                })
                                .catch(e => {
                                    console.log('Can not update user list: ' + e.message);
                                });
                        }
                    })
                    .catch(e => {
                        console.log('User disconnected failed: ' + e.message)
                    })
            });

            User.find()
                .then(users => {
                    socket.emit('update user list', users);
                })
                .catch(e => {
                    console.log('Can not send user list to new client: ' + e.message);
                });
        });
    })
    .catch(e => console.log('Can not connect db server: ' + e.message))