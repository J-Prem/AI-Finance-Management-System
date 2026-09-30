/**
 * Live metrics emitter — powers the industrial-monitoring UI.
 * Emits aggregated KPIs + alert events over Socket.IO every few seconds
 * to the per-user rooms. Fully MongoDB-backed.
 */
import Transaction from '../models/Transaction.js';
import Bill from '../models/Bill.js';
import { buildSnapshot } from '../controllers/monitoringController.js';
import logger from '../utils/logger.js';

let intervalHandle = null;

export function startLiveMetrics(io) {
  if (intervalHandle) return;
  intervalHandle = setInterval(
    () => emitToAllUsers(io).catch((e) => logger.warn(`liveMetrics tick: ${e.message}`)),
    5000,
  );
}

export function stopLiveMetrics() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

async function emitToAllUsers(io) {
  if (!io) return;
  const rooms = io.sockets.adapter.rooms;
  const userRooms = [...rooms.keys()].filter((k) => typeof k === 'string' && k.startsWith('user:'));
  for (const room of userRooms) {
    const userId = room.slice(5);
    try {
      const [txs, bills] = await Promise.all([
        Transaction.find({ userId }).sort({ date: -1 }).limit(2000).lean(),
        Bill.find({ userId }).lean(),
      ]);
      const snap = buildSnapshot(txs, bills);
      io.to(room).emit('metrics:update', snap);
    } catch (e) {
      logger.warn(`emit for ${userId}: ${e.message}`);
    }
  }
}

export default { startLiveMetrics, stopLiveMetrics };
