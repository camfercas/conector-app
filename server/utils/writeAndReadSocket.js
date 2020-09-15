const { PromiseSocket } = require("promise-socket");
const {getEtx,getStx} = require('./utils');

let stx = getStx();
let etx = getEtx();

const writeAndReadSocket = async(dataWrite) =>{

    try {
    
        const host = '5.88.63.78';
        const port = 9005;
    
        const socket = new PromiseSocket();

        await socket.connect({host, port});
        await socket.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = '';
    
        for (let chunk; (chunk = await socket.read()); ) {
            data += chunk.toString();
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                break;
            }
        }    
        await socket.end();
        data = data.slice(1, -1);
        
        return data;
      } catch (e) {
        console.error("Connection error:", e);
        return e;
      }

} 

module.exports = writeAndReadSocket;