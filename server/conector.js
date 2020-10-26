const { default: Axios } = require("axios");
const {PromiseSocket, TimeoutError} = require("promise-socket");
const openSocket = require("./utils/openSocket");
const {getEtx,getStx} = require('./utils/utils');
const express = require('express');
const app = express();
const fs = require('fs');
let stx = getStx();
let etx = getEtx();

const writeAndReadSocket = async(dataWrite) =>{

    try {
        const socketAux = new PromiseSocket();
        const socket = openSocket(socketAux);

        await socket.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = '';

        for (let chunk; (chunk = await socket.read()); ) {
            data += chunk.toString();

            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                console.log(data);
                
                fs.appendFile('log.txt',data, function (err) {
                    if (err) return console.log(err);
                });
                data = '';
            }
        }  

    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }

} 

writeAndReadSocket("<WaWi><SCmd RequesterNumber='1' /></WaWi>");

// module.exports = app;

// await Axios.post('http://localhost:8080/geoinventarios16/rest/wsdevproductoId',{
//     "ProductoCodigoBarraId": "7791001008852",
//     "BultoIdOriginalCD": ""
// }).then(function (response) {
//     console.log(response.data);
//   })
//   .catch(function (error) {
//     console.log(error);
//   });