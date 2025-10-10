import React, { useRef, useState } from "react";

const UART_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const UART_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 40;
const ACK_TIMEOUT_MS = 2000;

export default function App() {
  const [connected, setConnected] = useState(false);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [canStartPause, setCanStartPause] = useState(false);

  const [motors, setMotors] = useState([
    { v: "100", rpm: "60", dir: "1" },
    { v: "0", rpm: "0", dir: "0" },
    { v: "0", rpm: "0", dir: "0" },
    { v: "0", rpm: "0", dir: "0" },
  ]);

  const pushLog = (s: string) => setLogs((l) => [new Date().toLocaleTimeString() + " " + s, ...l].slice(0, 400));

  async function connectBLE() {
    try {
      pushLog("🔍 Scanning BLE...");
      const d = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [UART_SERVICE],
      });
      deviceRef.current = d;
      pushLog("Selected: " + (d.name || d.id));
      const server = await d.gatt!.connect();
      const svc = await server.getPrimaryService(UART_SERVICE);
      const ch = await svc.getCharacteristic(UART_CHAR);

      // try notifications
      try {
        await ch.startNotifications();
        ch.addEventListener("characteristicvaluechanged", handleNotification);
        pushLog("Notifications enabled");
      } catch (e) {
        pushLog("Notifications unavailable: " + String(e));
      }

      charRef.current = ch;
      setConnected(true);
      setCanStartPause(false);
      pushLog("✅ Connected");
      d.addEventListener("gattserverdisconnected", () => {
        pushLog("Device disconnected");
        setConnected(false);
        setCanStartPause(false);
        charRef.current = null;
        deviceRef.current = null;
      });
    } catch (e) {
      pushLog("Connect failed: " + String(e));
    }
  }

  function handleNotification(ev: Event) {
    // @ts-ignore
    const dv: DataView = (ev as any).target.value;
    const text = new TextDecoder().decode(dv);
    pushLog("📩 RX: " + text.trim());
    if (text.indexOf("ACK:DATA") !== -1) {
      setCanStartPause(true);
      pushLog("ACK:DATA received → Start/ Pause enabled");
    }
  }

  // chunk writer
  async function writeChunks(buf: Uint8Array) {
    const ch = charRef.current;
    if (!ch) throw new Error("No characteristic");
    for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
      const slice = buf.slice(i, i + CHUNK_SIZE);
      await ch.writeValue(slice);
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }

  // Build payload exactly 4 groups: v,rpm,dir;...;
  function buildPayload(): string {
    const groups = motors.slice(0, 4).map((m) => {
      // sanitize numeric-like strings (remove invalid chars)
      const v = (m.v || "0").toString().trim().replace(/[^0-9.]/g, "") || "0";
      const rpm = (m.rpm || "0").toString().trim().replace(/[^0-9.]/g, "") || "0";
      const dir = (m.dir === "0" ? "0" : "1");
      return `${v},${rpm},${dir}`;
    });
    return groups.join(";") + ";";
  }

  async function handleSend() {
    if (!charRef.current) { pushLog("⚠ Not connected"); return; }
    if (sending) { pushLog("⚠ Already sending"); return; }
    setSending(true);
    setCanStartPause(false);

    const payload = buildPayload();
    pushLog("TX DATA -> " + payload);
    try {
      const framed = "DATA:" + payload + "\n";
      const encoded = new TextEncoder().encode(framed);
      await writeChunks(encoded);

      // wait ack if notifications present
      let ack = await new Promise<boolean>((resolve) => {
        let resolved = false;
        const handler = (ev: Event) => {
          // @ts-ignore
          const v: DataView = (ev as any).target.value;
          const t = new TextDecoder().decode(v);
          if (t.indexOf("ACK:DATA") !== -1) {
            resolved = true;
            resolve(true);
          }
        };
        charRef.current?.addEventListener("characteristicvaluechanged", handler);
        setTimeout(() => {
          if (!resolved) {
            try { charRef.current?.removeEventListener("characteristicvaluechanged", handler); } catch {}
            resolve(false);
          }
        }, ACK_TIMEOUT_MS);
      });

      if (ack) {
        pushLog("✅ ACK:DATA received");
        setCanStartPause(true);
      } else {
        pushLog("⚠ No ACK:DATA (timeout) — enabling Start anyway");
        setCanStartPause(true);
      }
    } catch (err) {
      pushLog("❌ Send failed: " + String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleStart() {
    if (!charRef.current) { pushLog("⚠ Not connected"); return; }
    if (!canStartPause) pushLog("⚠ Warning: data not confirmed (no ACK) but sending START");
    pushLog("TX CMD:START");
    try {
      const encoded = new TextEncoder().encode("CMD:START\n");
      await writeChunks(encoded);
    } catch (err) { pushLog("❌ START failed: " + String(err)); }
  }

  async function handlePause() {
    if (!charRef.current) { pushLog("⚠ Not connected"); return; }
    pushLog("TX CMD:PAUSE");
    try {
      const encoded = new TextEncoder().encode("CMD:PAUSE\n");
      await writeChunks(encoded);
    } catch (err) { pushLog("❌ PAUSE failed: " + String(err)); }
  }

  function updateMotor(i: number, field: "v" | "rpm" | "dir", val: string) {
    setMotors((prev) => {
      const copy = prev.map((x) => ({ ...x }));
      // restrict input characters
      if (field === "dir") val = val.replace(/[^01]/g, "");
      else val = val.replace(/[^0-9.]/g, "");
      copy[i][field] = val;
      return copy;
    });
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Roboto, sans-serif" }}>
      <h3>StringArt — BLE controller (HM-10)</h3>

      <div style={{ marginBottom: 12 }}>
        <button onClick={connectBLE} disabled={connected}>🔌 Connect</button>
        <button onClick={handleSend} disabled={!connected || sending}>📤 Send data</button>
        <button onClick={handleStart} disabled={!connected || !canStartPause}>▶ Start</button>
        <button onClick={handlePause} disabled={!connected || !canStartPause}>⏸ Pause</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {motors.map((m, i) => (
          <div key={i} style={{ border: "1px solid #ddd", padding: 8, borderRadius: 6 }}>
            <div style={{ fontWeight: 700 }}>M{i + 1}</div>
            <label>V (revs)</label>
            <input value={m.v} onChange={(e) => updateMotor(i, "v", e.target.value)} style={{ width: "100%" }} />
            <label>RPM</label>
            <input value={m.rpm} onChange={(e) => updateMotor(i, "rpm", e.target.value)} style={{ width: "100%" }} />
            <label>Dir (1=F)</label>
            <input value={m.dir} onChange={(e) => updateMotor(i, "dir", e.target.value)} style={{ width: "100%" }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Log</h4>
        <div style={{ background: "#111", color: "#6f6", padding: 8, height: 260, overflow: "auto", fontFamily: "monospace" }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
