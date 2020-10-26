const net = require('net');

const {getEtx,getStx} = require('./utils');

let stx = getStx();
let etx = getEtx();
let data = '';

const writeAndReadSocketPrueba = (dataWrite) =>{

    const host = '5.88.63.78';
    const port = 9005;

    const client = new net.Socket();
    client.connect(port, host, function() {
        client.write(`${stx}${dataWrite}${etx}`);
    });
        
    return new Promise(resolve => {
        client.on('data',function(dataRead){  
            
            data = dataRead.toString();
            data = data.slice(1, -1);
            client.destroy();
            resolve(data);
        });
    }) 

}

module.exports = writeAndReadSocketPrueba;
