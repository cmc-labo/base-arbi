import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

let logPath = null;

/**
 * Initialise the logger: create the log directory and set the daily log file path.
 * Returns the resolved file path so the caller can display it.
 * @param {string} logDir
 * @returns {Promise<string>}
 */
export async function initLogger(logDir) {
  await mkdir(logDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  logPath = join(logDir, `arbitrage-${date}.json`);
  return logPath;
}

/**
 * Append one scan entry as a NDJSON line.
 * Errors are caught and printed; they never crash the scanner.
 * @param {object} entry
 */
export async function logScan(entry) {
  if (!logPath) return;
  try {
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('⚠️  Log write error:', err.message);
  }
}
