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

io.on('connection', (socket) => {
	console.log('A user connected');
	socket.on('create_user',(msg)=>{
		const guestId = generateGuestId();
		UserMap.set(guestId,{name:msg.name,socketID:socket.id});
		console.log('New User at ',UserMap.get(guestId));
		socket.emit("user_confirmation", {UserID:guestId,UserData:UserMap.get(guestId)});
	});
	socket.on('reconnect_user',(msg)=>{
		console.log("reconnection");
		if (msg.UserID){
			const Switch = UserMap.get(msg.UserID);
			Switch.socketID=socket.id;
		}
	});
});

setInterval(() => {
  io.emit('continuous_update', { message: 'update' }); 
  UserMap.forEach((UserData,UserID)=>{
	io.to(UserData.socketID).emit("question_send", ConvertServerQuestionToClientQuestion(BlankQuestionBank.Questions[0]) )
		

  })
}, 5000);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`); 
});
