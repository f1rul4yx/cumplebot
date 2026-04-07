// =========================================
// CumpleBot — Servidor principal
// Autor: Diego Vargas
// Versión: 1.0
// =========================================

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'cumplebot';
const COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '34';
const DATA_DIR = path.join(__dirname, '..', 'data');

// -----------------------------------------
// BASE DE DATOS
// -----------------------------------------

const db = new Database(path.join(DATA_DIR, 'cumplebot.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    birthday TEXT NOT NULL,
    message TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    reminder_days INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    sent_at TEXT DEFAULT (datetime('now')),
    message TEXT,
    status TEXT DEFAULT 'sent',
    type TEXT DEFAULT 'birthday',
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Plantillas por defecto
const templateCount = db.prepare('SELECT COUNT(*) as c FROM message_templates').get();
if (templateCount.c === 0) {
  const ins = db.prepare('INSERT INTO message_templates (name, template, is_default) VALUES (?, ?, ?)');
  ins.run('Clásico', '🎂 ¡Feliz cumpleaños, {nombre}! 🎉\n\nQue este día esté lleno de alegría y momentos inolvidables. ¡Un abrazo enorme! 🥳', 1);
  ins.run('Formal', 'Estimado/a {nombre},\n\nLe deseo un muy feliz cumpleaños. Que este nuevo año de vida le traiga mucha salud y prosperidad.\n\nCordialmente.');
  ins.run('Divertido', '🎈🎈🎈 ¡BOOM! 🎈🎈🎈\n\n¡¡{nombre}!! ¡Hoy es TU día! 🎊\n\nQue la fiesta no pare y que cumplas muchos más 🍰🎁🥂\n\n¡A celebrar! 🪅');
  ins.run('Corto', '¡Feliz cumpleaños, {nombre}! 🎂🎉 ¡Pásalo genial!');
}

// Ajustes por defecto
const settingsCount = db.prepare('SELECT COUNT(*) as c FROM settings').get();
if (settingsCount.c === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  ins.run('send_hour', '9');
  ins.run('send_minute', '0');
  ins.run('reminder_enabled', 'true');
}

// -----------------------------------------
// WHATSAPP
// -----------------------------------------

let waStatus = 'disconnected';
let waQR = null;
let waInfo = null;

const chromiumPath = process.env.CHROMIUM_PATH || null;
const puppeteerArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--disable-gpu'
];

const puppeteerOpts = { headless: true, args: puppeteerArgs };
if (chromiumPath) puppeteerOpts.executablePath = chromiumPath;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(DATA_DIR, '.wwebjs_auth') }),
  puppeteer: puppeteerOpts
});

client.on('qr', async (qr) => {
  waStatus = 'qr_ready';
  waQR = await QRCode.toDataURL(qr);
  console.log('[i] QR generado, escanea con WhatsApp.');
});

client.on('ready', () => {
  waStatus = 'connected';
  waInfo = client.info;
  waQR = null;
  console.log('[+] WhatsApp conectado.');
});

client.on('authenticated', () => {
  console.log('[+] WhatsApp autenticado.');
});

client.on('auth_failure', (msg) => {
  waStatus = 'auth_failed';
  console.error('[-] Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
  waStatus = 'disconnected';
  waInfo = null;
  console.log('[!] WhatsApp desconectado:', reason);
});

client.initialize().catch(err => {
  console.error('[-] Error al iniciar WhatsApp:', err.message);
  waStatus = 'error';
});

// -----------------------------------------
// FUNCIONES
// -----------------------------------------

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function sendWhatsAppMessage(phone, message) {
  if (waStatus !== 'connected') throw new Error('WhatsApp no está conectado');

  let clean = phone.replace(/[\s\-\(\)]/g, '');
  if (!clean.startsWith('+')) clean = '+' + COUNTRY_CODE + clean;
  clean = clean.replace('+', '');

  const chatId = clean + '@c.us';
  try {
    await client.sendMessage(chatId, message);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function checkBirthdays() {
  const now = new Date();
  const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const contacts = db.prepare("SELECT * FROM contacts WHERE active = 1 AND substr(birthday, 6) = ?").all(today);
  const defaultTpl = db.prepare('SELECT template FROM message_templates WHERE is_default = 1').get();

  for (const c of contacts) {
    const sent = db.prepare("SELECT id FROM sent_log WHERE contact_id = ? AND date(sent_at) = date('now') AND type = 'birthday'").get(c.id);
    if (sent) continue;

    let msg = c.message || (defaultTpl ? defaultTpl.template : '¡Feliz cumpleaños, {nombre}! 🎂');
    msg = msg.replace(/{nombre}/g, c.name);

    sendWhatsAppMessage(c.phone, msg).then(result => {
      db.prepare("INSERT INTO sent_log (contact_id, message, status, type) VALUES (?, ?, ?, 'birthday')")
        .run(c.id, msg, result.success ? 'sent' : 'failed');
      if (result.success) console.log(`[+] Felicitación enviada a ${c.name}`);
    });
  }
}

function checkReminders() {
  if (getSetting('reminder_enabled') !== 'true') return;

  const contacts = db.prepare('SELECT * FROM contacts WHERE active = 1 AND reminder_days > 0').all();
  const now = new Date();

  for (const c of contacts) {
    const [, month, day] = c.birthday.split('-').map(Number);
    const bd = new Date(now.getFullYear(), month - 1, day);
    const diff = Math.ceil((bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === c.reminder_days) {
      db.prepare("INSERT INTO sent_log (contact_id, message, status, type) VALUES (?, ?, 'info', 'reminder')")
        .run(c.id, `Recordatorio: cumpleaños de ${c.name} en ${diff} día(s)`);
      console.log(`[i] Recordatorio: ${c.name} cumple en ${diff} día(s)`);
    }
  }
}

// -----------------------------------------
// CRON
// -----------------------------------------

cron.schedule('* * * * *', () => {
  const now = new Date();
  const h = parseInt(getSetting('send_hour') || '9');
  const m = parseInt(getSetting('send_minute') || '0');

  if (now.getHours() === h && now.getMinutes() === m) {
    console.log('[i] Ejecutando comprobación programada...');
    checkBirthdays();
    checkReminders();
  }
});

// -----------------------------------------
// MIDDLEWARE
// -----------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Autenticación básica
app.use((req, res, next) => {
  // Excluir favicon
  if (req.path === '/favicon.svg') return next();

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CumpleBot"');
    return res.status(401).send('Acceso denegado');
  }

  const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CumpleBot"');
    return res.status(401).send('Credenciales incorrectas');
  }

  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// -----------------------------------------
// API — WHATSAPP
// -----------------------------------------

app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: waStatus,
    qr: waQR,
    info: waInfo ? { pushname: waInfo.pushname, phone: waInfo.wid ? waInfo.wid.user : null } : null
  });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await client.logout();
    waStatus = 'disconnected';
    waInfo = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------
// API — CONTACTOS
// -----------------------------------------

app.get('/api/contacts', (req, res) => {
  res.json(db.prepare('SELECT * FROM contacts ORDER BY name').all());
});

app.get('/api/contacts/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  res.json(c);
});

app.post('/api/contacts', (req, res) => {
  const { name, phone, birthday, message, group_name, reminder_days, active } = req.body;
  if (!name || !phone || !birthday) return res.status(400).json({ error: 'Nombre, teléfono y cumpleaños son obligatorios' });

  const result = db.prepare(
    'INSERT INTO contacts (name, phone, birthday, message, group_name, reminder_days, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, phone, birthday, message || '', group_name || '', reminder_days || 1, active !== undefined ? active : 1);

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/contacts/:id', (req, res) => {
  const { name, phone, birthday, message, group_name, reminder_days, active } = req.body;
  db.prepare(
    "UPDATE contacts SET name=?, phone=?, birthday=?, message=?, group_name=?, reminder_days=?, active=?, updated_at=datetime('now') WHERE id=?"
  ).run(name, phone, birthday, message || '', group_name || '', reminder_days || 1, active !== undefined ? active : 1, req.params.id);

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
});

app.delete('/api/contacts/:id', (req, res) => {
  db.prepare('DELETE FROM sent_log WHERE contact_id = ?').run(req.params.id);
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// -----------------------------------------
// API — GRUPOS
// -----------------------------------------

app.get('/api/groups', (req, res) => {
  res.json(db.prepare('SELECT * FROM groups ORDER BY name').all());
});

app.post('/api/groups', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });
  try {
    const result = db.prepare('INSERT INTO groups (name, color) VALUES (?, ?)').run(name, color || '#6366f1');
    res.json(db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid));
  } catch {
    res.status(400).json({ error: 'El grupo ya existe' });
  }
});

app.put('/api/groups/:id', (req, res) => {
  const { name, color } = req.body;
  const old = db.prepare('SELECT name FROM groups WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE groups SET name=?, color=? WHERE id=?').run(name, color, req.params.id);
  if (old) db.prepare('UPDATE contacts SET group_name=? WHERE group_name=?').run(name, old.name);
  res.json({ success: true });
});

app.delete('/api/groups/:id', (req, res) => {
  const g = db.prepare('SELECT name FROM groups WHERE id = ?').get(req.params.id);
  if (g) db.prepare("UPDATE contacts SET group_name='' WHERE group_name=?").run(g.name);
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// -----------------------------------------
// API — PLANTILLAS
// -----------------------------------------

app.get('/api/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM message_templates ORDER BY is_default DESC, name').all());
});

app.post('/api/templates', (req, res) => {
  const { name, template, is_default } = req.body;
  if (!name || !template) return res.status(400).json({ error: 'Nombre y mensaje obligatorios' });
  if (is_default) db.prepare('UPDATE message_templates SET is_default = 0').run();
  const result = db.prepare('INSERT INTO message_templates (name, template, is_default) VALUES (?, ?, ?)').run(name, template, is_default ? 1 : 0);
  res.json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/templates/:id', (req, res) => {
  const { name, template, is_default } = req.body;
  if (is_default) db.prepare('UPDATE message_templates SET is_default = 0').run();
  db.prepare('UPDATE message_templates SET name=?, template=?, is_default=? WHERE id=?').run(name, template, is_default ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/templates/:id', (req, res) => {
  db.prepare('DELETE FROM message_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// -----------------------------------------
// API — HISTORIAL
// -----------------------------------------

app.get('/api/log', (req, res) => {
  res.json(db.prepare(`
    SELECT sl.*, c.name as contact_name, c.phone as contact_phone
    FROM sent_log sl LEFT JOIN contacts c ON sl.contact_id = c.id
    ORDER BY sl.sent_at DESC LIMIT 100
  `).all());
});

// -----------------------------------------
// API — AJUSTES
// -----------------------------------------

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?');
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value), String(value));
  }
  res.json({ success: true });
});

// -----------------------------------------
// API — ACCIONES
// -----------------------------------------

app.post('/api/send-test', async (req, res) => {
  const { phone, message } = req.body;
  const result = await sendWhatsAppMessage(phone, message);
  res.json(result);
});

app.post('/api/trigger-check', (req, res) => {
  checkBirthdays();
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const totalContacts = db.prepare('SELECT COUNT(*) as c FROM contacts WHERE active=1').get().c;
  const totalGroups = db.prepare('SELECT COUNT(*) as c FROM groups').get().c;
  const totalSent = db.prepare("SELECT COUNT(*) as c FROM sent_log WHERE status='sent' AND type='birthday'").get().c;

  const contacts = db.prepare('SELECT * FROM contacts WHERE active=1').all();
  const now = new Date();

  const upcoming = contacts.map(c => {
    const [, m, d] = c.birthday.split('-').map(Number);
    let next = new Date(now.getFullYear(), m - 1, d);
    if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
    return { ...c, daysUntil: Math.ceil((next - now) / (1000 * 60 * 60 * 24)) };
  }).filter(c => c.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil);

  const todayStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayBirthdays = contacts.filter(c => c.birthday.substring(5) === todayStr);

  res.json({ totalContacts, totalGroups, totalSent, upcoming, todayBirthdays, whatsappStatus: waStatus });
});

// -----------------------------------------
// FALLBACK
// -----------------------------------------

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// -----------------------------------------
// INICIO
// -----------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  =========================================
     CumpleBot — Felicitaciones WhatsApp
  =========================================
  [+] Servidor activo en http://0.0.0.0:${PORT}
  [i] Conecta WhatsApp escaneando el QR
  `);
});
