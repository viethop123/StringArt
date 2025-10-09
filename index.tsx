/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix for TypeScript error: Property 'bluetooth' does not exist on type 'Navigator'.
declare global {
    interface Navigator {
        bluetooth: any;
    }
}

function App() {
    const appContainer = document.createElement('div');
    appContainer.id = 'app-container';

    // --- State Management ---
    let bluetoothDevice: any = null;
    let txCharacteristic: any = null;
    let isConnected = false;

    // --- Constants for HM-10/AT-09 ---
    const UART_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
    const UART_TX_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

    // --- DOM Elements ---
    const connectButton = document.createElement('button');
    const sendButton = document.createElement('button');
    const startButton = document.createElement('button');
    const pauseButton = document.createElement('button');
    const clearButton = document.createElement('button');
    const notificationInput = document.createElement('input');
    const actionButtons = [sendButton, startButton, pauseButton, clearButton];
    const allButtons = [connectButton, ...actionButtons];

    // --- UI State Update Function ---
    function updateUIState() {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        connectButton.disabled = false;
        
        // Disable all action buttons as per the reset request
        actionButtons.forEach(btn => btn.disabled = true);
        
        if (isConnected) {
            setNotification('Kết nối thành công! Sẵn sàng nhận lệnh.', false);
        } else {
             notificationInput.value = '';
             notificationInput.placeholder = 'Chưa kết nối Bluetooth';
             notificationInput.style.borderColor = 'var(--input-border-color)';
        }
    }
    
    // Header
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);

    // --- Input Validation (kept for UI structure) ---
    function validateInput(value: string): string {
        return value.replace(/[^0-9/]/g, '');
    }
    
    function handleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        input.value = validateInput(input.value);
    }

    // Machine Sections
    const mainContent = document.createElement('main');
    for (let i = 1; i <= 4; i++) {
        const section = document.createElement('section');
        section.className = 'machine-section';
        section.setAttribute('aria-labelledby', `machine-title-${i}`);

        const machineTitle = document.createElement('h2');
        machineTitle.id = `machine-title-${i}`;
        machineTitle.textContent = `M${i}`;
        section.appendChild(machineTitle);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        const inputs = [
            { id: 'v', label: 'V (Vòng)', placeholder: '100/40/30' },
            { id: 'vp', label: 'V/P (Vòng/phút)', placeholder: '20/25/40' },
            { id: 'dir', label: 'Chiều (1/0)', placeholder: '1/0/1' }
        ];

        inputs.forEach(inputInfo => {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            const label = document.createElement('label');
            label.setAttribute('for', `m${i}-${inputInfo.id}`);
            label.textContent = inputInfo.label;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `m${i}-${inputInfo.id}`;
            input.name = `m${i}-${inputInfo.id}`;
            input.placeholder = inputInfo.placeholder;
            input.addEventListener('input', handleInput);
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            inputContainer.appendChild(inputGroup);
        });

        section.appendChild(inputContainer);
        mainContent.appendChild(section);
    }
    appContainer.appendChild(mainContent);

    // Controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls';
    controlsContainer.setAttribute('role', 'group');
    controlsContainer.setAttribute('aria-label', 'Application Controls');

    connectButton.textContent = 'Connect';
    connectButton.id = 'connect-btn';
    controlsContainer.appendChild(connectButton);

    sendButton.textContent = 'Send';
    sendButton.id = 'send-btn';
    controlsContainer.appendChild(sendButton);

    startButton.textContent = 'Start';
    startButton.id = 'start-btn';
    controlsContainer.appendChild(startButton);

    pauseButton.textContent = 'Pause';
    pauseButton.id = 'pause-btn';
    controlsContainer.appendChild(pauseButton);
    
    clearButton.textContent = 'Clear';
    clearButton.id = 'clear-btn';
    controlsContainer.appendChild(clearButton);

    appContainer.appendChild(controlsContainer);

    // Notification Area
    const notificationArea = document.createElement('div');
    notificationArea.className = 'notification-area';
    notificationInput.type = 'text';
    notificationInput.id = 'notification-input';
    notificationInput.name = 'thongbao';
    notificationInput.readOnly = true;
    notificationArea.appendChild(notificationInput);
    appContainer.appendChild(notificationArea);
    
    // Set initial UI state
    updateUIState();


    // --- EVENT HANDLERS (REBUILT FROM SCRATCH) ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
        notificationInput.style.borderColor = isError ? '#D32F2F' : '#388E3C';
    }

    async function handleConnect() {
        if (!navigator.bluetooth) {
            setNotification('Lỗi: Web Bluetooth không được hỗ trợ!', true);
            return;
        }
        try {
            connectButton.disabled = true;
            setNotification('Đang tìm thiết bị...');
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
                optionalServices: [UART_SERVICE_UUID]
            });

            setNotification(`Đang kết nối tới ${bluetoothDevice.name}...`);
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            const server = await bluetoothDevice.gatt.connect();
            
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

            isConnected = true;
            
            // Send a handshake message to Arduino to confirm connection
            await sendBleCommand('PING');
            
        } catch (error) {
            let errorMessage = 'Kết nối thất bại.';
            if (error instanceof Error) {
                if (error.name === 'NotFoundError') {
                    errorMessage = 'Không tìm thấy thiết bị nào. Hãy thử lại.';
                } else {
                     errorMessage = error.message;
                }
            }
            setNotification(errorMessage, true);
            isConnected = false;
        } finally {
            updateUIState(); 
        }
    }
    
    function onDisconnected() {
        setNotification('Đã mất kết nối Bluetooth.', true);
        isConnected = false;
        bluetoothDevice = null;
        txCharacteristic = null;
        updateUIState();
    }

    async function handleDisconnect() {
        if (!bluetoothDevice) return;
        try {
            connectButton.disabled = true;
            setNotification('Đang ngắt kết nối...');
            await bluetoothDevice.gatt.disconnect();
            // The 'onDisconnected' event handler will fire and update the state
        } catch (error) {
            let errorMessage = 'Ngắt kết nối thất bại.';
             if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
            connectButton.disabled = false; // Re-enable if disconnect fails
        }
    }

    async function sendBleCommand(command: string) {
        if (!isConnected || !txCharacteristic) {
            setNotification('Lỗi: Chưa kết nối để gửi lệnh.', true);
            return;
        }
        try {
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n'));
        } catch (error) {
            let errorMessage = 'Gửi lệnh thất bại.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        }
    }

    // --- Arduino Code Modal (Updated with simple test code) ---
    function showArduinoCodeModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        
        const modalTitle = document.createElement('h2');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = 'Mã Nguồn Arduino (Kiểm Tra Kết Nối)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <h3>Mục tiêu: Chỉ kiểm tra kết nối</h3>
            <p>Mã nguồn này đã được viết lại từ đầu để thực hiện <strong>một nhiệm vụ duy nhất</strong>: lắng nghe tín hiệu kết nối từ App và báo cáo lại trên Serial Monitor.</p>
            <ul>
                <li><b>Bước 1:</b> Nạp mã nguồn này vào bo mạch Nano.</li>
                <li><b>Bước 2:</b> Mở Serial Monitor (Baud Rate: 9600). Bạn sẽ thấy dòng chữ "Arduino san sang. Cho ket noi...".</li>
                <li><b>Bước 3:</b> Trên App, nhấn nút "Connect" và kết nối với module HM-10.</li>
                <li><b>Bước 4:</b> Nếu thành công, bạn sẽ thấy dòng chữ "Da ket noi BT" xuất hiện trên Serial Monitor.</li>
            </ul>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>

// Kết nối module HM-10 (hoặc tương tự)
// TX của module -> D10 (RX của Nano)
// RX của module -> D11 (TX của Nano)
SoftwareSerial bleSerial(10, 11); 

String inputBuffer = "";
bool commandReady = false;

void setup() {
  // Mở cổng Serial để giao tiếp với máy tính (Serial Monitor)
  Serial.begin(9600);

  // Mở cổng Serial để giao tiếp với module Bluetooth
  bleSerial.begin(9600);

  // Dành bộ nhớ cho chuỗi nhận dữ liệu để tăng hiệu quả
  inputBuffer.reserve(64);

  // Chờ một chút và xóa bộ đệm Bluetooth để loại bỏ nhiễu khi khởi động
  delay(100);
  while(bleSerial.available()) {
    bleSerial.read();
  }

  Serial.println("Arduino san sang. Cho ket noi...");
}

void loop() {
  // 1. Luôn luôn đọc dữ liệu từ Bluetooth (nếu có)
  readBluetooth();

  // 2. Nếu đã có lệnh hoàn chỉnh, xử lý nó
  if (commandReady) {
    inputBuffer.trim(); // Xóa các khoảng trắng thừa

    // Chỉ kiểm tra một lệnh duy nhất: "PING"
    if (inputBuffer.equalsIgnoreCase("PING")) {
      Serial.println("Da ket noi BT");
    }

    // Xóa bộ đệm để sẵn sàng cho lệnh tiếp theo
    inputBuffer = "";
    commandReady = false;
  }
}

// Hàm đọc dữ liệu từ Bluetooth một cách không gián đoạn (non-blocking)
void readBluetooth() {
  while (bleSerial.available()) {
    char c = bleSerial.read();

    // Nếu gặp ký tự xuống dòng, đánh dấu là đã nhận xong lệnh
    if (c == '\n') {
      commandReady = true;
      return; // Thoát ngay để xử lý lệnh trong loop()
    } 
    // Chỉ thêm các ký tự hợp lệ vào bộ đệm
    else if (c >= 32) { 
      inputBuffer += c;
    }
  }
}
`;

        modalBody.innerHTML = instructionsHTML;

        const codeBlock = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.textContent = arduinoCodeString.trim();
        codeBlock.appendChild(codeElement);
        codeBlock.className = 'code-block';
        
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Sao chép mã';
        copyButton.className = 'copy-btn';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(arduinoCodeString.trim());
            copyButton.textContent = 'Đã sao chép!';
            setTimeout(() => { copyButton.textContent = 'Sao chép mã'; }, 2000);
        };
        codeBlock.appendChild(copyButton);
        
        modalBody.appendChild(codeBlock);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalOverlay.appendChild(modalContent);

        document.body.appendChild(modalOverlay);

        const closeModal = () => document.body.removeChild(modalOverlay);
        closeButton.onclick = closeModal;
        modalOverlay.onclick = (event) => {
            if (event.target === modalOverlay) {
                closeModal();
            }
        };
    }
    
    const arduinoCodeButton = document.createElement('button');
    arduinoCodeButton.textContent = 'Xem mã Arduino';
    arduinoCodeButton.id = 'arduino-code-btn';
    appContainer.appendChild(arduinoCodeButton);
    
    // --- Attach Event Listeners ---
    arduinoCodeButton.addEventListener('click', showArduinoCodeModal);
    connectButton.addEventListener('click', () => {
        if (isConnected) {
            handleDisconnect();
        } else {
            handleConnect();
        }
    });

    // Dummy listeners for other buttons - they are disabled anyway
    sendButton.addEventListener('click', () => setNotification('Chức năng đã bị vô hiệu hóa.', true));
    startButton.addEventListener('click', () => setNotification('Chức năng đã bị vô hiệu hóa.', true));
    pauseButton.addEventListener('click', () => setNotification('Chức năng đã bị vô hiệu hóa.', true));
    clearButton.addEventListener('click', () => setNotification('Chức năng đã bị vô hiệu hóa.', true));


    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
