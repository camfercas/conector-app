// Include Nodejs' net module.
const net = require('net');

const { PromiseSocket, TimeoutError } = require("promise-socket");
// The port on which the server is listening.
const port = 9005;
const ip = '5.88.63.78';
// const ip = '127.0.0.1';

var parseString = require('xml2js').parseString;

const express = require('express');
const app = express();

var client = new net.Socket();
const promiseSocket = new PromiseSocket(client);

client.connect(port, ip, function() {
    console.log('Connected');
});

let getStx = () => {

    let unicode = 2;
    let character = String.fromCharCode(unicode);
    let stx = character.toString();

    return stx;

};

let getEtx = () => {

    let unicode = 3;
    let character = String.fromCharCode(unicode);
    let etx = character.toString();

    return etx;

};

let stx = getStx();
let etx = getEtx();

app.get('/start', async(req, res) => {

    console.log(`${stx}<WaWi><SCmd RequesterNumber="1"/></WaWi>${etx}`);
    await client.write(`${stx}<WaWi><SCmd RequesterNumber="1"/></WaWi>${etx}`);

    try {

        let data = '';
    
        for (let chunk; (chunk = await promiseSocket.read()); ) {
            data += chunk.toString();
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                break;
            }
        }

        parseString(data.slice(1, -1), function(err, result) {
            let dataJsonStr = JSON.stringify(result);
            dataJsonStr = dataJsonStr.replace("$", 'Msg');
            let dataJson = JSON.parse(dataJsonStr);

            res.status(200).json({
                text: dataJson.WaWi.SMsg[0].Msg.Text
            });

        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            text: error.toString()
        });
    }

});

app.get('/stock/', async(req, res) => {

    console.log(`${stx}<WaWi><VCmd OrderNumber="1" RequesterNumber="1" BarCode="" BatchNumber="" ExternalIdCode=""/></WaWi>${etx}`);
    client.write(`${stx}<WaWi><VCmd OrderNumber="1" RequesterNumber="1" BarCode="" BatchNumber="" ExternalIdCode="" /></WaWi>${etx}`);
    client.setTimeout(5000);
    try {

        let data = '';
    
        for (let chunk; (chunk = await promiseSocket.read()); ) {
            data += chunk.toString();
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                break;
            }
        }

        parseString(data.slice(1, -1), function(err, result) {

            let dataJsonStr = JSON.stringify(result);
            dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
            let dataJson = JSON.parse(dataJsonStr);

            let cantidad = 0;
            let barcode = "";
            let resultado = [];

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

            res.status(200).json({
                resultado
            });

        });
 
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: error.toString()
        });
    }
    

});

app.get('/stock/:id', async(req, res) => {


    let id = req.params.id;

    console.log(`${stx}<WaWi><VCmd OrderNumber="2" RequesterNumber="1" BarCode="${id}" BatchNumber="" ExternalIdCode=""/></WaWi>${etx}`);
    await promiseSocket.write(`${stx}<WaWi><VCmd OrderNumber="2" RequesterNumber="1" BarCode="${id}" BatchNumber="" ExternalIdCode="" /></WaWi>${etx}`);
    // client.setTimeout(5000);
    try {

        let data = '';
    
        for (let chunk; (chunk = await promiseSocket.read()); ) {
            data += chunk.toString();
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {
                break;
            }
        }

        parseString(data.slice(1, -1), function(err, result) {
            let dataJsonStr = JSON.stringify(result);
            dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
            let dataJson = JSON.parse(dataJsonStr);

            let cantidad = 0;

            dataJson.WaWi.VMsg[0].Record.forEach(element => {
                console.log(element);
                cantidad += 1;
            });

            res.status(200).json({
                barcode: dataJson.WaWi.VMsg[0].Record[0].Msg.BarCode,
                cantidad
            });

        });

    } catch (error) {
        res.status(500).json({
            result: false,
            message: {
                text: error.toString()
            }
        });
    }

});



app.listen(3000, () => console.log(`Escuchando puerto: 3000`));