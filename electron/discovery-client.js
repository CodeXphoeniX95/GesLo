/**
 * Client de découverte UDP
 * Écoute les broadcasts du serveur GesLo sur le réseau local.
 * Retourne une promesse qui résout avec { ip, port } si un serveur est trouvé.
 */
const dgram = require('dgram');

const DISCOVERY_PORT = 47777;
const TIMEOUT_MS = 5000; // 5 secondes max pour trouver un serveur

/**
 * Cherche un serveur GesLo sur le réseau local.
 * @returns {Promise<{ip: string, port: number, name: string} | null>}
 */
function discoverServer() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let found = false;

    const cleanup = (result) => {
      if (found) return;
      found = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(result);
    };

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'GESLO_SERVER' && data.ip && data.port) {
          cleanup({ ip: data.ip, port: data.port, name: data.name || 'GesLo Serveur' });
        }
      } catch {}
    });

    socket.on('error', () => cleanup(null));

    socket.bind(DISCOVERY_PORT, () => {
      socket.setBroadcast(true);
      socket.addMembership?.('224.0.0.1');
    });

    // Timeout : aucun serveur trouvé
    const timer = setTimeout(() => cleanup(null), TIMEOUT_MS);
  });
}

/**
 * Envoyer un ping périodique pour indiquer que ce client est connecté.
 */
function startClientPing(serverIP, serverPort, clientName = 'Poste client', role = '') {
  const socket = dgram.createSocket('udp4');
  const message = Buffer.from(JSON.stringify({
    type: 'GESLO_CLIENT_PING',
    name: clientName,
    role,
  }));

  const sendPing = () => {
    socket.send(message, 0, message.length, DISCOVERY_PORT, serverIP);
  };

  sendPing();
  const interval = setInterval(sendPing, 5000);

  return () => {
    clearInterval(interval);
    socket.close();
  };
}

module.exports = { discoverServer, startClientPing };
