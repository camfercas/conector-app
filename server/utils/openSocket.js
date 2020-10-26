const {PromiseSocket, TimeoutError} = require("promise-socket");

let openSocket = (socket) => {
    
    const host = '127.0.0.1';
    const port = 9005;
    
    try {
        socket.connect({host, port});
        return socket;
    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }
}

module.exports = openSocket;