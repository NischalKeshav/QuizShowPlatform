import { BlankQuestionBank, ConvertServerQuestionToClientQuestion } from './QuestionBank.js';

// Map of room codes to room objects
export const rooms = new Map();

// Room structure: { hostSocketId, players: Map(userId, {name, socketId}), currentQuestionIndex, scores: Map(name, score), answers: Map(questionIndex, Map(name, answerIndex)), quizStarted: boolean, questionTimer: timerId }

export function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

export function createRoom(hostSocketId, hostName) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    hostSocketId,
    players: new Map(), // userId -> {name, socketId}
    currentQuestionIndex: 0,
    scores: new Map(), // name -> score
    answers: new Map(), // questionIndex -> Map(name, answerIndex)
    quizStarted: false,
    questionTimer: null,
    questions: BlankQuestionBank.Questions // Use the question bank
  };

  // Add host as first player
  const hostUserId = crypto.randomUUID();
  room.players.set(hostUserId, { name: hostName, socketId: hostSocketId });

  rooms.set(code, room);
  return { code, userId: hostUserId };
}

export function joinRoom(code, userId, userName, socketId) {
  const room = rooms.get(code);
  if (!room) return null;

  if (room.quizStarted) return { error: 'Quiz has already started' };

  room.players.set(userId, { name: userName, socketId });
  return { room, userId };
}

export function startQuiz(code) {
  const room = rooms.get(code);
  if (!room || room.quizStarted) {
    console.log(`Cannot start quiz for room ${code}: room not found or already started`);
    return false;
  }

  console.log(`Starting quiz for room ${code} with ${room.players.size} players`);
  room.quizStarted = true;
  room.currentQuestionIndex = 0;
  room.scores.clear();
  room.answers.clear();

  // Send first question
  sendQuestionToRoom(code);
  return true;
}

export function sendQuestionToRoom(code) {
  const room = rooms.get(code);
  if (!room) {
    console.log(`Room ${code} not found in sendQuestionToRoom`);
    return;
  }

  const question = room.questions[room.currentQuestionIndex];
  if (!question) {
    console.log(`No question at index ${room.currentQuestionIndex} for room ${code}, quiz ended`);
    // Quiz ended
    sendLeaderboard(code);
    return;
  }

  const clientQuestion = ConvertServerQuestionToClientQuestion(question);
  console.log(`Sending question ${room.currentQuestionIndex} to room ${code}: ${question.Question}`);

  room.players.forEach((player) => {
    console.log(`Sending to player ${player.name} at socket ${player.socketId}`);
    io.to(player.socketId).emit('new_question', {
      questionIndex: room.currentQuestionIndex,
      question: clientQuestion,
      timeLimit: 15 // seconds
    });
  });

  // Start timer for auto-reveal
  room.questionTimer = setTimeout(() => {
    revealAnswers(code);
  }, 15000);
}

export function submitAnswer(code, userId, answerIndex) {
  const room = rooms.get(code);
  if (!room || !room.quizStarted) return false;

  const player = room.players.get(userId);
  if (!player) return false;

  // Store answer
  if (!room.answers.has(room.currentQuestionIndex)) {
    room.answers.set(room.currentQuestionIndex, new Map());
  }
  room.answers.get(room.currentQuestionIndex).set(player.name, answerIndex);

  // Confirm to player
  io.to(player.socketId).emit('answer_submitted', { questionIndex: room.currentQuestionIndex });

  // Check if all players answered, but for now, wait for timer
  return true;
}

export function revealAnswers(code) {
  const room = rooms.get(code);
  if (!room) return;

  const question = room.questions[room.currentQuestionIndex];
  const answers = room.answers.get(room.currentQuestionIndex) || new Map();

  // Calculate correct answers
  const correctAnswerIndex = question.IncorrectAnswers.length; // Since choices = [...incorrect, correct]
  const correctNames = [];
  answers.forEach((answerIdx, name) => {
    if (answerIdx === correctAnswerIndex) {
      correctNames.push(name);
      room.scores.set(name, (room.scores.get(name) || 0) + 1);
    }
  });

  // Send reveal to all players
  room.players.forEach((player) => {
    io.to(player.socketId).emit('reveal_answers', {
      questionIndex: room.currentQuestionIndex,
      correctAnswer: question.CorrectAnswer,
      correctNames,
      yourAnswer: answers.get(player.name)
    });
  });

  // Send updated leaderboard
  sendLeaderboard(code);

  // Move to next question after delay
  setTimeout(() => {
    room.currentQuestionIndex++;
    sendQuestionToRoom(code);
  }, 5000);
}

export function sendLeaderboard(code) {
  const room = rooms.get(code);
  if (!room) return;

  const leaderboard = Array.from(room.scores.entries()).sort((a, b) => b[1] - a[1]);

  room.players.forEach((player) => {
    io.to(player.socketId).emit('leaderboard_update', { leaderboard });
  });
}

export function getRoomPlayers(code) {
  const room = rooms.get(code);
  if (!room) return [];
  return Array.from(room.players.values()).map(p => p.name);
}

// Note: io is imported globally in app.js, but for modularity, this assumes io is available
// In app.js, we'll import and use this module