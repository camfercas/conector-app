const express = require('express');
const app = express();
var bodyParser = require('body-parser')

const { default: Axios } = require("axios");

const {PromiseSocket, TimeoutError} = require("promise-socket");
const openSocket = require("../utils/openSocket");

const getBarcode = require('../utils/getMod10digit');
const {getEtx,getStx} = require('../utils/utils');
const {VCmd,ICmd,PCmd,ACmd} = require('../utils/armarXML');
const fs = require('fs');
var parseString = require('xml2js').parseString;

let stx = getStx();
let etx = getEtx();

const socketAux = new PromiseSocket();
const socket = openSocket(socketAux);

const writeAndReadSocket = async(dataWrite) =>{

    try {
        await socket.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = '';

        for (let chunk; (chunk = await socket.read()); ) {
            data += chunk.toString();

            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {

                if(data.includes("VMsg") || data.includes("AMsg")){
                    fs.appendFile('log.txt',data, function (err) {
                        if (err) return console.log(err);
                    });
                }else{
                    console.log(data);
                    if(data.includes("IMsg")){
                        
                        let {orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,state,text} = parseDataIMsg(data.slice(1,-1));
                        
                        if (parseInt(state) <= 1){
                            
                            await Axios.post('http://localhost:8080/geoinventarios16/rest/wsdevproductoId',{
                                "ProductoCodigoBarraId": barcode,
                                "BultoIdOriginalCD": deliveryNumber
                            }).then(function (response) {
                                let stateCmd = 0;
                                if(!Boolean(response.data.Resultado)){
                                    text = response.data.Messages[0].Description;
                                    stateCmd = 1;
                                }
                                
                                let modifBarcode =getBarcode(response.data.ProductoId);
                                let dataToWrite = ICmd(orderNumber,requesterNumber,deliveryNumber,country,code,modifBarcode,fecha,stateCmd,text);
                                console.log( `${stx}${dataToWrite}${etx}`);
                                socket.write(
                                    `${stx}${dataToWrite}${etx}`,
                                );
                            })
                              .catch(function (error) {
                                console.log(error);
                            });

                        }else if(parseInt(state) === 2){
                            
                            let dataToWrite = ICmd(orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,0,text);                            
                            console.log( `${stx}${dataToWrite}${etx}`);
                            socket.write(
                                `${stx}${dataToWrite}${etx}`,
                              );

                        }else if(parseInt(state) === 6) {

                            if(deliveryNumber){
                                // Consumo inventarios
                                let productoId = ProductoOriginal(barcode);
                                await Axios.post('http://localhost:8080/geoinventarios16/rest/WSRecepcionRobot',{
                                    "BultoIdOriginalCD": deliveryNumber,
                                    "ProductoId": productoId
                                }).then(function (response) {
                                    console.log(response.data);
                                })
                                  .catch(function (error) {
                                    console.log(error);
                                });
    
                            }

                        }else{
                            console.log("NO SE PUDO INGRESAR CODIGO: " + state);
                        }
                    }else if(data.includes("PMsg")){
                        
                        let {requesterNumber,code,country,barcode} = parseDataPMsg(data.slice(1,-1));
                        let productoId = ProductoOriginal(barcode);
                        
                        await Axios.post('http://localhost:8080/geoinventarios16/rest/wsdevproductoId',{
                            "CodigoProducto": productoId,
                            "BultoIdOriginalCD": ""
                        }).then(function (response) {
                            
                            let itemName = response.data.ProductoDescripcion;
                            let itemTyp = "MED";
                            let itemUnit = "Un";
                            let dataToWrite = PCmd(requesterNumber,code,country,barcode,itemName,itemTyp,itemUnit);
                            console.log(`${stx}${dataToWrite}${etx}`);
                            socket.write(
                                `${stx}${dataToWrite}${etx}`,
                            );
                        })
                          .catch(function (error) {
                            console.log(error);
                        });

                    }
                }

                data = '';
            }
        }  

    } catch (e) {
        if (e instanceof TimeoutError) {
          throw new Error("Timeout");
        }
    }

} 

let parseDataVMsg = (data,SDTProductos) => {

    let resultado = [];
    data = "<root>" + data;
    data = data + "</root>"
    parseString(data, function(err, result) {
        
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        let dataJson = JSON.parse(dataJsonStr);
        
        let ProductoCantidad = 0;
        let ProductoId = "";

        for (let i = 0; i < dataJson.root.WaWi.length; i++) {
            if (dataJson.root.WaWi[i].VMsg[0].Record !== undefined){
                
                dataJson.root.WaWi[i].VMsg[0].Record.forEach(element => {
                    if (ProductoId === "") {
                        ProductoId = element.Msg.BarCode;
                    }
        
                    if (ProductoId !== element.Msg.BarCode) {
                        // resultado.push({ ProductoId, ProductoCantidad });
                        ProductoId = element.Msg.BarCode;
                        ProductoCantidad = 0;
                    }
                    ProductoCantidad += 1;
        
                });
                
                resultado.push({ ProductoId: ProductoOriginal(ProductoId), ProductoCantidad });          
            }else{
                
                resultado.push({ ProductoId:SDTProductos[i].ProductoId, ProductoCantidad:0 });  
            }
        }

    });

    return resultado;

}

let parseDataAMsg = (data) => {

    let state = '';

    parseString(data, function(err, result) {
        
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        let dataJson = JSON.parse(dataJsonStr);
        
        state = dataJson.WaWi.AMsg[0].Msg.OrderState;  
      
    })

    return state;    
}

let parseDataIMsg = (data) => {

    let orderNumber = '';
    let requesterNumber = '';
    let deliveryNumber = '';
    let country = '';
    let code = '';
    let barcode = '';
    let fecha = '';
    let state = '';
    let text     = '';

    parseString(data, function(err, result) {
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        let dataJson = JSON.parse(dataJsonStr);

        orderNumber = dataJson.WaWi.IMsg[0].Msg.OrderNumber;
        requesterNumber = dataJson.WaWi.IMsg[0].Msg.RequesterNumber;          
        deliveryNumber = dataJson.WaWi.IMsg[0].Msg.DeliveryNumber;
        country = dataJson.WaWi.IMsg[0].Msg.Country;
        code = dataJson.WaWi.IMsg[0].Msg.Code;
        barcode = dataJson.WaWi.IMsg[0].Msg.BarCode;
        fecha = dataJson.WaWi.IMsg[0].Msg.Date;          
        state = dataJson.WaWi.IMsg[0].Msg.State;        
        text = dataJson.WaWi.IMsg[0].Msg.Text;        
      
    })

    return {orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,state,text};
}

let parseDataPMsg = (data) => {

    let requesterNumber = '';
    let code = '';
    let country = '';
    let barcode = '';

    parseString(data, function(err, result) {
        
        let dataJsonStr = JSON.stringify(result);
        dataJsonStr = dataJsonStr.replace(/\$/g, 'Msg');
        let dataJson = JSON.parse(dataJsonStr);
        
        requesterNumber = dataJson.WaWi.PMsg[0].Msg.RequesterNumber;          
        code = dataJson.WaWi.PMsg[0].Msg.Code;
        country = dataJson.WaWi.PMsg[0].Msg.Country;
        barcode = dataJson.WaWi.PMsg[0].Msg.BarCode;     
      
    })

    return {requesterNumber,code,country,barcode};    
}

let ProductoOriginal = (barcode) => {
    let productoId = barcode.replace(/^0+/, '');
    productoId = productoId.slice(0, -1);
    return productoId;
}

writeAndReadSocket("<WaWi><SCmd RequesterNumber='1' /></WaWi>");

let jsonParser = bodyParser.json();

app.post('/Conector/WSConsultarStockProducto',jsonParser, async(req, res) => { 

    let SDTProductos = req.body.SDTProductos;
    let order = Math.floor(Math.random() * 100000000);
    
    SDTProductos.forEach(async element => {
        let productoModificado = getBarcode(element.ProductoId);
        const writeData = VCmd(productoModificado,order);

        await socket.write(
            `${stx}${writeData}${etx}`,
        );        
    });

    fs.watchFile("log.txt",{bigint: false,persistent: true,interval: 50,},(curr, prev) => { 

        const readedFile = fs.readFileSync("log.txt", "utf8");
        let data = '';
        let dataABorrar = '';
        let cantOrdenes = 0;
        let esUltimoProducto = false;

        let arr = readedFile.split(etx);
        arr.forEach(element => {
            if (element.includes(order)) {
                data += element.replace(stx,'');
                dataABorrar += element + etx;
                cantOrdenes += 1;
                if (cantOrdenes === SDTProductos.length){
                    esUltimoProducto = true;
                }
            }
        });

        if (esUltimoProducto){
            
            let SDTConsultaStockProductoJson = parseDataVMsg(data,SDTProductos);
            res.status(200).json({
                SDTConsultaStockProductoJson,
                Resultado: 1,
                Message: ""
            });

            fs.unwatchFile("log.txt");
            let newValue = readedFile.replace(dataABorrar,'');
            fs.writeFileSync('log.txt', newValue, 'utf-8');

        }

    }); 

});

app.post('/Conector/WSBajaProductos',jsonParser, async(req, res) => { 

    let {NroBandejaSalida,Productos} = req.body.SDTBajaProductos;
    let order = Math.floor(Math.random() * 100000000);

    const writeData = ACmd(NroBandejaSalida,order,Productos);
    console.log(writeData);

    await socket.write(
        `${stx}${writeData}${etx}`,
    );       
    
    // res.status(200).json({
    //     Resultado: true,
    //     Message: ""
    // });    

    fs.watchFile("log.txt",{bigint: false,persistent: true,interval: 100,},(curr, prev) => { 

        const readedFile = fs.readFileSync("log.txt", "utf8");
        let data = '';

        let arr = readedFile.split(etx);
        arr.forEach(element => {
           if (element.includes(order)) {
               data = element.replace(stx,'');
           }
        });
            
        let state = parseDataAMsg(data);
        console.log("ESTADO: " + state);
        // let Resultado
        // if (parseInt(state) <= 1){
            
        // }
        fs.unwatchFile("log.txt");
        res.status(200).json({
            Resultado: true,
            Message: ""
        });  

    }); 

});

module.exports = app;
