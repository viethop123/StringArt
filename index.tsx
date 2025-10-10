import React, { useState } from "react";

export default function App() {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter | null>(null);

  const [motorData, setMotorData] = useState({
    M1: { steps: 100, speed: 1000, dir: 1 },
    M2: { steps: 100, speed: 1000, dir: 1 },
    M3: { steps: 100, speed: 1000, dir: 1 },
    M4: { steps: 100, speed: 1000, dir: 1 },
  });

  const connectSerial = async () => {
    try {
      const newPort = await navigator.serial.requestPort();
      await newPort.open({ baudRate: 9600 });
      const newWriter = newPort.writable?.getWriter() || null;
      setPort(newPort);
      setWriter(newWriter);
      alert("✅ Đã kết nối thành công với thiết bị!");
    } catch (err) {
      console.error("Serial connection failed:", err);
      alert("❌ Không thể kết nối Serial");
    }
  };

  const buildDataString = () => {
    // Chuẩn hóa dữ liệu cho 4 động cơ
    const { M1, M2, M3, M4 } = motorData;
    return `${M1.steps},${M1.speed},${M1.dir};${M2.steps},${M2.speed},${M2.dir};${M3.steps},${M3.speed},${M3.dir};${M4.steps},${M4.speed},${M4.dir};`;
  };

  const sendData = async (extraCommand = "") => {
    if (!writer) {
      alert("⚠️ Chưa kết nối thiết bị!");
      return;
    }
    const dataString = buildDataString() + (extraCommand ? extraCommand : "") + "\n";
    console.log("📤 Sending:", dataString);
    await writer.write(new TextEncoder().encode(dataString));
  };

  const handleChange = (motor: string, field: string, value: number) => {
    setMotorData((prev) => ({
      ...prev,
      [motor]: { ...prev[motor], [field]: value },
    }));
  };

  return (
    <div style={{ fontFamily: "monospace", padding: "20px" }}>
      <h2>🛰️ StringArt Control Panel</h2>
      <button onClick={connectSerial}>🔌 Kết nối Serial</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "20px" }}>
        {Object.entries(motorData).map(([motor, data]) => (
          <div key={motor} style={{ border: "1px solid gray", borderRadius: "10px", padding: "10px" }}>
            <h3>{motor}</h3>
            <label>Bước: </label>
            <input
              type="number"
              value={data.steps}
              onChange={(e) => handleChange(motor, "steps", Number(e.target.value))}
            />
            <br />
            <label>Tốc độ: </label>
            <input
              type="number"
              value={data.speed}
              onChange={(e) => handleChange(motor, "speed", Number(e.target.value))}
            />
            <br />
            <label>Chiều: </label>
            <select
              value={data.dir}
              onChange={(e) => handleChange(motor, "dir", Number(e.target.value))}
            >
              <option value={1}>Thuận</option>
              <option value={0}>Ngược</option>
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "30px" }}>
        <button onClick={() => sendData("")}>📤 Send</button>
        <button onClick={() => sendData("START")}>▶️ Start</button>
        <button onClick={() => sendData("PAUSE")}>⏸ Pause</button>
      </div>
    </div>
  );
}
