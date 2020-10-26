const express = require('express');
const app = express();

const { default: Axios } = require("axios");
const {PromiseSocket, TimeoutError} = require("promise-socket");

const {getEtx,getStx} = require('../utils/utils');
const {VCmd} = require('../utils/armarXML');
const openSocket = require('../utils/openSocket');
var parseString = require('xml2js').parseString;

const socketAux = new PromiseSocket();
const socket = openSocket(socketAux);
let stx = getStx();
let etx = getEtx();
let VMsg = '';

const startSocket = async(dataWrite) =>{

    try {
        let data = await readSocketMsg();

        // if (data !== '') {
        //     console.log("Retorna la data");
        //     return data;
        // }
        return data;
    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }

} 

const readSocketMsg = async() => {

    let data = '';
    let dataaux = '';

    // for (let chunk; (chunk = await socket.read()); ) {
    //     data += chunk.toString();

    //     if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
    //         console.log("readSocketMsg: " + data);
    //         if(data.includes('VMsg')){
    //             Vmsg= data;
    //             dataaux = data;
    //             data = '';
    //             console.log("Hago el break");
    //             break;
    //         }
    //         data = '';
    //     }
    // }
    dataaux = await socket.read();

    return dataaux;     

}

const readSocketCmd = async(res) => {
    console.log("readSocketCmd");
    let data = '';
    socketaux = socket;
    for (let chunk; (chunk = await socketaux.read()); ) {
        data += chunk.toString();
        console.log("readSocketCmd 2");
        if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
            console.log("readSocketCmdDAta: " + data);
            res.status(200).json({
                result: true,
                data
            });
            // brea k;


        }

    }

    return data;     

}

const writeAndReadSocket = async(dataWrite) =>{

    try {
        let socketVmsg = socket;
        await socketVmsg.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = await socketVmsg.read();

        console.log("LA DATA: " + data);
        
        return data.slice(1, -1);           
    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }

} 

let parseData = (data,id) => {

    let resultado = [];
    console.log(`parseData: ${data}`);
    parseString(data, function(err, result) {
        console.log("err: " + err);
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        let dataJson = JSON.parse(dataJsonStr);

        let cantidad = 0;
        let barcode = "";

        if (dataJson.WaWi.VMsg[0].Record !== undefined){
            dataJson.WaWi.VMsg[0].Record.forEach(element => {
                if (barcode === "") {
                    barcode = element.Msg.BarCode;
                }
    
                if (barcode !== element.Msg.BarCode) {
                    resultado.push({ barcode, cantidad });
                    barcode = element.Msg.BarCode;
                    cantidad = 0;
                }
                cantidad += 1;
    
            });
    
            resultado.push({ barcode, cantidad });            
        }else{
            resultado.push({ barcode:id, cantidad:0 });  
        }


    });

    return resultado;

}

app.get('/stock/:id', async(req, res) => { 

    let id = req.params.id;

    const writeData = VCmd(id);
    const data = await writeAndReadSocket(writeData);
    console.log("LA VERDADERA DATA: " + JSON.stringify(data,3,null));
    console.log("DATA EN COSOPUM: " + data);
    let stock = parseData(data,id);
    console.log("EL STOCKKKKKKK: " + JSON.stringify(stock,3,null));
    if (stock){
        console.log("STOCK BIEN");
        // res.statussend({message: 'No blah sFound'});    
    }
    
    // data.then(function(data){
    //     console.log("DATA EN COSOPUM: " + data);
    //     let stock = parseData(data,id);
    //     console.log("EL STOCKKKKKKK: " + stock);
    //     res.send({message: 'No blah Found'});
    //     // res.status(200).json({
    //     //     result: true,
    //     //     stock
    //     // });

    // }).catch(function(err){
    //     console.log("LA VERDADERA ERROR: " + err);
    //     res.status(500).json({
    //         result: false,
    //         message: {
    //             text: err.toString()
    //         }
    //     });               
    // })

});

// app.use(require('./start'));
// app.use(require('./stock'));
// app.use(require('./bajaStock'));
module.exports = app;