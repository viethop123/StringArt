import React, { useState } from "react";

let bleDevice: BluetoothDevice | null = null;
let bleCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState("100,1000,1;0,0,0;0,0,0;0,0,0");

  async function connectBluetooth() {
    try {
      bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "HC" }],
        optionalServices: [0xFFE0],
      });
      const server = await bleDevice.gatt!.connect();
      const service = await server.getPrimaryService(0xFFE0);
      bleCharacteristic = await service.getCharacteristic(0xFFE1);
      setConnected(true);
      alert("Connected to BLE!");
    } catch (error) {
      alert("Connection failed: " + error);
    }
  }

  function handleSend() {
    if (!bleCharacteristic) {
      alert("Not connected!");
      return;
    }
    const msg = data.trim() + "\n";
    bleCharacteristic.writeValue(new TextEncoder().encode(msg));
    console.log("Sent:", msg);
    alert("Data sent!");
  }

  function handleStart() {
    if (!bleCharacteristic) {
      alert("Not connected!");
      return;
    }
    bleCharacteristic.writeValue(new TextEncoder().encode("START\n"));
    console.log("Sent: START");
  }

  function handlePause() {
    if (!bleCharacteristic) {
      alert("Not connected!");
      return;
    }
    bleCharacteristic.writeValue(new TextEncoder().encode("PAUSE\n"));
    console.log("Sent: PAUSE");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h2>🎨 String Art Controller</h2>
      <p>Status: {connected ? "🟢 Connected" : "🔴 Disconnected"}</p>

      <button onClick={connectBluetooth}>🔗 Connect</button>

      <div style={{ marginTop: 10 }}>
        <textarea
          rows={3}
          style={{ width: "100%" }}
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleSend}>📤 Send Data</button>
        <button onClick={handleStart}>▶️ Start</button>
        <button onClick={handlePause}>⏸ Pause</button>
      </div>

      <p style={{ marginTop: 20 }}>
        💡 Chuỗi ví dụ:  
        <br />
        <code>100,1000,1;50,800,0;10,500,1;5,300,0</code>
      </p>
    </div>
  );
}
