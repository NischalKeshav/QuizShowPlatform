export var BlankQuestionBank = {
	Title:"Example Questions",
	Author:"Blank",
	Questions:[
		{
			Question:"What is 1+1",
			CorrectAnswer: "2",
			IncorrectAnswers: ["6","7","1"],
		},
		{
			Question:"What is 1+2",
			CorrectAnswer: "3",
			IncorrectAnswers: ["6","7","1"],
		},
		{
			Question:"What is 1+3",
			CorrectAnswer: "4",
			IncorrectAnswers: ["6","7","1"],
		},
		{
			Question:"What is the capital of France?",
			CorrectAnswer: "Paris",
			IncorrectAnswers: ["London","Berlin","Madrid"],
		},
		{
			Question:"Which planet is known as the Red Planet?",
			CorrectAnswer: "Mars",
			IncorrectAnswers: ["Venus","Jupiter","Saturn"],
		},
		{
			Question:"What is 2 + 2?",
			CorrectAnswer: "4",
			IncorrectAnswers: ["3","5","22"],
		},
		{
			Question:"Which color mixes with blue to make green?",
			CorrectAnswer: "Yellow",
			IncorrectAnswers: ["Red","Black","White"],
		},
		{
			Question:"What is the largest ocean on Earth?",
			CorrectAnswer: "Pacific Ocean",
			IncorrectAnswers: ["Atlantic Ocean","Indian Ocean","Arctic Ocean"],
		},
		{
			Question:"Who wrote 'Romeo and Juliet'?",
			CorrectAnswer: "William Shakespeare",
			IncorrectAnswers: ["Charles Dickens","Jane Austen","Mark Twain"],
		},
		{
			Question:"What is the chemical symbol for water?",
			CorrectAnswer: "H2O",
			IncorrectAnswers: ["O2","CO2","NaCl"],
		}
	]
};

export const ConvertServerQuestionToClientQuestion = (QuestionObject) =>{
	return {
		Question:QuestionObject.Question,
		Choices: [...QuestionObject.IncorrectAnswers, QuestionObject.CorrectAnswer],
	}
}
