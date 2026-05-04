const { PeerServer } = require('peer');
const peerServer = PeerServer({
    port: process.env.PORT || 9000,
    path: '/myapp',
    proxied: true
});
console.log('PeerJS server running');