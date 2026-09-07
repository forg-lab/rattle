// micro:bit over Web Serial.
//
// The board sends one reading per line:
//
//     name,value
//
// and nothing else. Students write the board program themselves, so the parser
// forgives everything it safely can - whitespace, blank lines, CRLF, a bare
// `name` meaning 1 - and reports what it cannot, by line, rather than dropping
// it in silence. A protocol you can get subtly wrong without being told is not
// one you can teach from.
//
// Values carry 0..1, matching every signal in the language. A channel that
// arrives outside that range is passed through but said out loud once, because
// the usual cause is forgetting to scale on the board, and the symptom - a
// parameter pinned at its maximum - looks nothing like the cause.

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * One line from the board -> {name, value} or {error}.
 * Pure, so it can be tested without hardware.
 */
export function parseLine(raw) {
  const line = raw.replace(/[\r\n]+$/, '').trim();
  if (!line || line.startsWith('#')) return null;      // blank or comment

  const comma = line.indexOf(',');
  const name = (comma === -1 ? line : line.slice(0, comma)).trim();
  // A bare `name` is a trigger worth 1: print("clap") is the obvious thing to
  // write, and refusing it would teach nothing.
  const rest = comma === -1 ? '1' : line.slice(comma + 1).trim();

  if (!NAME.test(name)) {
    return { error: `"${name.slice(0, 20)}" is not a channel name (letters, digits, _ ; no spaces)` };
  }
  if (rest === '') return { name, value: 1 };
  if (rest === 'True' || rest === 'true') return { name, value: 1 };
  if (rest === 'False' || rest === 'false') return { name, value: 0 };

  const value = Number(rest);
  if (!Number.isFinite(value)) {
    return { error: `${name} sent "${rest.slice(0, 20)}", which is not a number` };
  }
  return { name, value };
}

export class MicroBit {
  /**
   * @param onReading (name, value) - called for every accepted reading
   * @param onLog     (text, kind)  - 'ok' | 'warn' | 'err'
   */
  constructor(onReading, onLog) {
    this.onReading = onReading;
    this.onLog = onLog || (() => {});
    this.port = null;
    this.reader = null;
    this.connected = false;
    this.channels = new Map();   // name -> last value, for the UI
    this.onClosed = () => {};    // set by the UI, so a lost board updates it
    this.#reset();
  }

  #reset() {
    this.buf = '';
    this.warned = new Set();     // channels already told off, once each
    this.badLines = 0;
    this.lastBadAt = 0;
    // Echo the first handful of lines verbatim. "It does nothing" is nearly
    // always answered by seeing the actual bytes, and the alternative - a
    // toggle nobody finds - answers it for no one.
    this.echo = 6;
    this.silenceTimer = null;
  }

  static get available() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async connect() {
    if (!MicroBit.available) {
      this.onLog('this browser has no Web Serial - use Chrome or Edge', 'err');
      return false;
    }
    try {
      // Filtered to the micro:bit's DAPLink so the picker shows one obvious
      // entry rather than every serial device on the machine.
      this.port = await navigator.serial.requestPort({
        filters: [{ usbVendorId: 0x0d28, usbProductId: 0x0204 }],
      });
      await this.port.open({ baudRate: 115200 });
      // Some CDC firmware sends nothing until the host raises DTR. Harmless
      // where it is not needed, and the difference between working and a
      // completely silent port where it is.
      try {
        await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
      } catch (_) { /* not every platform implements it; not fatal */ }
    } catch (e) {
      // Cancelling the picker is a choice, not a fault.
      if (e && e.name === 'NotFoundError') return false;
      this.onLog('could not open the micro:bit: ' + (e.message || e), 'err');
      this.port = null;
      return false;
    }
    this.#reset();
    this.connected = true;
    this.onLog('micro:bit connected · listening', 'ok');
    // A port that opens but never speaks is the commonest failure, and looks
    // exactly like a working one until you notice nothing changes.
    this.silenceTimer = setTimeout(() => {
      if (this.connected && this.channels.size === 0) {
        this.onLog('micro:bit: connected, but the board has sent nothing. Is ' +
                   'controller.py flashed and running? Press the reset button ' +
                   'on the back.', 'warn');
      }
    }, 2500);
    this.#read();
    return true;
  }

  async disconnect() {
    this.connected = false;
    clearTimeout(this.silenceTimer);
    try { if (this.reader) await this.reader.cancel(); } catch (_) { /* already gone */ }
    try { if (this.port) await this.port.close(); } catch (_) { /* already gone */ }
    this.reader = null;
    this.port = null;
    this.channels.clear();
    this.onLog('micro:bit disconnected', 'warn');
  }

  async #read() {
    const decoder = new TextDecoder();
    try {
      this.reader = this.port.readable.getReader();
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.#feed(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (this.connected) this.onLog('micro:bit read stopped: ' + (e.message || e), 'err');
    } finally {
      try { this.reader && this.reader.releaseLock(); } catch (_) { /* fine */ }
      if (this.connected) {
        // Unplugged mid-run. Say so; the program keeps playing on last values.
        this.connected = false;
        this.port = null;
        clearTimeout(this.silenceTimer);
        this.onLog('micro:bit unplugged', 'warn');
        this.onClosed();
      }
    }
  }

  /** Split a chunk into lines and hand each to the parser. Exposed for tests. */
  feed(text) { this.#feed(text); }

  #feed(text) {
    this.buf += text;
    // A board that never prints a newline would otherwise grow this forever.
    if (this.buf.length > 4096) this.buf = this.buf.slice(-1024);

    const lines = this.buf.split('\n');
    this.buf = lines.pop();
    for (const line of lines) {
      if (this.echo > 0) {
        this.echo--;
        this.onLog('micro:bit sent: ' + JSON.stringify(line), '');
        if (this.echo === 0) this.onLog('micro:bit: ...listening quietly from here', '');
      }
      const r = parseLine(line);
      if (!r) continue;
      if (r.error) { this.#complain(r.error); continue; }

      if ((r.value < 0 || r.value > 1) && !this.warned.has(r.name)) {
        this.warned.add(r.name);
        this.onLog(
          `micro:bit: "${r.name}" sent ${r.value} - channels carry 0..1, ` +
          `so scale on the board (temperature() / 50, and so on)`, 'warn');
      }
      this.channels.set(r.name, r.value);
      this.onReading(r.name, r.value);
    }
  }

  // A board printing garbage would otherwise fill the log faster than anyone
  // could read it, so say it at most once a second and count the rest.
  #complain(text) {
    this.badLines++;
    const now = Date.now();
    if (now - this.lastBadAt < 1000) return;
    this.lastBadAt = now;
    const extra = this.badLines > 1 ? ` (${this.badLines} bad lines so far)` : '';
    this.onLog('micro:bit: ' + text + extra, 'warn');
  }
}
