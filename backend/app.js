import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io'; 
import crypto from 'crypto'; 
import { BlankQuestionBank, ConvertServerQuestionToClientQuestion } from './QuestionBank.js';

const guests = new Map();
const UserMap = new Map();

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
	res.json({guestId: guestId, message: 'Guest Registered' });
});

io.on('connection', (socket) => {
	console.log('A user connected');
	socket.on('create_user',(msg)=>{
		const guestId = generateGuestId();
		UserMap.set(guestId,{name:msg.name,socketID:socket.id});
		console.log('New User at ',UserMap.get(guestId));
		socket.emit("user_confirmation", {UserData:UserMap.get(guestId)});
	});
});

setInterval(() => {
  io.emit('continuous_update', { message: 'update' }); 
  UserMap.forEach((UserData,UserID)=>{
	io.to(UserData.socketID).emit("question_send", ConvertServerQuestionToClientQuestion(BlankQuestionBank.Questions[0]) )
	console.log(BlankQuestionBank.Questions[0],UserData.socketID);

  })
}, 5000);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`); 
});
