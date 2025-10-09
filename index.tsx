// -----------------------------
// BLE helper (stable, chunked write)
// -----------------------------
let bluetoothDevice = null;
let uartCharacteristic = null;

// Utility: show notification (cập nhật phù hợp UI của bạn)
function setNotification(msg, isError = false) {
  const el = document.getElementById('notification-input') || document.getElementById('status') || null;
  if (el) {
    el.value = msg;
    el.style.color = isError ? '#D32F2F' : '#388E3C';
    el.style.borderColor = isError ? '#D32F2F' : '#388E3C';
  } else {
    console.log('NOTIF:', msg);
  }
}

// Connect BLE (HM-10 / AT-09 / HM-10-like UART service)
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

    // Nếu muốn nhận notify từ Arduino (nếu có)
    try {
      await uartCharacteristic.startNotifications();
      uartCharacteristic.addEventListener('characteristicvaluechanged', (ev) => {
        const value = ev.target.value;
        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        console.log('RX:', text.trim());
        setNotification('Arduino: ' + text.trim());
      });
    } catch (err) {
      // Nếu module không hỗ trợ notifications thì bỏ qua
      console.warn('No notifications:', err);
    }

    device.addEventListener('gattserverdisconnected', onDisconnected);

    document.getElementById('send-btn').disabled = false;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = false;
    document.getElementById('connect-btn').textContent = 'Disconnect';

    setNotification('Đã kết nối Bluetooth ✅');
    console.log('Connected to BLE device');
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

// Chunked write (BLE MTU ~20 bytes typical)
async function sendBleCommand(command) {
  if (!uartCharacteristic) {
    setNotification('Chưa kết nối Bluetooth', true);
    return;
  }
  try {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(command + '\n');
    const CHUNK_SIZE = 20;

    console.log('Sending total bytes:', encoded.length, 'string:', command);
    const chunkCount = Math.ceil(encoded.length / CHUNK_SIZE);

    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      const slice = encoded.slice(i, i + CHUNK_SIZE);
      await uartCharacteristic.writeValue(slice);
      // nhẹ 25ms để module xử lý, tránh overflow
      await new Promise(res => setTimeout(res, 25));
    }

    setNotification(`Đã gửi (${encoded.length} bytes, ${chunkCount} gói)`);
  } catch (err) {
    console.error('sendBleCommand error', err);
    setNotification('Gửi thất bại', true);
  }
}

// Build motor data string and send
async function handleSend() {
  if (!uartCharacteristic) {
    setNotification('Không có kết nối Bluetooth', true);
    return;
  }

  try {
    const motorData = [];
    for (let i = 1; i <= 4; i++) {
      const vStr = (document.getElementById(`m${i}-v`) || { value: '' }).value.trim();
      const vpStr = (document.getElementById(`m${i}-vp`) || { value: '' }).value.trim();
      const dirStr = (document.getElementById(`m${i}-dir`) || { value: '' }).value.trim();

      if (!vStr && !vpStr && !dirStr) {
        motorData.push('0,0,0'); // mặc định
        continue;
      }

      const vArr = (vStr || '0').split('/').map(s => s.trim());
      const vpArr = (vpStr || '0').split('/').map(s => s.trim());
      const dirArr = (dirStr || '0').split('/').map(s => s.trim());

      if (vArr.length !== vpArr.length || vArr.length !== dirArr.length) {
        setNotification(`Lỗi dữ liệu M${i}: số lượng giá trị không khớp`, true);
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
    console.log('Full dataString:', dataString);
    await sendBleCommand(dataString);
  } catch (err) {
    console.error('handleSend error', err);
    setNotification('Gửi thất bại', true);
  }
}

// Send simple control commands START / PAUSE
async function sendControl(cmd) {
  if (!uartCharacteristic) {
    setNotification('Không có kết nối Bluetooth', true);
    return;
  }
  await sendBleCommand(cmd);
}

// Hook buttons (gắn event listeners)
function initBleUI() {
  const connectBtn = document.getElementById('connect-btn');
  const sendBtn = document.getElementById('send-btn');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
        onDisconnected();
      } else {
        await connectBLE();
      }
    });
  }
  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (startBtn) startBtn.addEventListener('click', () => sendControl('START'));
  if (pauseBtn) pauseBtn.addEventListener('click', () => sendControl('PAUSE'));
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

  // khởi trạng thái nút
  if (document.getElementById('send-btn')) document.getElementById('send-btn').disabled = true;
  if (document.getElementById('start-btn')) document.getElementById('start-btn').disabled = true;
  if (document.getElementById('pause-btn')) document.getElementById('pause-btn').disabled = true;
}

// gọi init sau khi DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBleUI);
} else {
  initBleUI();
}
