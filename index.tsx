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

    // --- State Management (Simplified for Test) ---
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
    const inputElements: HTMLInputElement[] = [];


    // --- UI State Update Function ---
    function updateUIState() {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        connectButton.disabled = false; // Connect button is always enabled

        // All other buttons are disabled for this test
        actionButtons.forEach(btn => btn.disabled = true);
        
        if (isConnected) {
             notificationInput.placeholder = 'Đã kết nối. Đã gửi PING.';
        } else {
             notificationInput.value = '';
             notificationInput.placeholder = 'Chưa kết nối Bluetooth';
        }
    }
    
    // Header
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);
    
    // Machine Sections (UI only)
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
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            inputContainer.appendChild(inputGroup);
            inputElements.push(input);
        });

        section.appendChild(inputContainer);
        mainContent.appendChild(section);
    }
    appContainer.appendChild(mainContent);

    // Controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls';
    
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
    notificationInput.readOnly = true;
    notificationArea.appendChild(notificationInput);
    appContainer.appendChild(notificationArea);
    
    // Set initial UI state
    updateUIState();


    // --- EVENT HANDLERS (SIMPLIFIED FOR TEST) ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
    }
    
    async function handleConnect() {
        if (!navigator.bluetooth) {
            setNotification('Lỗi: Web Bluetooth không được hỗ trợ!', true);
            return;
        }
        try {
            setNotification('Đang tìm thiết bị...');
            
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
            });

            setNotification(`Đang kết nối tới ${bluetoothDevice.name}...`);
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            const server = await bluetoothDevice.gatt.connect();
            
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

            isConnected = true;
            setNotification(`Kết nối thành công! Đang gửi PING...`, false);
            updateUIState();
            
            // Send the PING command
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode("PING\n"));
            setNotification(`Đã gửi PING tới Arduino.`, false);
            
        } catch (error) {
            let errorMessage = 'Kết nối thất bại.';
            if (error instanceof Error) {
                if (error.name === 'NotFoundError') {
                    errorMessage = 'Không tìm thấy thiết bị nào.';
                } else {
                     errorMessage = error.message;
                }
            }
            setNotification(errorMessage, true);
            onDisconnected(); // Reset state on failure
        }
    }
    
    function onDisconnected() {
        if(isConnected) { // Only show message if it was previously connected
             setNotification('Đã mất kết nối Bluetooth.', true);
        }
        isConnected = false;
        bluetoothDevice = null;
        txCharacteristic = null;
        updateUIState();
    }

    async function handleDisconnect() {
        if (!bluetoothDevice) return;
        try {
            setNotification('Đang ngắt kết nối...');
            await bluetoothDevice.gatt.disconnect();
            // The 'gattserverdisconnected' event will handle the rest.
        } catch (error) {
            setNotification('Ngắt kết nối thất bại.', true);
            onDisconnected(); // Force reset state
        }
    }

    // --- Arduino Code Modal ---
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
            <p style="color: green; font-weight: bold;">Đây là mã nguồn siêu đơn giản để kiểm tra kết nối.</p>
            <ul>
                <li>Khi khởi động, nó sẽ in "Arduino san sang. Cho ket noi..." ra Serial Monitor.</li>
                <li>Nó sẽ chỉ lắng nghe tín hiệu "PING" từ ứng dụng.</li>
                <li>Khi nhận được "PING", nó sẽ in "Da ket noi BT".</li>
            </ul>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>

SoftwareSerial bleSerial(10, 11); // RX, TX

String inputBuffer = "";
bool commandReady = false;

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  inputBuffer.reserve(50); // Reserve memory for the input string

  // Clear any garbage data from the Bluetooth module on startup
  delay(100);
  while(bleSerial.available()) {
    bleSerial.read();
  }
  
  Serial.println("Arduino san sang. Cho ket noi...");
}

void loop() {
  // Read incoming data from Bluetooth non-blockingly
  while (bleSerial.available()) {
    char c = bleSerial.read();
    
    // Check for newline character (ASCII code 10)
    if (c == 10) { 
      commandReady = true;
      break; 
    } else if (c >= 32) { // Only add printable characters
      inputBuffer += c;
    }
  }

  // If a full command has been received
  if (commandReady) {
    inputBuffer.trim(); // Remove any leading/trailing whitespace
    
    if (inputBuffer.equals("PING")) {
      Serial.println("Da ket noi BT");
    }
    
    // Reset for the next command
    inputBuffer = "";
    commandReady = false;
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

    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
