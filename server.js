const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const TVClient = require('./tv-client');

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${configPath} — copy config.example.json and set your TV IP.`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function startServer({ configPath, dataDir } = {}) {
  const config = loadConfig(configPath || path.join(__dirname, 'config.json'));
  // dataDir must be writable: inside a packaged app __dirname lives in app.asar,
  // where saving the pairing key silently fails and the TV re-prompts every launch.
  const keyFile = path.join(dataDir || __dirname, 'client-key.json');
  const tv = new TVClient({ ip: config.tvIp, mac: config.tvMac, keyFile });

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const wrap = (fn) => async (req, res) => {
    try {
      const result = await fn(req);
      res.json({ ok: true, result: result ?? null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };

  app.get('/api/status', (req, res) => res.json(tv.status()));

  app.post('/api/button/:name', wrap((req) => tv.button(req.params.name)));

  app.post('/api/volume/up', wrap(() => tv.volumeUp()));
  app.post('/api/volume/down', wrap(() => tv.volumeDown()));
  app.post('/api/volume/set', wrap((req) => tv.setVolume(Number(req.body.volume))));
  app.post('/api/mute', wrap((req) => tv.mute(!!req.body.on)));
  app.post('/api/mute/toggle', wrap(() => tv.toggleMute()));
  app.get('/api/audio', wrap(() => tv.audioStatus()));

  app.post('/api/channel/up', wrap(() => tv.channelUp()));
  app.post('/api/channel/down', wrap(() => tv.channelDown()));

  app.post('/api/media/play', wrap(() => tv.play()));
  app.post('/api/media/pause', wrap(() => tv.pause()));
  app.post('/api/media/stop', wrap(() => tv.stop()));
  app.post('/api/media/rewind', wrap(() => tv.rewind()));
  app.post('/api/media/forward', wrap(() => tv.fastForward()));

  app.post('/api/power/off', wrap(() => tv.powerOff()));
  app.post('/api/power/on', wrap(() => tv.powerOn()));

  // App icons live on the TV behind a self-signed certificate, so the browser
  // refuses them. Proxy them - restricted to the configured TV, never an open proxy.
  app.get('/api/icon', (req, res) => {
    let target;
    try {
      target = new URL(String(req.query.url || ''));
    } catch {
      return res.status(400).end();
    }
    if (target.hostname !== config.tvIp || !['http:', 'https:'].includes(target.protocol)) {
      return res.status(403).end();
    }
    const mod = target.protocol === 'https:' ? https : http;
    const upstream = mod.get(target, { rejectUnauthorized: false }, (r) => {
      if (r.statusCode !== 200) {
        r.resume();
        return res.status(502).end();
      }
      res.setHeader('Content-Type', r.headers['content-type'] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      r.pipe(res);
    });
    upstream.setTimeout(5000, () => upstream.destroy(new Error('icon timeout')));
    upstream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
  });

  app.get('/api/apps', wrap(() => tv.listApps()));
  app.get('/api/inputs', wrap(() => tv.listInputs()));
  app.post('/api/apps/launch', wrap((req) => tv.launchApp(req.body.id)));

  app.post('/api/toast', wrap((req) => tv.toast(String(req.body.message || ''))));
  app.post('/api/input', wrap((req) => tv.switchInput(String(req.body.inputId))));

  const port = config.port || 3030;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const addr = server.address();
      const url = `http://localhost:${addr.port}`;
      console.log(`Remote UI:  ${url}`);
      console.log(`Target TV:  ${config.tvIp}`);
      console.log(`Pair key:   ${keyFile}`);
      resolve({ server, port: addr.port, url, tv });
    });
    server.on('error', reject);
  });
}

module.exports = { startServer, loadConfig };

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
