class Session {
  constructor() {
    this.data = {};
    this.questions = [];
  }

  setData(data) {
    this.data = data;
  }

  addData(data) {
    this.data = { ...this.data, ...data };
  }

  getData() {
    return this.data;
  }

  addQuestion(question) {
    this.actualQuestion = question;
    this.questions.push(question);
  }

  getActualQuestion() {
    return this.actualQuestion;
  }
}

module.exports = Session;
