const fs = require("fs")

const {PromiseReadable} = require("promise-readable")

async function writeAndReadSocket() {
  const rstream = new PromiseReadable(
    fs.createReadStream('log.txt', {
      highWaterMark: 1024,
    }),
  )

  let data = '';

  for (let chunk; (chunk = await rstream.read()); ) {
    console.info(`Read ${chunk.length} bytes chunk`)
    total += chunk.length
  }

  console.info(`Read ${total} bytes in total`)
  
  rstream.destroy();
  console.log(total.toString());
  return total.toString();
}

module.exports = writeAndReadSocket;