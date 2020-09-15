var parseString = require('xml2js').parseString;
const express = require('express');
const app = express();

const writeAndReadSocket = require('../utils/writeAndReadSocket');
const SCmd = require('../utils/armarXML');

app.get('/start', async(req, res) => {

    const writeData=SCmd();
    
    const data = writeAndReadSocket(writeData);

    data.then(function(data) {

        parseString(data, function(err, result) {
            let dataJsonStr = JSON.stringify(result);
            dataJsonStr = dataJsonStr.replace("$", 'Msg');
            let dataJson = JSON.parse(dataJsonStr);
    
            res.status(200).json({
                text: dataJson.WaWi.SMsg[0].Msg.Text
            });
    
        });    

    }).catch(function(err) {
        console.log(err);
    })
});

module.exports = app;