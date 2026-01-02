// Model: Handles message data and manipulation
class MessageModel {
  constructor() {
    this.message = null;
  }

  setMessage(message) {
    this.message = message;
  }

  getMessage() {
    return this.message;
  }

  clearMessage() {
    this.message = null;
  }
}

export default MessageModel;

