/**
 * Service de découverte UDP (LAN Discovery)
 * Le serveur émet un broadcast UDP toutes les 2 secondes.
 * Les clients écoutent ce broadcast et trouvent automatiquement le serveur.
 *
 * Port UDP : 47777 (broadcast)
 * Message  : JSON { type: 'GESLO_SERVER', ip, port, name, version }
 */
import dgram from 'dgram';
import { networkInterfaces } from 'os';
import { getLocalIP, PORT } from './config/config.js';

const DISCOVERY_PORT = 47777;
const BROADCAST_INTERVAL = 2000;

let broadcastSocket = null;
let discoveryInterval = null;
let connectedClients = new Map(); // ip → { ip, name, last_seen }

export function startDiscoveryServer(serverName = 'GesLo Serveur') {
  broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  broadcastSocket.on('error', (err) => {
    console.warn('[Discovery] Erreur UDP :', err.message);
  });

  // Écouter les annonces des clients (ping)
  broadcastSocket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'GESLO_CLIENT_PING') {
        connectedClients.set(rinfo.address, {
          ip: rinfo.address,
          name: data.name || 'Poste inconnu',
          role: data.role || '',
          last_seen: Date.now(),
        });
        // Nettoyer les clients inactifs depuis plus de 10s
        for (const [ip, client] of connectedClients.entries()) {
          if (Date.now() - client.last_seen > 10000) connectedClients.delete(ip);
        }
      }
    } catch { /* ignorer les messages non-JSON */ }
  });

  broadcastSocket.bind(DISCOVERY_PORT, () => {
    broadcastSocket.setBroadcast(true);
    console.log(`[Discovery] Service de découverte démarré (UDP :${DISCOVERY_PORT})`);

    const serverIP = getLocalIP();
    const message = JSON.stringify({
      type: 'GESLO_SERVER',
      ip: serverIP,
      port: PORT,
      name: serverName,
      version: '1.0.0',
    });
    const buf = Buffer.from(message);

    // Émettre un broadcast toutes les 2 secondes
    discoveryInterval = setInterval(() => {
      broadcastSocket.send(buf, 0, buf.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
        if (err) console.warn('[Discovery] Erreur broadcast :', err.message);
      });
    }, BROADCAST_INTERVAL);
  });
}

export function stopDiscoveryServer() {
  if (discoveryInterval) clearInterval(discoveryInterval);
  if (broadcastSocket) broadcastSocket.close();
  discoveryInterval = null;
  broadcastSocket = null;
}

export function getConnectedClients() {
  // Retourner seulement les clients actifs (vus dans les 10 dernières secondes)
  return [...connectedClients.values()].filter((c) => Date.now() - c.last_seen < 10000);
}
