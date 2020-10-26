var parseString = require('xml2js').parseString;
const express = require('express');
const app = express();

const writeAndReadSocket = require('../utils/writeAndReadSocket');
const {SCmd} = require('../utils/armarXML');
const writeAndReadSocketPrueba = require('../utils/socketPrueba');

app.get('/start', async(req, res) => {

    const writeData=SCmd();
    
    // const data = writeAndReadSocket(writeData);

    const data = await writeAndReadSocketPrueba(writeData);
    console.log(data);


    parseString(data, function(err, result) {
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace("$", 'Msg');
        let dataJson = JSON.parse(dataJsonStr);

        res.status(200).json({
            text: dataJson.WaWi.SMsg[0].Msg.Text
        });

    });   

    // data.then(function(data) {

    //     parseString(data, function(err, result) {
    //         let dataJsonStr = JSON.stringify(result);
    //         dataJsonStr = dataJsonStr.replace("$", 'Msg');
    //         let dataJson = JSON.parse(dataJsonStr);
    
    //         res.status(200).json({
    //             text: dataJson.WaWi.SMsg[0].Msg.Text
    //         });
    
    //     });    

    // }).catch(function(err) {
    //     res.status(500).json({
    //         result: false,
    //         message: {
    //             text: err.toString()
    //         }
    //     }); 
    // })
});

module.exports = app;