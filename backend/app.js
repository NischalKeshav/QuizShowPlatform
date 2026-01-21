import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io'; 
import crypto from 'crypto'; 
import { BlankQuestionBank, ConvertServerQuestionToClientQuestion } from './QuestionBank';

const guests = new Map();

function generateGuestId() {
  return crypto.randomUUID(); 
}

const app = express();
const port = 3000;

const server = http.createServer(app);
const io = new Server(server,{
	connectionStateRecovery: {},
	cors:{
		origin:"*",
	}
}); 
app.use(cors({
	origin: '*',          
	methods: ['GET', 'POST'],
}));

app.get('/', (req, res) => {
	res.send('api is running');
});


app.post('/register_guest', (req,res)=>{
	const guestId = generateGuestId();
	guests.set(guestId, null);
	res.json({ guestId, message: 'Guest Registered' });

});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join_guest', (guestId) => {
        if (guests.has(guestId)) {
            socket.join(guestId); 

            guests.set(guestId, socket.id); // Keep the map entry for tracking
            socket.guestId = guestId; // Attach guestId to socket object for easy access on disconnect

            console.log(`Guest ${guestId} joined with socket ${socket.id} and joined room ${guestId}`);
            
            socket.emit('joined_successfully', { guestId });
        } else {
            socket.emit('error_message', 'Invalid Guest ID');
        }
    });

    socket.on('disconnect', () => {
 		console.log('User disconnected');
        if (socket.guestId) {
            guests.set(socket.guestId, null);
        }
    });
});

setInterval(() => {
  guests.forEach((socketId, guestId) => {
    if (socketId) {
      io.to(socketId).emit('continuous_update', { message: `Update for ${guestId} at ${new Date().toISOString()}` });
    }
  });
}, 5000);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

