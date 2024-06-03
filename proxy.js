const net = require('net');
const fs = require('fs');
const path = require('path');

let config = loadConfig();

function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function setupFileWatcher() {
    const configPath = path.join(__dirname, 'config.json');
    fs.watch(configPath, (eventType, filename) => {
        if (eventType === 'change') {
            console.log('Configuration file changed, reloading...');
            config = loadConfig();
        }
    });
}

setupFileWatcher();

const PROXY_PORT = config.proxyPort;

// Simple round-robin load balancer
let currentServer = 0;
function getNextServer() {
    const server = config.servers[currentServer];
    currentServer = (currentServer + 1) % config.servers.length;
    return server;
}

// Create a server to listen for client connections
const server = net.createServer(clientSocket => {
    console.log('Client connected:', clientSocket.remoteAddress, clientSocket.remotePort);

    // Get the next server in the round-robin
    const targetServer = getNextServer();

    // Connect to the target PocketMine server
    const serverSocket = net.createConnection({ host: targetServer.host, port: targetServer.port }, () => {
        console.log(`Connected to PocketMine server at ${targetServer.host}:${targetServer.port}`);
    });

    // Forward data from client to server
    clientSocket.on('data', data => {
        console.log('Data from client:', data);
        serverSocket.write(data);
    });

    // Forward data from server to client
    serverSocket.on('data', data => {
        console.log('Data from server:', data);
        clientSocket.write(data);
    });

    // Handle client disconnection
    clientSocket.on('end', () => {
        console.log('Client disconnected');
        serverSocket.end();
    });

    // Handle server disconnection
    serverSocket.on('end', () => {
        console.log('Server disconnected');
        clientSocket.end();
    });

    // Handle errors
    clientSocket.on('error', err => {
        console.error('Client error:', err);
        serverSocket.end();
    });

    serverSocket.on('error', err => {
        console.error('Server error:', err);
        clientSocket.end();
    });
});

// Start the proxy server
server.listen(PROXY_PORT, () => {
    console.log(`Proxy server listening on port ${PROXY_PORT}`);
});
