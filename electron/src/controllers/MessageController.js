// Controller: Handles IPC communication for messages
class MessageController {
  constructor() {
    if (!window.electronAPI) {
      console.warn('electronAPI not available');
      return;
    }
  }

  async sendMessage(message) {
    if (window.electronAPI) {
      try {
        await window.electronAPI.sendMessage(message);
        return { success: true };
      } catch (error) {
        console.error('Error sending message:', error);
        return { success: false, error };
      }
    }
    return { success: false, error: 'IPC not available' };
  }

  async getMessage() {
    if (window.electronAPI) {
      try {
        const message = await window.electronAPI.getMessage();
        return message;
      } catch (error) {
        console.error('Error getting message:', error);
        return null;
      }
    }
    return null;
  }

  async closeMessageWindow() {
    if (window.electronAPI) {
      try {
        await window.electronAPI.closeMessageWindow();
        return { success: true };
      } catch (error) {
        console.error('Error closing message window:', error);
        return { success: false, error };
      }
    }
    return { success: false, error: 'IPC not available' };
  }
}

export default MessageController;


