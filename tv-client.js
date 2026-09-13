const fs = require('fs');
const path = require('path');
const lgtv = require('lgtv2');
const wol = require('wake_on_lan');

// Legacy location: next to the source files. Inside a packaged .app this sits in
// the read-only app.asar, so it can be read but never written.
const LEGACY_KEY_FILE = path.join(__dirname, 'client-key.json');

function resolveKeyFile(keyFile) {
  if (!keyFile) return LEGACY_KEY_FILE;
  // First run in a writable data dir: inherit the key we were already paired with
  // so the TV never asks for confirmation again.
  if (!fs.existsSync(keyFile) && fs.existsSync(LEGACY_KEY_FILE)) {
    try {
      fs.mkdirSync(path.dirname(keyFile), { recursive: true });
      fs.copyFileSync(LEGACY_KEY_FILE, keyFile);
      console.log(`[TV] migrated pairing key to ${keyFile}`);
    } catch (e) {
      console.log('[TV] could not migrate pairing key:', e.message);
    }
  }
  return keyFile;
}

class TVClient {
  constructor({ ip, mac, keyFile }) {
    this.ip = ip;
    this.mac = mac;
    this.keyFile = resolveKeyFile(keyFile);
    this.connected = false;
    this.awaitingAuth = false;
    this.keyError = null;
    this.pointerSocket = null;

    const storedKey = this.loadStoredKey();
    console.log(
      storedKey
        ? `[TV] using stored pairing key from ${this.keyFile}`
        : `[TV] no pairing key yet, will save to ${this.keyFile}`
    );

    const useWss = process.env.REMOTEC_WSS !== '0';
    this.tv = lgtv({
      url: useWss ? `wss://${ip}:3001` : `ws://${ip}:3000`,
      wsconfig: useWss ? { tlsOptions: { rejectUnauthorized: false } } : undefined,
      reconnect: 5000,
      // `undefined` (never null) so lgtv2 treats the key as absent rather than empty.
      clientKey: storedKey || undefined,
      keyFile: this.keyFile,
      saveKey: (key, cb) => {
        try {
          this.saveKey(key);
          this.keyError = null;
          console.log(`[TV] pairing key saved to ${this.keyFile}`);
          cb && cb(null);
        } catch (e) {
          this.keyError = e.message;
          console.error(`[TV] FAILED to save pairing key to ${this.keyFile}: ${e.message}`);
          cb && cb(e);
        }
      },
    });

    this.tv.on('connect', () => {
      this.connected = true;
      this.awaitingAuth = false;
      console.log(`[TV] connected to ${ip}`);
      this.tv.getSocket(
        'ssap://com.webos.service.networkinput/getPointerInputSocket',
        (err, sock) => {
          if (!err) this.pointerSocket = sock;
        }
      );
    });

    this.tv.on('close', () => {
      this.connected = false;
      this.pointerSocket = null;
      console.log('[TV] disconnected');
    });

    this.tv.on('error', (err) => {
      console.log('[TV] error:', err.message);
    });

    this.tv.on('prompt', () => {
      this.awaitingAuth = true;
      console.log('[TV] waiting for pairing confirmation on the TV screen');
    });
  }

  loadStoredKey() {
    try {
      const raw = fs.readFileSync(this.keyFile, 'utf8').trim();
      // Accept both our JSON format and lgtv2's bare-string keyfile.
      if (raw.startsWith('{')) return JSON.parse(raw).clientKey || null;
      return raw || null;
    } catch {
      return null;
    }
  }

  saveKey(key) {
    fs.mkdirSync(path.dirname(this.keyFile), { recursive: true });
    fs.writeFileSync(this.keyFile, JSON.stringify({ clientKey: key }, null, 2));
  }

  status() {
    return {
      ip: this.ip,
      connected: this.connected,
      awaitingAuth: this.awaitingAuth,
      hasClientKey: !!this.loadStoredKey(),
      keyFile: this.keyFile,
      keyError: this.keyError,
    };
  }

  request(uri, payload) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('TV not connected'));
      this.tv.request(uri, payload, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  button(name) {
    return new Promise((resolve, reject) => {
      if (!this.pointerSocket) return reject(new Error('pointer socket not ready'));
      this.pointerSocket.send('button', { name });
      resolve({ ok: true });
    });
  }

  volumeUp() { return this.request('ssap://audio/volumeUp'); }
  volumeDown() { return this.request('ssap://audio/volumeDown'); }
  setVolume(v) { return this.request('ssap://audio/setVolume', { volume: v }); }
  mute(on) { return this.request('ssap://audio/setMute', { mute: !!on }); }

  // The physical remote has a single mute key, so mirror it: read the current
  // state from the TV and invert it.
  async toggleMute() {
    const status = await this.request('ssap://audio/getStatus');
    const next = !status.mute;
    await this.mute(next);
    return { mute: next };
  }

  audioStatus() { return this.request('ssap://audio/getStatus'); }

  channelUp() { return this.request('ssap://tv/channelUp'); }
  channelDown() { return this.request('ssap://tv/channelDown'); }

  play() { return this.request('ssap://media.controls/play'); }
  pause() { return this.request('ssap://media.controls/pause'); }
  stop() { return this.request('ssap://media.controls/stop'); }
  rewind() { return this.request('ssap://media.controls/rewind'); }
  fastForward() { return this.request('ssap://media.controls/fastForward'); }

  powerOff() { return this.request('ssap://system/turnOff'); }

  powerOn() {
    return new Promise((resolve, reject) => {
      if (!this.mac) return reject(new Error('MAC address not configured for Wake-on-LAN'));
      wol.wake(this.mac, (err) => (err ? reject(err) : resolve({ ok: true })));
    });
  }

  launchApp(id) {
    return this.request('ssap://system.launcher/launch', { id });
  }

  listApps() {
    return this.request('ssap://com.webos.applicationManager/listLaunchPoints');
  }

  listInputs() {
    return this.request('ssap://tv/getExternalInputList');
  }

  toast(message) {
    return this.request('ssap://system.notifications/createToast', { message });
  }

  switchInput(inputId) {
    return this.request('ssap://tv/switchInput', { inputId });
  }
}

module.exports = TVClient;
