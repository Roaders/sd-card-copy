#!/usr/bin/env node

const http = require('http');

async function makeRequest() {
    await http.get(`http://localhost:3000/copy-path?source-path=${process.env.UM_MOUNTPOINT}`);
}

makeRequest();
