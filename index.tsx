import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MotorControl() {
  const [motors, setMotors] = useState([
    { steps: 100, rpm: 500, dir: 1 },
    { steps: 100, rpm: 500, dir: 1 },
    { steps: 100, rpm: 500, dir: 1 },
    { steps: 100, rpm: 500, dir: 1 },
  ]);
  const [port, setPort] = useState<any>(null);
  const [monitor, setMonitor] = useState("🟢 Web ready.\n");

  // Kết nối cổng serial (qua Bluetooth/UART)
  async function connectSerial() {
    try {
      const p = await (navigator as any).serial.requestPort();
      await p.open({ baudRate: 9600 });
      setPort(p);
      setMonitor((m) => m + "✅ Connected to Arduino.\n");
    } catch (err) {
      alert("Không thể kết nối cổng serial.");
    }
  }

  // Gửi chuỗi qua serial
  async function sendSerial(cmd: string) {
    if (!port) return alert("⚠️ Chưa kết nối Arduino!");
    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(cmd.trim() + "\n"));
    writer.releaseLock();
    setMonitor((m) => m + "➡️ Sent: " + cmd.trim() + "\n");
  }

  // Tạo chuỗi dữ liệu 4 motor
  function formatCommand() {
    // dạng: V1,VP1,D1;V2,VP2,D2;V3,VP3,D3;V4,VP4,D4;
    const cmd = motors
      .map((m) => `${m.steps},${m.rpm},${m.dir}`)
      .join(";") + ";";
    return cmd;
  }

  // Nhấn SEND
  async function handleSend() {
    const cmd = formatCommand();
    console.log("Send data:", cmd);
    await sendSerial(cmd);
  }

  // Nhấn START
  async function handleStart() {
    await sendSerial("START");
  }

  // Nhấn STOP
  async function handleStop() {
    await sendSerial("STOP");
  }

  // Giao diện
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold text-blue-700">🧠 StringArt Controller</h1>

      <div className="flex flex-wrap gap-2">
        <Button onClick={connectSerial}>🔌 Kết nối</Button>
        <Button onClick={handleSend}>📤 Gửi dữ liệu</Button>
        <Button onClick={handleStart}>▶️ Start</Button>
        <Button onClick={handleStop}>⏹ Stop</Button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {motors.map((m, i) => (
          <div key={i} className="border rounded-lg p-2 shadow-sm">
            <h2 className="font-semibold text-sm text-center">
              Motor {i + 1}
            </h2>
            <div className="space-y-1">
              <label className="block text-xs">Steps</label>
              <input
                type="number"
                value={m.steps}
                onChange={(e) =>
                  setMotors((arr) =>
                    arr.map((x, idx) =>
                      idx === i ? { ...x, steps: +e.target.value } : x
                    )
                  )
                }
                className="w-full border p-1 rounded"
              />
              <label className="block text-xs">RPM</label>
              <input
                type="number"
                value={m.rpm}
                onChange={(e) =>
                  setMotors((arr) =>
                    arr.map((x, idx) =>
                      idx === i ? { ...x, rpm: +e.target.value } : x
                    )
                  )
                }
                className="w-full border p-1 rounded"
              />
              <label className="block text-xs">Dir</label>
              <select
                value={m.dir}
                onChange={(e) =>
                  setMotors((arr) =>
                    arr.map((x, idx) =>
                      idx === i ? { ...x, dir: +e.target.value } : x
                    )
                  )
                }
                className="w-full border p-1 rounded"
              >
                <option value={1}>CW</option>
                <option value={0}>CCW</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-black text-green-400 font-mono text-xs p-2 h-64 overflow-y-scroll rounded">
        {monitor.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
