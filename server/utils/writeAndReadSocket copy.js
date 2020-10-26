const {PromiseSocket, TimeoutError} = require("promise-socket");
const openSocket = require("./openSocket");
const {getEtx,getStx} = require('./utils');
// const {openSocket} = require('./openSocket');

let stx = getStx();
let etx = getEtx();

const writeAndReadSocket = async(dataWrite) =>{

    const host = '127.0.0.1';
    const port = 9005;

    // const socket = new PromiseSocket();
    // socket.setTimeout(15000);

    try {
        // await socket.connect({host, port});
        const socket = openSocket();

        await socket.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = '';

        for (let chunk; (chunk = await socket.read()); ) {
            data += chunk.toString();
            // console.log(data);
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                break;
            }
        }  

        await socket.end();
        data = data.slice(1, -1);
        
        return data;
    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }

} 

module.exports = writeAndReadSocket;