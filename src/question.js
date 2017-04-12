class Question {
  constructor(question, expectedResponse, successFunc) {
    this.question = question;
    this.expectedResponse = expectedResponse;
    this.successFunc = successFunc;
  }

  getText() {
    return this.question;
  }

  verify(response) {
    return !!response.match(this.expectedResponse);
  }

  applyResponse(data, response) {
    return this.successFunc(data, response);
  }
}

module.exports = Question;
