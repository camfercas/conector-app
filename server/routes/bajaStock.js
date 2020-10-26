const express = require('express');
const app = express();
const parseString = require('xml2js').parseString;

const writeAndReadSocket = require('../utils/writeAndReadSocket');
const {ACmd} = require('../utils/armarXML');

let parseData = (data,id) => {

    let dataJson = '';
    
    parseString(data, function(err, result) {

        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        dataJson = JSON.parse(dataJsonStr);
        
    });
    
    return dataJson;
    
}

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

app.get('/baja/:id', async(req, res) => {

    let id = req.params.id;

    let orderNumber = Math.floor(Math.random() * 100000000);

    const writeData = ACmd(1,orderNumber,id,1);
    const data = writeAndReadSocket(writeData);

    data.then(function(data){

        let stock = parseData(data,id);

        res.status(200).json({
            result: true,
            stock
        });

    }).catch(function(err){
        res.status(500).json({
            result: false,
            message: {
                text: err.toString()
            }
        });             
    })

});

module.exports = app;