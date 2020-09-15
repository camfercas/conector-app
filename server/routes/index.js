const express = require('express');
const app = express();

app.use(require('./start'));
app.use(require('./stock'));

module.exports = app;