import React, { useState } from "react";

export default function App() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [server, setServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [motorData, setMotorData] = useState([
    { v: "", rpm: "", dir: "" },
    { v: "", rpm: "", dir: "" },
    { v: "", rpm: "", dir: "" },
    { v: "", rpm: "", dir: "" },
  ]);

  const log = (msg: string) => setLogs((prev) => [msg, ...prev]);

  const connectBLE = async () => {
    try {
      log("🔍 Scanning for HM-10...");
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "HM" }],
        optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"],
      });
      setDevice(dev);
      const srv = await dev.gatt!.connect();
      setServer(srv);
      const service = await srv.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb");
      const ch = await service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb");
      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", (event: any) => {
        const value = new TextDecoder().decode(event.target.value);
        log("📩 From Nano: " + value);
      });
      setCharacteristic(ch);
      log("✅ Connected to HM-10 successfully!");
    } catch (err) {
      log("❌ Connection failed: " + err);
    }
  };

  const sendBLE = async (data: string) => {
    if (!characteristic) {
      log("⚠️ Not connected yet!");
      return;
    }
    const encoder = new TextEncoder();
    await characteristic.writeValue(encoder.encode(data + "\n"));
    log("📤 Sent: " + data);
  };

  const handleChange = (i: number, field: string, value: string) => {
    const newData = [...motorData];
    // loại bỏ ký tự không hợp lệ
    if (field === "v" || field === "rpm") value = value.replace(/[^0-9.]/g, "");
    if (field === "dir") value = value.replace(/[^01]/g, "");
    (newData[i] as any)[field] = value;
    setMotorData(newData);
  };

  const handleSend = () => {
    const parts = motorData.map((m) => `${m.v || 0},${m.rpm || 0},${m.dir || 0}`);
    const full = "DATA:" + parts.join(";") + "\n";
    sendBLE(full);
  };

  const handleStart = () => sendBLE("CMD:START");
  const handlePause = () => sendBLE("CMD:PAUSE");

  return (
    <div style={{ fontFamily: "monospace", padding: 20 }}>
      <h2>⚙️ StringArt BLE Controller</h2>
      <button onClick={connectBLE}>🔗 Connect</button>
      <button onClick={handleSend} disabled={!characteristic}>📤 Send</button>
      <button onClick={handleStart} disabled={!characteristic}>▶️ Start</button>
      <button onClick={handlePause} disabled={!characteristic}>⏸ Pause</button>

      <table style={{ marginTop: 15, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Motor</th>
            <th>Vòng (V)</th>
            <th>RPM</th>
            <th>Chiều (1=Thuận,0=Nghịch)</th>
          </tr>
        </thead>
        <tbody>
          {motorData.map((m, i) => (
            <tr key={i}>
              <td style={{ padding: 5 }}>M{i + 1}</td>
              <td><input value={m.v} onChange={(e) => handleChange(i, "v", e.target.value)} style={{ width: 60 }} /></td>
              <td><input value={m.rpm} onChange={(e) => handleChange(i, "rpm", e.target.value)} style={{ width: 60 }} /></td>
              <td><input value={m.dir} onChange={(e) => handleChange(i, "dir", e.target.value)} style={{ width: 60 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 20,
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 8,
        height: 200,
        overflowY: "auto",
        background: "#f8f8f8"
      }}>
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
