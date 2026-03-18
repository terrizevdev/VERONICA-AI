import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'url';
import { useSingleFileAuthState } from '@whiskeysockets/baileys';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Default export expected by index.js:
 * useSequelizeAuthState(accessKey, logger)
 *
 * This wraps Baileys' useSingleFileAuthState and places the auth file under
 * ./uploads/<accessKey>/auth_info.json so each generated accessKey has its
 * own auth storage folder.
 */
export default async function useSequelizeAuthState(accessKey = 'default', logger = undefined) {
  const baseDir = join(__dirname, 'uploads', accessKey);
  mkdirSync(baseDir, { recursive: true });
  const authFile = join(baseDir, 'auth_info.json');

  // Delegate to Baileys helper which provides { state, saveCreds }
  // state will contain { creds, keys } compatible with makeWASocket usage.
  const result = await useSingleFileAuthState(authFile);
  return result; // { state, saveCreds }
}

/**
 * Named export expected by index.js:
 * clearSessionData()
 *
 * Removes all session folders under ./uploads to clear stored auth state.
 * Called when the app wants to reset/clear sessions.
 */
export async function clearSessionData() {
  const uploadsDir = join(__dirname, 'uploads');
  if (!existsSync(uploadsDir)) return;
  const entries = readdirSync(uploadsDir);
  for (const entry of entries) {
    const p = join(uploadsDir, entry);
    try {
      rmSync(p, { recursive: true, force: true });
    } catch (err) {
      // best-effort cleanup
      console.error('Failed to remove session folder', p, err);
    }
  }
}

/* --- the rest of the file keeps the encrypt/decrypt helpers the repository already had --- */

function encryptSession(initSession = 'creds.json') {
	const baseDir = dirname(initSession);

	// Read credentials file
	const credsData = JSON.parse(readFileSync(initSession, 'utf8'));

	// Find all app-state files
	const files = readdirSync(baseDir);
	const appStateFiles = files.filter(
		file => file.startsWith('app-state-sync-key-') && file.endsWith('.json')
	);

	// Create a data structure with creds and all sync keys
	const mergedData = {
		creds: credsData,
		syncKeys: {}
	};

	// Read and store each sync key file
	for (const file of appStateFiles) {
		const syncKeyData = JSON.parse(readFileSync(join(baseDir, file), 'utf8'));
		// Use the original filename as the key to maintain file association
		mergedData.syncKeys[file] = syncKeyData;
	}

	// Encryption setup
	const algorithm = 'aes-256-cbc';
	const key = randomBytes(32);
	const iv = randomBytes(16);
	const cipher = createCipheriv(algorithm, key, iv);

	// Encrypt the merged data
	let encrypted = cipher.update(JSON.stringify(mergedData), 'utf8', 'hex');
	encrypted += cipher.final('hex');

	// Prepare the session data object
	const sessionData = {
		data: encrypted,
		key: key.toString('hex'),
		iv: iv.toString('hex'),
		files: {
			creds: initSession,
			syncKeys: appStateFiles
		}
	};
	return JSON.stringify(sessionData, null, 2);
}

function decryptSession(sessionSource = 'session.json', outputDir = './session') {
	// Read and parse the encrypted session file
	const encryptedData = JSON.parse(readFileSync(sessionSource, 'utf8'));

	// Setup decryption
	const algorithm = 'aes-256-cbc';
	const key = Buffer.from(encryptedData.key, 'hex');
	const iv = Buffer.from(encryptedData.iv, 'hex');
	const decipher = createDecipheriv(algorithm, key, iv);

	// Decrypt the data
	let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	const data = JSON.parse(decrypted);

	// Create output directory
	mkdirSync(outputDir, { recursive: true });

	// Write credentials file
	writeFileSync(join(outputDir, 'creds.json'), JSON.stringify(data.creds, null, 2));

	// Write each sync key file with its original filename
	for (const [filename, syncKeyData] of Object.entries(data.syncKeys)) {
		writeFileSync(join(outputDir, filename), JSON.stringify(syncKeyData, null, 2));
	}

	return data;
}

export { encryptSession, decryptSession };