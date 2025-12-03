
import * as baileys from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import pino from 'pino';
import cors from 'cors';
import express from 'express';
import { Boom } from '@hapi/boom';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { encryptSession } from './utils.js';
import { getSession, saveSession } from './db.js';
import PhoneNumber from 'awesome-phonenumber';

const app = express();

app.set('json spaces', 2);

app.use((req, res, next) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	next();
});

app.use(cors());
app.use(express.static('web')); // Serve static files from web folder

let PORT = process.env.PORT || 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function generateAccessKey() {
	const formatNumber = num => num.toString().padStart(2, '0');
	const r1 = formatNumber(Math.floor(Math.random() * 100));
	const r2 = formatNumber(Math.floor(Math.random() * 100));
	const r3 = formatNumber(Math.floor(Math.random() * 100));
	const key = `VERONICA_${r1}_${r2}_${r3}`;
	return key;
}
const accessKey = generateAccessKey();

function clearFolder(folderPath) {
	if (!fs.existsSync(folderPath)) return;
	const contents = fs.readdirSync(folderPath);
	for (const item of contents) {
		const itemPath = join(folderPath, item);
		if (fs.statSync(itemPath).isDirectory()) {
			fs.rmSync(itemPath, { recursive: true, force: true });
		} else {
			fs.unlinkSync(itemPath);
		}
	}
}
clearFolder('./session');

app.get('/pair', async (req, res) => {
	let phone = req.query.phone;
	if (!phone) {
		return res.json({ error: 'Provide Valid Phone Number' });
	}

	try {
		const code = await getPairingCode(phone);
		res.json({ code: code });
	} catch (error) {
		res.json({ error: error.message });
	}
});

app.get('/session', async (req, res) => {
	const accessKey = req.query.session;

	if (!accessKey) {
		return res.status(401).json({ error: 'No session provided' });
	}
	try {
		const sessionData = await getSession(accessKey);
		if (!sessionData) {
			return res.status(401).json({ error: 'Invalid session' });
		}
		res.json(sessionData);
	} catch (error) {
		res.status(500).json({ error: 'Server error' });
	}
});

async function getPairingCode(phone) {
	return new Promise(async (resolve, reject) => {
		try {
			const logger = pino({ level: 'silent' });
			const { state, saveCreds } = await baileys.useMultiFileAuthState('session');

			let waVersion;
			try {
				const { version } = await baileys.fetchLatestBaileysVersion();
				waVersion = version;
			} catch (error) {
				console.log(`[⚠️] Failed to fetch latest version, using default`);
				waVersion = [2, 3000, 1017546695];
			}

			const conn = baileys.makeWASocket({
				version: waVersion,
				logger: logger,
				browser: baileys.Browsers.macOS("Safari"),
				auth: {
					creds: state.creds,
					keys: baileys.makeCacheableSignalKeyStore(state.keys, logger)
				}
				// NOTE: intentionally not using printQRInTerminal and not handling QR at all
			});

			// Save credentials when updated
			conn.ev.on('creds.update', saveCreds);

			// Only use pairing code flow if not already registered
			if (!conn.authState.creds.registered) {
				let inputNumber = String(phone || '').replace(/[^0-9+]/g, '');

				if (!inputNumber) {
					// close socket to clean up
					try { conn.end(); } catch (e) {}
					return reject(new Error('Please provide a phone number'));
				}

				// Normalize by removing leading + if present
				const digitsOnly = inputNumber.replace(/^\+/, '');

				// Validate using awesome-phonenumber if available
				try {
					const pn = new PhoneNumber(digitsOnly);
					if (!pn.isValid()) {
						try { conn.end(); } catch (e) {}
						return reject(new Error('Invalid phone number. Include country code, e.g. 25678497xxxxxx'));
					}
				} catch (err) {
					// fallback length check
					if (digitsOnly.length < 11) {
						try { conn.end(); } catch (e) {}
						return reject(new Error('Phone number too short. Include country code, e.g. 25678497xxxxxx'));
					}
				}

				// request pairing code
				try {
					// requestPairingCode expects number in international format without +
					const pairingNumber = digitsOnly;
					const rawCode = await conn.requestPairingCode(pairingNumber);
					const formatted = (rawCode || '').toString().match(/.{1,4}/g)?.join("-") || rawCode;
					resolve(formatted);
				} catch (error) {
					try { conn.end(); } catch (e) {}
					reject(new Error(`Pairing code error: ${error?.message || error}`));
				}
			}

			// connection.update - handle open/close and other lifecycle events, but do NOT handle QR
			conn.ev.on('connection.update', async update => {
				console.log('Connection update:', update);
				const { connection, lastDisconnect } = update;

				if (connection === 'open') {
					try {
						await baileys.delay(10000);

						// send access key and info to the connected user
						await conn.sendMessage(conn.user.id, { text: accessKey });

						const terri = `
*💫sᴇssɪᴏɴ ɪᴅ ɢᴇɴᴇʀᴀᴛᴇᴅ💫*
╔═════◇
║ ❤️‍🔥『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ 𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥: _ youtube.com/@terrizev _
║❒ 𝐎𝐰𝐧𝐞𝐫: _Terri_
║❒ 𝐑𝐞𝐩𝐨: https://github.com/VeronDev/VERONICA-AI _
║❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: https://whatsapp.com/channel/0029Vb57ZHh7IUYcNttXEB3y _
║🧚‍♀️🧚‍♀️
╚══════╝`;
						await conn.sendMessage(conn.user.id, { 
							text: terri 
						}, { 
							quoted: {
								key: {
									remoteJid: conn.user.id,
									fromMe: true,
									id: accessKey
								},
								message: {
									conversation: accessKey
								}
							}
						});

						const data = encryptSession('session/creds.json');
						await saveSession(accessKey, data);
						await baileys.delay(5000);
						clearFolder(join(__dirname, 'session'));
						// inform parent process to reset
						if (typeof process.send === 'function') process.send('reset');
					} catch (err) {
						console.error('Error during post-open flow:', err);
					}
				}

				if (connection === 'close') {
					const reason = new Boom(lastDisconnect?.error)?.output.statusCode;

					const resetReasons = [
						baileys.DisconnectReason.connectionClosed,
						baileys.DisconnectReason.connectionLost,
						baileys.DisconnectReason.timedOut,
						baileys.DisconnectReason.connectionReplaced
					];
					const resetWithClearStateReasons = [
						baileys.DisconnectReason.loggedOut,
						baileys.DisconnectReason.badSession
					];

					if (resetReasons.includes(reason)) {
						if (typeof process.send === 'function') process.send('reset');
					} else if (resetWithClearStateReasons.includes(reason)) {
						clearFolder('./session');
						if (typeof process.send === 'function') process.send('reset');
					} else if (reason === baileys.DisconnectReason.restartRequired) {
						// Attempt to restart pairing flow
						try { conn.end(); } catch (e) {}
						getPairingCode(phone).catch(() => {});
					} else {
						if (typeof process.send === 'function') process.send('reset');
					}
				}
			});

			conn.ev.on('messages.upsert', msg => {
				if (msg.type === 'notify') {
					console.log(JSON.parse(JSON.stringify(msg.messages[0])));
				}
			});
		} catch (error) {
			console.error('Error occurred:', error);
			reject(new Error('An Error Occurred'));
		}
	});
}

app.listen(PORT, () => {
	console.log('Server running at:\nhttp://localhost:' + PORT);
});
