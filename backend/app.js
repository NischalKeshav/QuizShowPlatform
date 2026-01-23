import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import { createRoom, joinRoom, startQuiz, submitAnswer, getRoomPlayers, rooms } from './ManageGame.js';
import { ConvertServerQuestionToClientQuestion } from './QuestionBank.js';

const UserMap = new Map(); // userId -> {name, socketId}

function generateGuestId() {
  return crypto.randomUUID(); 
}

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server,{
	connectionStateRecovery: {},
	cors:{
		origin:"*",
	}
});
global.io = io; // Make io available globally for ManageGame.js

app.use(cors({
	origin: '*',          
	methods: ['GET', 'POST'],
}));

app.get('/', (req, res) => {
	res.send('api is running');
});

io.on('connection', (socket) => {
 	console.log('A user connected');

 	socket.on('create_room', (msg) => {
 		const { name } = msg;
 		const result = createRoom(socket.id, name);
 		if (result) {
 			UserMap.set(result.userId, { name, socketId: socket.id });
 			socket.emit('room_created', { roomCode: result.code, userId: result.userId });
 			console.log(`Room ${result.code} created by ${name}`);
 		}
 	});

 	socket.on('join_room', (msg) => {
 		const { roomCode, name } = msg;
 		const userId = crypto.randomUUID();
 		UserMap.set(userId, { name, socketId: socket.id });
 		const result = joinRoom(roomCode, userId, name, socket.id);
 		if (result && !result.error) {
 			socket.emit('room_joined', { roomCode, userId });
 			// Notify host of new player
 			const room = result.room;
 			io.to(room.hostSocketId).emit('player_joined', { players: getRoomPlayers(roomCode) });
 			console.log(`${name} joined room ${roomCode}`);
 		} else {
 			socket.emit('join_error', { message: result ? result.error : 'Room not found' });
 		}
 	});

 	socket.on('start_quiz', (msg) => {
 		const { roomCode } = msg;
 		console.log(`Received start_quiz for room ${roomCode} from socket ${socket.id}`);
 		if (startQuiz(roomCode)) {
 			io.to(socket.id).emit('quiz_started');
 			console.log(`Quiz started in room ${roomCode}, emitted quiz_started to ${socket.id}`);
 		} else {
 			console.log(`Failed to start quiz for room ${roomCode}`);
 		}
 	});

 	socket.on('submit_answer', (msg) => {
 		const { roomCode, userId, answerIndex } = msg;
 		if (submitAnswer(roomCode, userId, answerIndex)) {
 			console.log(`Answer submitted in room ${roomCode} by ${userId}`);
 		}
 	});

 	socket.on('get_players', (msg) => {
 		const { roomCode } = msg;
 		const players = getRoomPlayers(roomCode);
 		socket.emit('players_list', { players });
 	});

 	socket.on('rejoin_room', (msg) => {
 		const { roomCode, userId } = msg;
 		console.log(`Rejoin attempt: user ${userId} for room ${roomCode}, socket ${socket.id}`);
 		const room = rooms.get(roomCode);
 		if (room && room.players.has(userId)) {
 			// Re-add to UserMap if missing
 			UserMap.set(userId, { name: room.players.get(userId).name, socketId: socket.id });
 			room.players.get(userId).socketId = socket.id;
 			console.log(`Updated socket for user ${userId} in room ${roomCode}`);
 			// If quiz started, send current question to this socket
 			if (room.quizStarted && room.currentQuestionIndex < room.questions.length) {
 				console.log(`Sending current question to rejoined user ${userId}`);
 				const question = room.questions[room.currentQuestionIndex];
 				const clientQuestion = ConvertServerQuestionToClientQuestion(question);
 				io.to(socket.id).emit('new_question', {
 					questionIndex: room.currentQuestionIndex,
 					question: clientQuestion,
 					timeLimit: 15
 				});
 				// Also send current leaderboard
 				const leaderboard = Array.from(room.scores.entries()).sort((a, b) => b[1] - a[1]);
 				io.to(socket.id).emit('leaderboard_update', { leaderboard });
 			} else {
 				console.log(`Quiz not started or ended for room ${roomCode}`);
 			}
 			console.log(`User ${userId} rejoined room ${roomCode}`);
 		} else {
 			console.log(`Room ${roomCode} or player ${userId} not found`);
 		}
 	});

 	socket.on('disconnect', () => {
 		// Handle user disconnect, remove from UserMap and rooms if needed
 		for (const [userId, userData] of UserMap.entries()) {
 			if (userData.socketId === socket.id) {
 				UserMap.delete(userId);
 				// TODO: Remove from room if quiz not started
 				break;
 			}
 		}
 		console.log('User disconnected');
 	});
 });



server.listen(port, () => {
  console.log(`Example app listening on port ${port}`); 
});
