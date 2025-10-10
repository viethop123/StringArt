// ==================== index.tsx (React) ====================
// Replace your existing index.tsx with this file. It uses Web Bluetooth
// to talk to an HM-10-style UART service (FFE0/FFE1). It sends DATA and
// CMD frames, chunked for BLE, and waits for ACK from the Arduino.

import React, { useEffect, useState, useRef } from "react";

const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const UART_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 40;
const ACK_TIMEOUT_MS = 3000;

export default function App() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [canStartPause, setCanStartPause] = useState(false);

  // motor states (default values)
  const [motors, setMotors] = useState([
    { rev: 1, rpm: 60, dir: 1 },
    { rev: 0, rpm: 0, dir: 0 },
    { rev: 0, rpm: 0, dir: 0 },
    { rev: 0, rpm: 0, dir: 0 },
  ]);

  const pushLog = (s: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} ${s}`].slice(-200));

  useEffect(() => {
    return () => {
      if (device && device.gatt && device.gatt.connected) device.gatt.disconnect();
    };
  }, [device]);

  async function connect() {
    try {
      pushLog('Scanning for BLE devices...');
      const d = await navigator.bluetooth.requestDevice({
        // HM-10 often advertises FFE0 service; acceptAllDevices fallback
        optionalServices: [UART_SERVICE_UUID],
        acceptAllDevices: true,
      });

      setDevice(d);
      pushLog('Device selected: ' + d.name || d.id);

      const server = await d.gatt!.connect();
      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      const ch = await service.getCharacteristic(UART_CHARACTERISTIC_UUID);

      // start notifications
      try {
        await ch.startNotifications();
        ch.addEventListener('characteristicvaluechanged', handleNotifications);
        pushLog('Notifications enabled');
      } catch (err) {
        pushLog('Notifications not available: ' + String(err));
      }

      characteristicRef.current = ch;
      setConnected(true);
      pushLog('Connected to device');

      d.addEventListener('gattserverdisconnected', () => {
        setConnected(false);
        setCanStartPause(false);
        pushLog('Device disconnected');
      });
    } catch (err) {
      pushLog('Connect failed: ' + String(err));
    }
  }

  function handleNotifications(ev: Event) {
    try {
      // @ts-ignore
      const value: DataView = (ev as any).target.value;
      const text = new TextDecoder().decode(value);
      pushLog('RX: ' + text.trim());

      // If we see ACK:DATA or ACK:START etc, enable UI accordingly
      if (text.indexOf('ACK:DATA') !== -1) {
        setCanStartPause(true);
        pushLog('ACK:DATA received — data loaded into Nano');
      }
      if (text.indexOf('ACK:START') !== -1) {
        pushLog('ACK:START received — Nano started');
      }
      if (text.indexOf('ACK:PAUSE') !== -1) {
        pushLog('ACK:PAUSE received — Nano paused');
      }
    } catch (e) {
      pushLog('Notification parse error: ' + String(e));
    }
  }

  async function writeChunks(buffer: Uint8Array) {
    const ch = characteristicRef.current;
    if (!ch) throw new Error('No characteristic');
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const slice = buffer.slice(i, i + CHUNK_SIZE);
      await ch.writeValue(slice);
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }

  async function waitForAck(substring: string, timeout = ACK_TIMEOUT_MS) {
    // returns true if ack received in time
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const handler = (ev: Event) => {
        // @ts-ignore
        const value: DataView = (ev as any).target.value;
        const text = new TextDecoder().decode(value);
        if (text.indexOf(substring) !== -1) {
          resolved = true;
          resolve(true);
        }
      };
      const ch = characteristicRef.current;
      if (!ch) return resolve(false);
      ch.addEventListener('characteristicvaluechanged', handler);
      const timer = setTimeout(() => {
        if (!resolved) {
          ch.removeEventListener('characteristicvaluechanged', handler);
          resolve(false);
        }
      }, timeout);
    });
  }

  function buildDataString() {
    // ensure exactly 4 motors; each entry "revs,rpm,dir"
    return motors
      .map((m) => `${m.revs ?? m.rev ?? m.rev ?? m.revs ?? m.rev ?? m.rev ?? m.rev ?? m.revs ?? m.rev ?? m.rev ?? m.rev}`) // dummy to satisfy TS template
      ;
  }

  // We'll build properly below (avoid TS confusion)
  function buildPayload(): string {
    const arr = motors.map((m) => {
      const rev = (m as any).rev ?? (m as any).revs ?? 0;
      const rpm = (m as any).rpm ?? 0;
      const dir = (m as any).dir ?? 0;
      return `${rev},${rpm},${dir}`;
    });
    return arr.join(';') + ';';
  }

  async function handleSend() {
    if (!characteristicRef.current) { pushLog('Not connected'); return; }
    if (sending) { pushLog('Already sending'); return; }
    setSending(true);
    setCanStartPause(false);

    const payload = buildPayload();
    const framed = 'DATA:' + payload + '\n';
    pushLog('TX DATA: ' + payload);
    try {
      const encoded = new TextEncoder().encode(framed);
      await writeChunks(encoded);

      // wait for ACK:DATA
      const ok = await waitForAck('ACK:DATA', ACK_TIMEOUT_MS);
      if (ok) pushLog('DATA acknowledged by Nano');
      else pushLog('No ACK:DATA received (timeout) — start may still work');
    } catch (err) {
      pushLog('Send DATA failed: ' + String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleStart() {
    if (!characteristicRef.current) { pushLog('Not connected'); return; }
    pushLog('TX CMD:START');
    try {
      const encoded = new TextEncoder().encode('CMD:START\n');
      await writeChunks(encoded);
    } catch (err) {
      pushLog('Send START failed: ' + String(err));
    }
  }

  async function handlePause() {
    if (!characteristicRef.current) { pushLog('Not connected'); return; }
    pushLog('TX CMD:PAUSE');
    try {
      const encoded = new TextEncoder().encode('CMD:PAUSE\n');
      await writeChunks(encoded);
    } catch (err) {
      pushLog('Send PAUSE failed: ' + String(err));
    }
  }

  // UI helpers
  const updateMotor = (idx: number, field: 'rev' | 'rpm' | 'dir', value: number) => {
    setMotors((prev) => {
      const next = prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
      return next;
    });
  };

  return (
    <div style={{ padding: 18, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <h2>StringArt — BLE control (HM-10)</h2>
      <div style={{ marginBottom: 10 }}>
        <button onClick={connect} disabled={connected}>Connect</button>
        <button onClick={handleSend} disabled={!connected || sending}>Send (load data)</button>
        <button onClick={handleStart} disabled={!connected || !canStartPause}>Start</button>
        <button onClick={handlePause} disabled={!connected || !canStartPause}>Pause</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {motors.map((m, i) => (
          <div key={i} style={{ border: '1px solid #ccc', padding: 8, borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>M{i + 1}</div>
            <label>Revolutions (V)</label>
            <input type="number" value={(m as any).rev ?? (m as any).revs ?? (m as any).rev} onChange={(e) => updateMotor(i, 'rev', Number(e.target.value))} />
            <br />
            <label>RPM</label>
            <input type="number" value={(m as any).rpm} onChange={(e) => updateMotor(i, 'rpm', Number(e.target.value))} />
            <br />
            <label>Dir (1=CW)</label>
            <select value={(m as any).dir} onChange={(e) => updateMotor(i, 'dir', Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={0}>0</option>
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <h4>Log</h4>
        <div style={{ background: '#000', color: '#6f6', padding: 10, height: 220, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
          {log.map((l, i) => (<div key={i}>{l}</div>))}
        </div>
      </div>
    </div>
  );
}


// ==================== Arduino.ino ====================
// Replace your Nano sketch with this. It expects HM-10 module wired to
// the Nano's RX/TX via SoftwareSerial (RX pin -> 10, TX -> 11 as in sketch).

/*
  Arduino side protocol:
  - Web app sends frames as: "DATA:V1,VP1,D1;V2,VP2,D2;V3,VP3,D3;V4,VP4,D4;\n"
  - Arduino replies with "ACK:DATA" after parsing and storing.
  - Web app sends "CMD:START\n" or "CMD:PAUSE\n" to control execution.
*/

#include <SoftwareSerial.h>
#include <AccelStepper.h>

SoftwareSerial bleSerial(10, 11); // RX, TX (to HM-10)

#define MotorInterfaceType 1
AccelStepper stepper1(MotorInterfaceType, 2, 3);
AccelStepper stepper2(MotorInterfaceType, 4, 5);
AccelStepper stepper3(MotorInterfaceType, 6, 7);
AccelStepper stepper4(MotorInterfaceType, 8, 9);
AccelStepper* steppers[4] = { &stepper1, &stepper2, &stepper3, &stepper4 };

const long STEPS_PER_REV = 3200L;
const float MAX_SAFE_SPEED = 8000.0; // steps/sec cap

struct MotorStep { long steps; float speed; };
MotorStep motorSequences[4];
bool motorLoaded[4] = { false, false, false, false };

String recvBuf = "";

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  Serial.println("System ready. Waiting for DATA/CMD via BLE...");

  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(MAX_SAFE_SPEED);
    steppers[i]->setAcceleration(20000.0); // fast ramp
  }
}

void loop() {
  while (bleSerial.available()) {
    char c = (char)bleSerial.read();
    if (c == '\r') continue;
    recvBuf += c;
    if (c == '\n') {
      recvBuf.trim();
      if (recvBuf.length() > 0) processBuffer(recvBuf);
      recvBuf = "";
    }
    if (recvBuf.length() > 1024) { // safety
      processBuffer(recvBuf);
      recvBuf = "";
    }
  }

  // run steppers if they are moving
  for (int i = 0; i < 4; i++) steppers[i]->run();
}

void processBuffer(String s) {
  Serial.print("RX raw: "); Serial.println(s);
  // simple parser supporting DATA: and CMD:
  int pos = 0;
  while (pos < s.length()) {
    int idxData = s.indexOf("DATA:", pos);
    int idxCmd = s.indexOf("CMD:", pos);
    if (idxData == -1 && idxCmd == -1) {
      // no markers — ignore
      break;
    }
    if (idxData != -1 && (idxCmd == -1 || idxData < idxCmd)) {
      int start = idxData + 5;
      int nextData = s.indexOf("DATA:", start);
      int nextCmd = s.indexOf("CMD:", start);
      int next = -1;
      if (nextData == -1 && nextCmd == -1) next = -1;
      else if (nextData == -1) next = nextCmd;
      else if (nextCmd == -1) next = nextData;
      else next = min(nextData, nextCmd);
      String payload;
      if (next == -1) payload = s.substring(start);
      else payload = s.substring(start, next);
      payload.trim();
      if (payload.length() > 0) handleDATA(payload);
      if (next == -1) break; else pos = next;
    } else if (idxCmd != -1 && (idxData == -1 || idxCmd < idxData)) {
      int start = idxCmd + 4;
      int nextData = s.indexOf("DATA:", start);
      int nextCmd2 = s.indexOf("CMD:", start);
      int next = -1;
      if (nextData == -1 && nextCmd2 == -1) next = -1;
      else if (nextData == -1) next = nextCmd2;
      else if (nextCmd2 == -1) next = nextData;
      else next = min(nextData, nextCmd2);
      String payload;
      if (next == -1) payload = s.substring(start);
      else payload = s.substring(start, next);
      payload.trim();
      if (payload.length() > 0) handleCMD(payload);
      if (next == -1) break; else pos = next;
    } else break;
  }
}

void handleDATA(String payload) {
  Serial.print("Parsing DATA: "); Serial.println(payload);
  // payload example: V1,VP1,D1;V2,VP2,D2;V3,VP3,D3;V4,VP4,D4;
  // split into up to 4 parts
  int start = 0;
  for (int i = 0; i < 4; i++) {
    int sep = payload.indexOf(";", start);
    String part;
    if (sep == -1) part = payload.substring(start);
    else part = payload.substring(start, sep);
    part.trim();
    if (part.length() > 0) {
      int c1 = part.indexOf(',');
      int c2 = part.lastIndexOf(',');
      if (c1 > 0 && c2 > c1) {
        float revs = part.substring(0, c1).toFloat();
        float rpm = part.substring(c1 + 1, c2).toFloat();
        int dir = part.substring(c2 + 1).toInt();
        long steps = (long)(revs * (float)STEPS_PER_REV);
        if (dir != 1) steps = -steps;
        float speedSteps = rpm * (float)STEPS_PER_REV / 60.0;
        if (speedSteps > MAX_SAFE_SPEED) speedSteps = MAX_SAFE_SPEED;
        motorSequences[i].steps = steps;
        motorSequences[i].speed = speedSteps;
        motorLoaded[i] = true;
        Serial.print("M"); Serial.print(i+1); Serial.print(" loaded: steps="); Serial.print(steps); Serial.print(" speed="); Serial.println(speedSteps);
      } else {
        motorLoaded[i] = false;
      }
    } else {
      motorLoaded[i] = false;
    }
    if (sep == -1) break;
    start = sep + 1;
  }
  // acknowledge
  bleSerial.println("ACK:DATA"); // send back to BLE host via HM-10
  Serial.println("ACK:DATA sent");
}

void handleCMD(String cmd) {
  Serial.print("CMD received: "); Serial.println(cmd);
  if (cmd.indexOf("START") != -1) {
    // start loaded motors
    for (int i = 0; i < 4; i++) {
      if (motorLoaded[i]) {
        float sp = motorSequences[i].speed;
        if (sp <= 0.1) sp = 1.0;
        if (sp > MAX_SAFE_SPEED) sp = MAX_SAFE_SPEED;
        steppers[i]->setMaxSpeed(sp);
        steppers[i]->setAcceleration(20000.0);
        steppers[i]->moveTo(steppers[i]->currentPosition() + motorSequences[i].steps);
      }
    }
    bleSerial.println("ACK:START");
    Serial.println("ACK:START sent");
  } else if (cmd.indexOf("PAUSE") != -1) {
    for (int i = 0; i < 4; i++) steppers[i]->stop();
    bleSerial.println("ACK:PAUSE");
    Serial.println("ACK:PAUSE sent");
  }
}
