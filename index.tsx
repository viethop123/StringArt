import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function MotorControl() {
  const [motors, setMotors] = useState([
    { steps: 100, rpm: 1000, dir: 1 },
    { steps: 0, rpm: 0, dir: 0 },
    { steps: 0, rpm: 0, dir: 0 },
    { steps: 0, rpm: 0, dir: 0 },
  ]);

  const [port, setPort] = useState<any>(null);
  const [monitor, setMonitor] = useState<string>("System ready.\n");

  async function connect() {
    const p = await (navigator as any).serial.requestPort();
    await p.open({ baudRate: 9600 });
    setPort(p);
    setMonitor((m) => m + "✅ Connected.\n");
  }

  async function sendCommand(cmd: string) {
    if (!port) return alert("Chưa kết nối!");

    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(cmd + "\n"));
    writer.releaseLock();

    setMonitor((m) => m + "➡️ Sent: " + cmd + "\n");
  }

  function formatCommand() {
    return motors.map((m) => `${m.steps},${m.rpm},${m.dir},0`).join(";") + ";";
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">🧠 Motor Controller</h1>

      <Button onClick={connect}>Kết nối</Button>
      <Button onClick={() => sendCommand(formatCommand())}>Gửi dữ liệu</Button>
      <Button onClick={() => sendCommand("START")}>Start</Button>
      <Button onClick={() => sendCommand("STOP")}>Stop</Button>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {motors.map((m, i) => (
          <div key={i} className="p-2 border rounded-lg">
            <h2 className="font-semibold">Motor {i + 1}</h2>
            <label>Steps</label>
            <input
              type="number"
              value={m.steps}
              onChange={(e) =>
                setMotors(
                  motors.map((x, idx) =>
                    idx === i ? { ...x, steps: +e.target.value } : x
                  )
                )
              }
              className="w-full border p-1 rounded"
            />
            <label>RPM</label>
            <input
              type="number"
              value={m.rpm}
              onChange={(e) =>
                setMotors(
                  motors.map((x, idx) =>
                    idx === i ? { ...x, rpm: +e.target.value } : x
                  )
                )
              }
              className="w-full border p-1 rounded"
            />
            <label>Dir</label>
            <select
              value={m.dir}
              onChange={(e) =>
                setMotors(
                  motors.map((x, idx) =>
                    idx === i ? { ...x, dir: +e.target.value } : x
                  )
                )
              }
              className="w-full border p-1 rounded"
            >
              <option value={1}>Forward</option>
              <option value={0}>Reverse</option>
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 p-2 bg-black text-green-400 font-mono h-48 overflow-y-scroll">
        {monitor.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
