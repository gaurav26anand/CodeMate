const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const ACTIONS = require('../code-collab/src/Actions');
const cors = require('cors');
const { c, cpp, node, python, java } = require('compile-run');

const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json())

//Compiling code for all languages
app.post("/python", (req, res) => {
    const resultPromise = python.runSource(req.body.runcode);
    resultPromise
        .then(result => {
            if (result.exitCode == 0) {
                res.json(result.stdout)
            }
            else {
                res.json('SyntaxError')
            }
        })
        .catch(err => {
            console.log(err);
        });
})
app.post("/node", (req, res) => {
    const resultPromise = node.runSource(req.body.runcode);
    resultPromise
        .then(result => {
            if (result.exitCode == 0) {
                res.json(result.stdout)
            }
            else {
                res.json('SyntaxError')
            }
        })
        .catch(err => {
            console.log(err);
        });
})
app.post("/java", (req, res) => {
    const resultPromise = java.runSource(req.body.runcode);
    resultPromise
        .then(result => {
            console.log(result);
            if (result.exitCode == 0) {
                res.json(result.stdout)
            }
            else {
                res.json('SyntaxError')
            }
        })
        .catch(err => {
            console.log(err);
        });
})
app.post("/c", (req, res) => {
    const resultPromise = c.runSource(req.body.runcode);
    resultPromise
        .then(result => {
            console.log(result);
            if (result.exitCode == 0) {
                res.json(result.stdout)
            }
            else {
                res.json('SyntaxError')
            }
        })
        .catch(err => {
            console.log(err);
        });
})
app.post("/cpp", (req, res) => {
    const resultPromise = cpp.runSource(req.body.runcode);
    resultPromise
        .then(result => {
            console.log(result);
            if (result.exitCode == 0) {
                res.json(result.stdout)
            }
            else {
                res.json('SyntaxError')
            }
        })
        .catch(err => {
            console.log(err);
        });
})

const userSocketMap = {};
// Keep latest editor state per room so new joiners get full state immediately
const roomStates = {}; // { [roomId]: { files, activeFileId, ... } }

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        }
    });
}

//Socket io connection
io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        console.log(`[JOIN] user=${username} socket=${socket.id} room=${roomId}`);
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        console.log(`[JOIN] clients in room ${roomId}:`, clients);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            })
        })

        // Send the latest room editor state to the newly joined client, if available
        const state = roomStates[roomId];
        if (state) {
            console.log(`[JOIN] sending cached state to ${socket.id}: files=${state.files ? Object.keys(state.files).length : 0}, activeFileId=${state.activeFileId}`);
            io.to(socket.id).emit(ACTIONS.CODE_CHANGE, state);
        }
    });

    //For code change - store latest state and forward to room
    socket.on(ACTIONS.CODE_CHANGE, (payload) => {
        const { roomId } = payload || {};
        if (roomId) {
            const count = payload.files ? Object.keys(payload.files).length : 0;
            console.log(`[CODE_CHANGE] room=${roomId} from=${socket.id} files=${count} activeFileId=${payload.activeFileId}`);
            roomStates[roomId] = payload; // persist latest state
            socket.in(roomId).emit(ACTIONS.CODE_CHANGE, payload);
        }
    });

    //For syncing code - also update room state if roomId provided, then send to specific socket
    socket.on(ACTIONS.SYNC_CODE, (payload) => {
        const { socketId, roomId } = payload || {};
        if (roomId) {
            const count = payload.files ? Object.keys(payload.files).length : 0;
            console.log(`[SYNC_CODE] room=${roomId} from=${socket.id} -> to=${socketId} files=${count} activeFileId=${payload.activeFileId}`);
            roomStates[roomId] = payload;
        }
        if (socketId) {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, payload);
        }
    });

    //For chat message
    socket.on('message', ({ name, message }) => {
        io.emit('message', { name, message })
    })

    //For disconnection
    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms]
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            })
        })
        delete userSocketMap[socket.id];
        socket.leave();
    })
})


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));