const {TimeoutError} = require("promise-socket");
const {ip,port} = require('../config/config.json');

let openSocket = (socket) => {
    
    try {
        socket.connect({ip, port});
        return socket;
    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }
}

module.exports = openSocket;