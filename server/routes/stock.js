var parseString = require('xml2js').parseString;
const express = require('express');
const app = express();

const writeAndReadSocket = require('../utils/writeAndReadSocket');

let parseData = (data,id) => {

    let resultado = [];
    
    parseString(data, function(err, result) {

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

app.get('/stock/', async(req, res) => {

    const writeData = `<WaWi><VCmd OrderNumber="2" RequesterNumber="1" BarCode="" BatchNumber="" ExternalIdCode="" /></WaWi>`

    const data = writeAndReadSocket(writeData);

    data.then(function(data){

        let stock = parseData(data,"");

        res.status(200).json({
            result: true,
            stock
        });

    }).catch(function(err){
        res.status(500).json({
            result: false,
            message: {
                text: error.toString()
            }
        });        
    })
    

});

app.get('/stock/:id', async(req, res) => {

    let id = req.params.id;

    const writeData = `<WaWi><VCmd OrderNumber="2" RequesterNumber="1" BarCode="${id}" BatchNumber="" ExternalIdCode="" /></WaWi>`

    const data = writeAndReadSocket(writeData);

    data.then(function(data){

        let [stock] = parseData(data,id);

        res.status(200).json({
            result: true,
            stock
        });

    }).catch(function(err){
        res.status(500).json({
            result: false,
            message: {
                text: error.toString()
            }
        });        
    })

});

module.exports = app;