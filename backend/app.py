from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import (
    JWTManager,
    jwt_required,
    create_access_token,
    get_jwt_identity,
)
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json
import random
import string

app = Flask(__name__)
app.config["SECRET_KEY"] = "your-secret-key"  # Change in production
app.config["JWT_SECRET_KEY"] = "jwt-secret-key"  # Change in production
socketio = SocketIO(app, cors_allowed_origins="*")
jwt = JWTManager(app)

engine = create_engine("sqlite:///quiz.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    is_guest = Column(Integer, default=0)  # 0 for regular user, 1 for guest
    role = Column(String, default="student")  # 'teacher' or 'student'
    created_at = Column(DateTime, default=datetime.utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    creator = relationship("User")
    questions = relationship("Question", back_populates="quiz")


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    text = Column(Text)
    options = Column(Text)  # JSON string
    correct_answer = Column(String)
    time_limit = Column(Integer)  # seconds
    quiz = relationship("Quiz", back_populates="questions")


class GameSession(Base):
    __tablename__ = "game_sessions"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    pin = Column(String, unique=True)
    status = Column(String, default="waiting")  # waiting, active, finished
    leaderboard = Column(Text, default="[]")  # JSON string
    quiz = relationship("Quiz")


class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("game_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session = relationship("GameSession")
    user = relationship("User")
    question = relationship("Question")


# Helper functions
def generate_pin():
    return "".join(random.choices(string.digits, k=6))


def create_user(email=None, password=None, role="student", is_guest=0):
    hashed = generate_password_hash(password) if password else None
    user = User(email=email, password_hash=hashed, role=role, is_guest=is_guest)
    db = SessionLocal()
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def get_user_by_email(email):
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    return user


def create_quiz(creator_id, title, questions_data):
    db = SessionLocal()
    quiz = Quiz(creator_id=creator_id, title=title)
    db.add(quiz)
    db.commit()
    for q in questions_data:
        question = Question(
            quiz_id=quiz.id,
            text=q["text"],
            options=json.dumps(q["options"]),
            correct_answer=q["correct_answer"],
            time_limit=q.get("time_limit", 30),
        )
        db.add(question)
    db.commit()
    db.close()
    return quiz


def get_quizzes(user_id):
    db = SessionLocal()
    quizzes = db.query(Quiz).filter(Quiz.creator_id == user_id).all()
    db.close()
    return quizzes


def get_quiz(quiz_id):
    db = SessionLocal()
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if quiz:
        questions = db.query(Question).filter(Question.quiz_id == quiz_id).all()
        quiz.questions = questions
    db.close()
    return quiz


def start_game(quiz_id):
    pin = generate_pin()
    while True:
        db = SessionLocal()
        existing = db.query(GameSession).filter(GameSession.pin == pin).first()
        db.close()
        if not existing:
            db = SessionLocal()
            session = GameSession(quiz_id=quiz_id, pin=pin)
            db.add(session)
            db.commit()
            db.close()
            return session
        pin = generate_pin()


# Routes
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data["email"]
    password = data["password"]
    role = data.get("role", "student")
    if get_user_by_email(email):
        return jsonify({"msg": "User already exists"}), 400
    create_user(email, password, role)
    return jsonify({"msg": "User created"}), 201


@app.route("/register_guest", methods=["POST"])
def register_guest():
    user = create_user(is_guest=1)
    access_token = create_access_token(identity=user.id)
    return jsonify(access_token=access_token, user_id=user.id), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data["email"]
    password = data["password"]
    user = get_user_by_email(email)
    if (
        not user
        or not user.password_hash
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"msg": "Invalid credentials"}), 401
    access_token = create_access_token(identity=user.id)
    return jsonify(access_token=access_token), 200


@jwt_required()
@app.route("/quizzes", methods=["POST"])
def create_quiz_route():
    user_id = get_jwt_identity()
    data = request.get_json()
    title = data["title"]
    questions = data["questions"]
    create_quiz(user_id, title, questions)
    return jsonify({"msg": "Quiz created"}), 201


@jwt_required()
@app.route("/quizzes", methods=["GET"])
def get_quizzes_route():
    user_id = get_jwt_identity()
    quizzes = get_quizzes(user_id)
    return jsonify(
        [
            {"id": q.id, "title": q.title, "created_at": q.created_at.isoformat()}
            for q in quizzes
        ]
    ), 200


@jwt_required()
@app.route("/quizzes/<int:quiz_id>", methods=["GET"])
def get_quiz_route(quiz_id):
    quiz = get_quiz(quiz_id)
    if not quiz:
        return jsonify({"msg": "Quiz not found"}), 404
    questions = [
        {
            "id": q.id,
            "text": q.text,
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer,
            "time_limit": q.time_limit,
        }
        for q in quiz.questions
    ]
    return jsonify({"id": quiz.id, "title": quiz.title, "questions": questions}), 200


@jwt_required()
@app.route("/games", methods=["POST"])
def start_game_route():
    data = request.get_json()
    quiz_id = data["quiz_id"]
    session = start_game(quiz_id)
    return jsonify({"pin": session.pin, "session_id": session.id}), 201


# SocketIO events
@socketio.on("join_room")
def handle_join_room(data):
    pin = data["pin"]
    db = SessionLocal()
    session = db.query(GameSession).filter(GameSession.pin == pin).first()
    db.close()
    if not session:
        emit("error", {"msg": "Invalid PIN"})
        return
    join_room(pin)
    emit("joined", {"msg": "Joined room"})


@socketio.on("submit_answer")
def handle_submit_answer(data):
    pin = data["pin"]
    user_id = data["user_id"]
    question_id = data["question_id"]
    answer = data["answer"]
    # Record answer
    db = SessionLocal()
    answer_obj = Answer(
        session_id=data["session_id"],
        user_id=user_id,
        question_id=question_id,
        answer=answer,
    )
    db.add(answer_obj)
    db.commit()
    db.close()
    emit("answer_received", {"msg": "Answer recorded"}, to=pin)


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
