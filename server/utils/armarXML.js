const xml2js = require('xml2js');
 
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

    var builder = new xml2js.Builder({headless:true,renderOpts:{pretty:false}});
    var xml = builder.buildObject(obj);

    return xml;

}

module.exports = SCmd;