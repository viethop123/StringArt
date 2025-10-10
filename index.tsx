import React, { useEffect, useRef, useState } from "react";

/**
 * index.tsx - Web BLE controller for HM-10 (UART FFE0/FFE1)
 * - Connect -> Send (DATA:) -> Start (CMD:START) -> Pause (CMD:PAUSE)
 * - Sends chunked (20 bytes) writes and waits for ACK:DATA (if module supports notify)
 */

const UART_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const UART_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 40;
const ACK_TIMEOUT_MS = 2000;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [canStartPause, setCanStartPause] = useState(false);
  const [sending, setSending] = useState(false);

  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  // motor inputs (4 motors)
  const [motors, setMotors] = useState([
    { v: "100", rpm: "100", dir: "1" },
    { v: "100", rpm: "60", dir: "1" },
    { v: "100", rpm: "100", dir: "1" },
    { v: "100", rpm: "60", dir: "1" },
  ]);

  const pushLog = (s: string) => {
    setLogLines((l) => [new Date().toLocaleTimeString() + " " + s, ...l].slice(0, 300));
    console.log(s);
  };

  // connect to HM-10
  async function connectBLE() {
    try {
      pushLog("🔍 Scanning BLE devices (HM-10)...");
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [UART_SERVICE],
      });
      deviceRef.current = device;
      pushLog("Device selected: " + (device.name || device.id));

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(UART_SERVICE);
      const ch = await service.getCharacteristic(UART_CHAR);

      // enable notifications if available
      try {
        await ch.startNotifications();
        ch.addEventListener("characteristicvaluechanged", handleNotification);
        pushLog("Notifications enabled");
      } catch (err) {
        pushLog("Notifications not available: " + String(err));
      }

      characteristicRef.current = ch;
      setConnected(true);
      setCanStartPause(false);
      pushLog("✅ Connected");
      device.addEventListener("gattserverdisconnected", () => {
        pushLog("Device disconnected");
        setConnected(false);
        setCanStartPause(false);
        characteristicRef.current = null;
        deviceRef.current = null;
      });
    } catch (err) {
      pushLog("Connect failed: " + String(err));
    }
  }

  // notification handler (ACKs and other messages)
  function handleNotification(ev: Event) {
    // @ts-ignore
    const dv: DataView = (ev as any).target.value;
    const text = new TextDecoder().decode(dv);
    pushLog("📩 RX: " + text.trim());

    if (text.indexOf("ACK:DATA") !== -1) {
      setCanStartPause(true);
      pushLog("ACK:DATA received — Start/Pause enabled");
    }
    if (text.indexOf("ACK:START") !== -1) {
      pushLog("ACK:START received");
    }
    if (text.indexOf("ACK:PAUSE") !== -1) {
      pushLog("ACK:PAUSE received");
    }
  }

  // chunked write (works around 20-byte BLE limit)
  async function writeChunks(payload: Uint8Array) {
    const ch = characteristicRef.current;
    if (!ch) throw new Error("No characteristic");
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const slice = payload.slice(i, i + CHUNK_SIZE);
      await ch.writeValue(slice);
      // small delay to avoid HM-10 internal queue overflow
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }

  // wait for ACK substring via notifications (if available)
  function waitForAck(sub: string, timeout = ACK_TIMEOUT_MS) {
    return new Promise<boolean>((resolve) => {
      let timer: any;
      const handler = (ev: Event) => {
        // @ts-ignore
        const dv: DataView = (ev as any).target.value;
        const t = new TextDecoder().decode(dv);
        if (t.indexOf(sub) !== -1) {
          characteristicRef.current?.removeEventListener("characteristicvaluechanged", handler);
          clearTimeout(timer);
          resolve(true);
        }
      };
      // If no notifications supported, we'll timeout
      characteristicRef.current?.addEventListener("characteristicvaluechanged", handler);
      timer = setTimeout(() => {
        try { characteristicRef.current?.removeEventListener("characteristicvaluechanged", handler); } catch {}
        resolve(false);
      }, timeout);
    });
  }

  // build payload from motor inputs
  function buildPayload(): string {
    // sanitize and ensure exactly 4 groups
    const groups = motors.slice(0, 4).map((m) => {
      const v = (m.v || "0").toString().trim();
      const rpm = (m.rpm || "0").toString().trim();
      const dir = (m.dir === "0" || m.dir === "1") ? m.dir : (parseInt(dirOr(m.dir)) ? "1" : "0");
      return `${v},${rpm},${dir}`;
    });
    return groups.join(";") + ";";
  }

  // helper if messed dir type
  function dirOr(s: any) { try { return String(s); } catch { return "1"; } }

  // SEND (load data into Nano)
  async function handleSend() {
    if (!characteristicRef.current) { pushLog("⚠ Not connected"); return; }
    if (sending) { pushLog("⚠ Already sending"); return; }
    setSending(true);
    setCanStartPause(false);
    const payload = buildPayload();
    const framed = "DATA:" + payload + "\n";
    pushLog("TX DATA -> " + payload);

    try {
      const encoded = new TextEncoder().encode(framed);
      await writeChunks(encoded);

      // wait for ACK:DATA (if notifications supported)
      const ok = await waitForAck("ACK:DATA", ACK_TIMEOUT_MS);
      if (ok) {
        pushLog("✅ DATA acknowledged by Nano");
        setCanStartPause(true);
      } else {
        pushLog("⚠ No ACK:DATA (timeout). Start may still work — proceed with caution.");
        // enable Start anyway so user can test
        setCanStartPause(true);
      }
    } catch (err) {
      pushLog("❌ Send failed: " + String(err));
    } finally {
      setSending(false);
    }
  }

  // START (only sends command)
  async function handleStart() {
    if (!characteristicRef.current) { pushLog("⚠ Not connected"); return; }
    if (!canStartPause) { pushLog("⚠ Data not loaded yet (no ACK)"); }
    pushLog("TX CMD:START");
    try {
      const encoded = new TextEncoder().encode("CMD:START\n");
      await writeChunks(encoded);
    } catch (err) {
      pushLog("❌ START failed: " + String(err));
    }
  }

  // PAUSE
  async function handlePause() {
    if (!characteristicRef.current) { pushLog("⚠ Not connected"); return; }
    pushLog("TX CMD:PAUSE");
    try {
      const encoded = new TextEncoder().encode("CMD:PAUSE\n");
      await writeChunks(encoded);
    } catch (err) {
      pushLog("❌ PAUSE failed: " + String(err));
    }
  }

  // UI changes for inputs
  function updateMotor(idx: number, field: "v" | "rpm" | "dir", value: string) {
    setMotors((prev) => {
      const copy = prev.map((x) => ({ ...x }));
      if (field === "v" || field === "rpm") value = value.replace(/[^0-9.]/g, "");
      if (field === "dir") value = value.replace(/[^01]/g, "");
      copy[idx][field] = value;
      return copy;
    });
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Roboto, sans-serif" }}>
      <h2>StringArt — BLE (HM-10) controller</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={connectBLE} disabled={connected}>🔌 Connect</button>
        <button onClick={handleSend} disabled={!connected || sending}>📤 Send data</button>
        <button onClick={handleStart} disabled={!connected || !canStartPause}>▶ Start</button>
        <button onClick={handlePause} disabled={!connected || !canStartPause}>⏸ Pause</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {motors.map((m, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>M{i + 1}</div>
            <div style={{ marginTop: 6 }}>
              <label>V (revs)</label><br />
              <input value={m.v} onChange={(e) => updateMotor(i, "v", e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ marginTop: 6 }}>
              <label>RPM</label><br />
              <input value={m.rpm} onChange={(e) => updateMotor(i, "rpm", e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ marginTop: 6 }}>
              <label>Dir (1=F)</label><br />
              <input value={m.dir} onChange={(e) => updateMotor(i, "dir", e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <h4>Log</h4>
        <div style={{ background: "#111", color: "#6f6", padding: 8, height: 260, overflow: "auto", fontFamily: "monospace" }}>
          {logLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
