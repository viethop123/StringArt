// --- BLE + Send (thay thế toàn bộ phần liên quan) ---
// Dán nguyên đoạn này vào index.js, thay phần cũ

let bluetoothDevice = null;
let uartCharacteristic = null;
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 50; // tăng nhẹ để HM-10/HC-06 ổn định

function setNotification(msg, isError = false) {
  const el = document.getElementById('notification-input') || document.getElementById('status');
  if (el) {
    el.value = msg;
    el.style.color = isError ? '#D32F2F' : '#388E3C';
    el.style.borderColor = isError ? '#D32F2F' : '#388E3C';
  } else {
    console.log('NOTIF:', msg);
  }
}

async function connectBLE() {
  try {
    setNotification('Đang tìm thiết bị BLE...');
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [0xFFE0, 0xFFE1]
    });
    bluetoothDevice = device;

    setNotification('Đang kết nối...');
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(0xFFE0);
    uartCharacteristic = await service.getCharacteristic(0xFFE1);

    // cố gắng subscribe notifications (nếu module hỗ trợ)
    try {
      await uartCharacteristic.startNotifications();
      uartCharacteristic.addEventListener('characteristicvaluechanged', (ev) => {
        const val = ev.target.value;
        const text = new TextDecoder().decode(val);
        console.log('RX from Arduino:', text.trim());
        setNotification('Arduino: ' + text.trim());
      });
    } catch (err) {
      console.warn('No notifications available:', err);
    }

    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
    document.getElementById('send-btn').disabled = false;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = false;
    document.getElementById('connect-btn').textContent = 'Disconnect';
    setNotification('Đã kết nối Bluetooth ✅');
  } catch (err) {
    console.error('connectBLE error', err);
    setNotification('Lỗi kết nối Bluetooth', true);
  }
}

function onDisconnected() {
  setNotification('Mất kết nối Bluetooth', true);
  uartCharacteristic = null;
  bluetoothDevice = null;
  document.getElementById('send-btn').disabled = true;
  document.getElementById('start-btn').disabled = true;
  document.getElementById('pause-btn').disabled = true;
  document.getElementById('connect-btn').textContent = 'Connect';
}

async function writeChunks(encoded) {
  if (!uartCharacteristic) throw new Error('No UART characteristic');
  const total = encoded.length;
  let sent = 0;
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const slice = encoded.slice(i, i + CHUNK_SIZE);
    await uartCharacteristic.writeValue(slice);
    sent += slice.length;
    // delay nhẹ để module BLE xử lý, tránh concat lộn xộn
    await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
  }
  return sent;
}

async function sendDataString(dataString) {
  // Data messages prefixed with DATA:
  if (!uartCharacteristic) { setNotification('Chưa kết nối Bluetooth', true); return; }
  try {
    // disable controls while sending
    toggleControls(false);
    const encoder = new TextEncoder();
    const payload = 'DATA:' + dataString + '\n';
    const encoded = encoder.encode(payload);
    console.log('Sending DATA length', encoded.length, 'string:', payload);
    await writeChunks(encoded);
    setNotification('Đã gửi DATA (' + encoded.length + ' bytes)');
    // nhỏ delay sau khi gửi toàn bộ
    await new Promise(r => setTimeout(r, 100));
  } catch (err) {
    console.error('sendDataString error', err);
    setNotification('Gửi DATA thất bại', true);
  } finally {
    toggleControls(true);
  }
}

async function sendControl(cmd) {
  // Control messages prefixed with CMD:
  if (!uartCharacteristic) { setNotification('Chưa kết nối Bluetooth', true); return; }
  try {
    toggleControls(false);
    const encoder = new TextEncoder();
    const payload = 'CMD:' + cmd + '\n';
    const encoded = encoder.encode(payload);
    console.log('Sending CMD:', payload);
    await writeChunks(encoded);
    setNotification('Đã gửi lệnh ' + cmd);
    await new Promise(r => setTimeout(r, 80));
  } catch (err) {
    console.error('sendControl error', err);
    setNotification('Gửi lệnh thất bại', true);
  } finally {
    toggleControls(true);
  }
}

function toggleControls(enable) {
  const s = document.getElementById('send-btn');
  const st = document.getElementById('start-btn');
  const p = document.getElementById('pause-btn');
  if (s) s.disabled = !enable;
  if (st) st.disabled = !enable;
  if (p) p.disabled = !enable;
}

// Build data string from UI and send
async function handleSend() {
  if (!uartCharacteristic) { setNotification('Chưa kết nối Bluetooth', true); return; }
  try {
    // disable send/start while building+sending
    toggleControls(false);

    const motorData = [];
    for (let i = 1; i <= 4; i++) {
      const vStr = (document.getElementById(`m${i}-v`) || { value: '' }).value.trim();
      const vpStr = (document.getElementById(`m${i}-vp`) || { value: '' }).value.trim();
      const dirStr = (document.getElementById(`m${i}-dir`) || { value: '' }).value.trim();

      if (!vStr && !vpStr && !dirStr) {
        motorData.push('0,0,0');
        continue;
      }

      const vArr = (vStr || '0').split('/').map(s => s.trim());
      const vpArr = (vpStr || '0').split('/').map(s => s.trim());
      const dirArr = (dirStr || '0').split('/').map(s => s.trim());

      if (vArr.length !== vpArr.length || vArr.length !== dirArr.length) {
        setNotification(`Lỗi dữ liệu M${i}: số lượng giá trị không khớp`, true);
        toggleControls(true);
        return;
      }

      const parts = [];
      for (let j = 0; j < vArr.length; j++) {
        const v = vArr[j] || '0';
        const vp = vpArr[j] || '0';
        const d = dirArr[j] || '0';
        parts.push(`${v},${vp},${d}`);
      }
      motorData.push(parts.join('|'));
    }

    const dataString = motorData.join(';');
    console.log('Prepared DATA string:', dataString);
    await sendDataString(dataString);
  } catch (err) {
    console.error('handleSend error', err);
    setNotification('Gửi thất bại', true);
  } finally {
    toggleControls(true);
  }
}

// Init UI bindings
function initBleUI() {
  const connectBtn = document.getElementById('connect-btn');
  const sendBtn = document.getElementById('send-btn');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
        onDisconnected();
      } else {
        await connectBLE();
      }
    });
  }
  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (startBtn) startBtn.addEventListener('click', async () => { await sendControl('START'); });
  if (pauseBtn) pauseBtn.addEventListener('click', async () => { await sendControl('PAUSE'); });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    for (let i = 1; i <= 4; i++) {
      const a = document.getElementById(`m${i}-v`);
      const b = document.getElementById(`m${i}-vp`);
      const c = document.getElementById(`m${i}-dir`);
      if (a) a.value = '';
      if (b) b.value = '';
      if (c) c.value = '';
    }
    setNotification('Đã xóa dữ liệu trên App');
  });

  // initial state
  if (document.getElementById('send-btn')) document.getElementById('send-btn').disabled = true;
  if (document.getElementById('start-btn')) document.getElementById('start-btn').disabled = true;
  if (document.getElementById('pause-btn')) document.getElementById('pause-btn').disabled = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBleUI);
} else {
  initBleUI();
}
