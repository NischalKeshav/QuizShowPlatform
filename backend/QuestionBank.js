export var BlankQuestionBank = {
	Title:"Example Questions",
	Authour:"Blank",
	Questions:[
		{
			Question:"What is 1+1",
			CorrectAnswer: "2",
			IncorrectAnswers: ["6","7","1"],
		},
		{
			Question:"What is 1+1",
			CorrectAnswer: "2",
			IncorrectAnswers: ["6","7","1"],
		},
		{
			Question:"What is 1+1",
			CorrectAnswer: "2",
			IncorrectAnswers: ["6","7","1"],
		}
	]			
};

export const ConvertServerQuestionToClientQuestion = (QuestionObject) =>{
	return {
		Question:QuestionObject.Question,
		Choices: [...QuestionObject.IncorrectAnswers, QuestionObject.CorrectAnswer],
	}
}
