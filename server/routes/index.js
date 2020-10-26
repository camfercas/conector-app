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
const parseString = require('xml2js').parseString;
let {ws,log} = require('../config/config.json');

let stx = getStx();
let etx = getEtx();

// Crea el socket y abre la conexión
const socketAux = new PromiseSocket();
const socket = openSocket(socketAux);

// Esta funcion lee todo lo que el robot escribe en el socket
const writeAndReadSocket = async(dataWrite) =>{

    try {
        // Escribe en el socket el dialogo SCmd para inicializar el robot y ver si responde el SMsg
        await socket.write(
          `${stx}${dataWrite}${etx}`,
        );
    
        let data = '';
        
        // Este for es el que se queda escuchando los mensajes que llegan al socket (socket.read())
        for (let chunk; (chunk = await socket.read()); ) {
            // chunk es tipo buffer y hay que convertirlo a string
            data += chunk.toString();
            
            // Queda esperando a que el mensaje finalize
            if (chunk.toString().slice(1, -1).endsWith('</WaWi>')) {

                // Para que loguee todos los mensajes en la consola 
                // console.log(data)

                // Si el log en la configuracion es true loguea todos los Mensajes
                if(!data.includes("SMsg")){
                    if (log){
                        graboLog(data);
                    }
                }

                // Chequeo si el mensaje es por una consulta de stock (VMsg) o por una baja (AMsg)
                // Si es asi se guarda en un archivo la respuesta para que luego el WS que pidio esta informacion la procese
                if(data.includes("VMsg") || data.includes("AMsg")){

                    fs.appendFile('mensajes.txt',data, function (err) {
                        if (err) return console.log(err);
                    });

                }else{
                    // Tira a consola el mensaje que llego del robot
                    console.log(data);

                    // Chequea si el mensaje es por una alta en el robot "IMsg"
                    if(data.includes("IMsg")){
                        
                        // Procesa el mensaje y obtiene los datos
                        // Ej. <WaWi><IMsg OrderNumber="199913" RequesterNumber="101" Code="4" Country="39" BarCode="7791001008852" OrgBarCode="" Date="1980-01-01T00:00:00.000-02:00" DeliveryNumber="" Quantity="1" State="1" BatchNumber="" ExternalIdCode="" Field1="0" Field2="0" Field3="0" Field4="0"/></WaWi>
                        let {orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,state,text} = parseDataIMsg(data.slice(1,-1));
                        
                        // 0 stock input request new delivery
                        // 1 stock input request stock return
                        // 2 start new delivery
                        // 3 end new delivery
                        // 4 set stock location number for pack as stock return
                        // 5 set stock location number for pack as new delivery
                        // 6 pack was input
                        // 7 pack was not input

                        // Si el state es 0 o 1 es para comenzar una alta de producto
                        if (parseInt(state) <= 1){
                            
                            // Va a buscar a GeoInventarios el SKU del producto a travez del Codigo de Barra ingresado en el robot.
                            // Tambien se envia el deliveryNumber (numero de bulto), si este tiene, GeoInventarios valida si
                            // el bulto que viene es correcto para su uso.
                            await Axios.post(ws.wsdevproductoId,{
                                "ProductoCodigoBarraId": barcode,
                                "BultoIdOriginalCD": deliveryNumber
                            }).then(function (response) {

                                // Se fija si el resultado de GeoInventarios dio error, si da error se tiene que enviar al robot
                                // en el ICmd el State = "1" para que no deje ingresar el producto en el robot y tambien se envia
                                // el Text para que muestre en pantalla del robot el motivo del error
                                // Si no hay error se envia State = "0" para que lo ingrese.

                                // GeoInventarios devuelve el resultado en false cuando el producto no existe o cuando viene un 
                                // numero de bulto incorrecto o ya ingresado.

                                let stateCmd = 0;
                                
                                if(!Boolean(response.data.Resultado)){
                                    text = response.data.Messages[0].Description;
                                    stateCmd = 1;
                                }
                                
                                // En el robot no se guarda el codigo de barra ingresado del producto, se debe guardar con el SKU modificado.
                                // La modificacion consiste en transformarlo a codigo de barra (Code 32)
                                // Ej. Prod SKU: 59218 (CB: 7791001008852) -> Se guarda en el robot con el Codigo de Barra: 000592182

                                let modifBarcode = getBarcode(response.data.ProductoId);

                                // Se crea el dialogo ICmd para enviarlo al robot y este lo procese
                                // Ej. <WaWi><ICmd OrderNumber="199913" RequesterNumber="101" DeliveryNumber="" Country="39" Code="4" BarCode="000592182" Date="1980-01-01T00:00:00.000-02:00" State="0" BatchNumber="" ExternalIdCode=""/></WaWi>
                                let dataToWrite = ICmd(orderNumber,requesterNumber,deliveryNumber,country,code,modifBarcode,fecha,stateCmd,text);

                                // Escribe en consola el dialogo enviado al robot
                                console.log(`${stx}${dataToWrite}${etx}`);

                                // Guardo en el log si en la configuracion esta prendido
                                if (log){
                                    graboLog(dataToWrite);
                                }

                                // Escribe el socket el mensaje nuevo para que el robot lo reciba
                                socket.write(
                                    `${stx}${dataToWrite}${etx}`,
                                );
                            })
                              .catch(function (error) {

                                if(log){
                                    graboLog("ERROR: Error al consumir datos de GeoInventarios - WS: " + error.config.url);
                                }
                                console.log("ERROR: Error al consumir datos de GeoInventarios - WS: " + error.config.url);

                            });

                        }else if(parseInt(state) === 2){
                            
                            // Si el sate es 2, es porque se va a empezar una recepcion de pedido
                            // El robot espera de respuesta un ICmd con state = "0" para pueda empezar a ingresar productos
                            let dataToWrite = ICmd(orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,0,text); 
                                                      
                            // Guardo en el log si en la configuracion esta prendido
                            if (log){
                                graboLog(dataToWrite);
                            }

                            console.log(`${stx}${dataToWrite}${etx}`);
                            
                            // Escribe el socket el mensaje nuevo para que el robot lo reciba
                            socket.write(
                                `${stx}${dataToWrite}${etx}`,
                              );

                        }else if(parseInt(state) === 6) {

                            // El state 6 significa que el producto fue ingresado correctamente en el robot.
                            // Si viene un numero de bulto (deliveryNumber) tiene que enviar a GeoInventarios el producto ingresado 
                            // y el numero de bulto para que lo ingrese a la recepcion de pedido que tiene ese bulto

                            if(deliveryNumber){
                                // Hay que tomar el SKU del codigo de barras que envia el robot
                                let productoId = ProductoOriginal(barcode);

                                if (log){
                                    graboLog(`Consume WS: ${ws.WSRecepcionRobot} -> Datos: {"BultoIdOriginalCD": ${deliveryNumber},"ProductoId": ${productoId}} `);
                                }
                                
                                // Envio a GeoInventarios los datos del producto y el bulto
                                await Axios.post(ws.WSRecepcionRobot,{
                                    "BultoIdOriginalCD": deliveryNumber,
                                    "ProductoId": productoId
                                }).then(function (response) {

                                    if (log){
                                        graboLog(`Producto ${productoId} - Bulto ${deliveryNumber} ingresado correctamente en Inventarios`);
                                    }  

                                    console.log(`Producto ${productoId} - Bulto ${deliveryNumber} ingresado correctamente en Inventarios`);
                                })
                                  .catch(function (error) {

                                    if (log) {
                                        graboLog("ERROR: Error al consumir datos de GeoInventarios - WS: " + error.config.url);
                                    }

                                    if (error.response) {
                                        console.log(error.response.data);
                                        console.log(error.response.status);
                                        console.log(error.response.headers);
                                    } else if (error.request) {
                                        console.log(error.request);
                                    } else {
                                        console.log('Error', error.message);
                                    }
                                    console.log(error.config);

                                    // // Guardo en el log si en la data enviada para luego reintentarla
                                    // let obj = {
                                    //     ws_error: []
                                    // }

                                    // let error_ws = {
                                    //     url: error.config.url,
                                    //     data: error.config.data,
                                    //     state: false
                                    // }

                                    // fs.readFile('ws_errors.json', 'utf8', function readFileCallback(err, data){
                                    //     if (err){
                                    //         console.log(err);
                                    //     } else {
                                    //     obj = JSON.parse(data); //now it an object
                                    //     obj.ws_error.push(error_ws); //add some data
                                    //     json = JSON.stringify(obj); //convert it back to json
                                    //     fs.writeFileSync('ws_errors.json', json, 'utf8'); // write it back 
                                    // }});                                    
                                                                  
                                    console.error("Error al consumir datos de GeoInventarios");
                                });
    
                            }

                        }else if(parseInt(state) === 7){
                            // Si el state es 7 no porque no se pudo ingresar el producto
                            let productoId = ProductoOriginal(barcode);
                            if (log) {
                                graboLog(`ERROR: No se pudo ingresar el producto: ${productoId}`);
                            }                             
                            console.log(`ERROR: No se pudo ingresar el producto: ${productoId}`);
                        }else{
                            console.log("Se cerró la recepcion del bulto: " + deliveryNumber);
                        }
                    }else if(data.includes("PMsg")){
                        
                        // El PMsg lo envia el robot para obtener informacion del producto
                        // Se consulta a GeoInventarios los datos (nombre) del producto.
                        // Luego se envia un PCmd con la info del producto al robot

                        // Procesa el PMsg y toma los datos
                        // Ej. <WaWi><PMsg RequesterNumber="201" Code="4" Country="39" BarCode="000592182"/></WaWi>
                        let {requesterNumber,code,country,barcode} = parseDataPMsg(data.slice(1,-1));
                        // Obitene el SKU del codigo de barra
                        let productoId = ProductoOriginal(barcode);
                        
                        // Consume GeoInventarios
                        await Axios.post(ws.wsdevproductoId,{
                            "CodigoProducto": productoId,
                            "BultoIdOriginalCD": ""
                        }).then(function (response) {
                            
                            // Descripcion del producto
                            let itemName = response.data.ProductoDescripcion;
                            
                            let itemTyp = "MED";
                            let itemUnit = "Un";

                            // Crea el PCmd
                            // Ej. <WaWi><PCmd RequesterNumber="201" Code="4" Country="39" BarCode="000592182" ItemName="BIFERDIL CREMA PEINAR KERATINA 155 GRS." ItemTyp="MED" ItemUnit="Un"/></WaWi>
                            let dataToWrite = PCmd(requesterNumber,code,country,barcode,itemName,itemTyp,itemUnit);

                            if (log){
                                graboLog(dataToWrite);
                            }

                            console.log(`${stx}${dataToWrite}${etx}`);

                            socket.write(
                                `${stx}${dataToWrite}${etx}`,
                            );
                        })
                          .catch(function (error) {

                            if (log) {
                                graboLog("ERROR: Error al consumir datos de GeoInventarios - WS: " + error.config.url);
                            }

                            console.log("Error al consumir datos de GeoInventarios");
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
        
        if (err){
            console.log(`Error en -> parseDataVMsg: ${err}`);
        }

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

        if (err){
            console.log(`Error en -> parseDataAMsg: ${err}`);
        }

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

        if (err){
            console.log(`Error en -> parseDataIMsg: ${err}`);
        }

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
  
        if (err){
            console.log(`Error en -> parseDataPMsg: ${err}`);
        }      
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

let graboLog = (datos) => {

    let today = new Date();
    let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date+' '+time;

    datos = datos.replace(stx,'');
    datos = datos.replace(etx,'');
    datos = dateTime + ' - ' + datos;
    fs.appendFile('log.txt',`${datos}\r\n`, function (err) {
        if (err) return console.log(err);
    });

}

writeAndReadSocket("<WaWi><SCmd RequesterNumber='1' /></WaWi>");

let jsonParser = bodyParser.json();

app.post('/Conector/WSConsultarStockProducto',jsonParser, async(req, res) => { 

    let SDTProductos = req.body.SDTProductos;
    let order = Math.floor(Math.random() * 100000000);
    
    SDTProductos.forEach(async element => {
        let productoModificado = getBarcode(element.ProductoId);
        const writeData = VCmd(productoModificado,order);

        if (log){
            graboLog(writeData);
        }

        await socket.write(
            `${stx}${writeData}${etx}`,
        );        
    });

    fs.watchFile("mensajes.txt",{bigint: false,persistent: true,interval: 50,},(curr, prev) => { 

        const readedFile = fs.readFileSync("mensajes.txt", "utf8");
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

            fs.unwatchFile("mensajes.txt");
            let newValue = readedFile.replace(dataABorrar,'');
            fs.writeFileSync('mensajes.txt', newValue, 'utf-8');

        }

    }); 

});

app.post('/Conector/WSBajaProductos',jsonParser, async(req, res) => { 

    let {NroBandejaSalida,Productos} = req.body.SDTBajaProductos;
    let order = Math.floor(Math.random() * 100000000);

    const writeData = ACmd(NroBandejaSalida,order,Productos);

    console.log(`WSBajaProductos: -> Orden: ${order} - Productos: ${JSON.stringify(Productos,3,null)}`);

    if (log){
        graboLog(writeData);
    }

    await socket.write(
        `${stx}${writeData}${etx}`,
    );       
    
    fs.watchFile("mensajes.txt",{bigint: false,persistent: true,interval: 100,},(curr, prev) => { 

        const readedFile = fs.readFileSync("mensajes.txt", "utf8");
        let data = '';

        let arr = readedFile.split(etx);
        arr.forEach(element => {
           if (element.includes(order)) {
               data = element.replace(stx,'');
           }
        });
            
        let state = parseDataAMsg(data);

        let Resultado = false;
        if (parseInt(state) <= 1){
            Resultado = true;
        }
        fs.unwatchFile("mensajes.txt");
        res.status(200).json({
            Resultado,
            Message: ""
        });  

    }); 

});

// A desarrollar
app.get('/Conector/WSReintentarErrores',jsonParser, async(req, res) => {

    // Guardo en el log si en la data enviada para luego reintentarla
    // let obj = {
    //     ws_error: []
    // }

    // let error_ws = {
    //     url: error.config.url,
    //     data: error.config.data,
    //     state: false
    // }

    let json = fs.readFileSync('ws_errors.json');
    let {ws_error} = JSON.parse(json);

    let ws_error_pendientes = ws_error.filter(ws => ws.state===false);
    
    // console.log(ws_error_pendientes);
    let enviadosCorrectamente = 0;

    ws_error_pendientes.forEach(async pend => {

        await Axios.post(pend.url,pend.data,{headers:{'Content-Type': 'application/json; charset=utf-8'}}).then(function (response) {
            console.log(response.data);
            enviadosCorrectamente += 1;
        })
        .catch(function (error) {
            if (error.response) {
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            } else if (error.request) {
                console.log(error.request);
            } else {
                console.log('Error', error.message);
            }
            console.log(error.config);
        });

    });

    res.status(200).json({
        resultado: true,
        cant_enviados: enviadosCorrectamente
    })


});

module.exports = app;
