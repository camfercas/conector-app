const express = require('express');
const app = express();

app.use(require('./routes/index'));
// app.use(require('./conector'));

app.listen(5000, () => console.log(`Escuchando puerto: 5000`));