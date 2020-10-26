const xml2js = require('xml2js');
const getBarcode = require('./getMod10digit');
 
let getXML = (obj) => {

  const builder = new xml2js.Builder({headless:true,renderOpts:{pretty:false}});
  let xml = builder.buildObject(obj);

  return xml;
}

let SCmd = () => {

    let obj = {
        'WaWi': {
          'SCmd': {
            $: {
              'RequesterNumber': '1'
            }
          }
        }
      }

    return getXML(obj);
}

let VCmd = (barcode,order) => {

  //  <WaWi><VCmd OrderNumber="2" RequesterNumber="1" BarCode="001340025" BatchNumber="" ExternalIdCode=""/></WaWi>

  let obj = {
      'WaWi': {
        'VCmd': {
          $: {
            'OrderNumber': order,
            'RequesterNumber': '1',
            'BarCode': barcode,
            'BatchNumber': '',
            'ExternalIdCode': ''
          }
        }
      }
    }

    return getXML(obj);
}

let ACmd = (outputNumber,orderNumber,barcodes) => {

  /*<WaWi>
    <ACmd RequesterNumber="999" OrderNumber="100000" OutputNumber="1" Priority="3">
      <Record Country="0" Code="0" BarCode="025940054" Quantity="5" BatchNumber="" ExternalIdCode=""/>
    </ACmd>
  </WaWi> */

  let obj = {
    'WaWi': {
      'ACmd': {
        $: {
          'RequesterNumber': '999',
          'OrderNumber': orderNumber,
          'OutputNumber': outputNumber,
          'Priority': '3'
        },
        'Record': (function(){
            var arr = [];
            for (var i=0; i < barcodes.length; i++) {
                arr.push( {
                      $: {
                        'Country': '0',
                        'Code' : '0',
                        'BarCode': getBarcode(barcodes[i].ProductoId),
                        'Quantity': barcodes[i].ProductoCantidad,
                        'BatchNumber': '',
                        'ExternalIdCode' : ''
                      }
                } ) ;
            }
            return arr;
        })()
      }
    }
  }

  return getXML(obj);

}

let ICmd = (orderNumber,requesterNumber,deliveryNumber,country,code,barcode,fecha,state,text) => {

    // WaWi>
    //   <ICmd OrderNumber="199931" RequesterNumber="101" DeliveryNumber="" Country="39" Code="4" BarCode="000592182" Date="1980-01-01T00:00:00.000-02:00" State="0" Text="" BatchNumber="" ExternalIdCode="" />
    // </WaWi>

    let obj = {
      'WaWi': {
        'ICmd': {
          $: {
            'OrderNumber': orderNumber,
            'RequesterNumber': requesterNumber,
            'DeliveryNumber': deliveryNumber,
            'Country': country,
            'Code': code,
            'BarCode': barcode,
            'Date': fecha,
            'State': state,
            'Text': text,
            'BatchNumber': '',
            'ExternalIdCode': ''
          }
        }
      }
    }

    return getXML(obj);    

}

let PCmd = (requesterNumber,code,country,barcode,itemName,itemTyp,itemUnit) => {

/* <WaWi><PCmd RequesterNumber="201" Code="4" Country="39" BarCode="000592182" ItemName="BIFERDIL CREMA PEINAR KERATINA 155 GRS." ItemTyp="MED" ItemUnit="Un" /></WaWi> */

    let obj = {
      'WaWi': {
        'PCmd': {
          $: {
            'RequesterNumber': requesterNumber,
            'Code': code,
            'Country': country,
            'BarCode': barcode,
            'ItemName': itemName,
            'ItemTyp': itemTyp,
            'ItemUnit': itemUnit
          }
        }
      }
    }

    return getXML(obj);    

}


module.exports = {
  SCmd,
  VCmd,
  ACmd,
  ICmd,
  PCmd
};