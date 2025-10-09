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
    let rxCharacteristic: any = null; // Characteristic to receive data from Arduino
    let connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' = 'DISCONNECTED';

    // --- Constants for HM-10/AT-09 ---
    const UART_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
    const UART_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"; // Used for both TX and RX

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
        const isConnected = connectionState === 'CONNECTED';
        const isConnecting = connectionState === 'CONNECTING';

        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        connectButton.disabled = isConnecting;

        // All other buttons are disabled unless fully connected
        actionButtons.forEach(btn => btn.disabled = !isConnected);
        
        if (isConnecting) {
            notificationInput.placeholder = 'Đang xử lý kết nối...';
        } else if (isConnected) {
            // The success message is set by the handshake logic
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


    // --- EVENT HANDLERS ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
    }
    
    // --- HANDSHAKE LOGIC ---
    let handshakeResolver: ((value: unknown) => void) | null = null;
    let handshakeTimeout: number | null = null;
    
    function handleRxData(event: any) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const receivedString = decoder.decode(value).trim();
        
        if (receivedString === 'ACK' && handshakeResolver) {
            if (handshakeTimeout) clearTimeout(handshakeTimeout);
            handshakeResolver(true); // Handshake successful
            handshakeResolver = null;
        }
    }

    async function performHandshake(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            handshakeResolver = resolve;
            
            // Set a timeout for the handshake
            handshakeTimeout = window.setTimeout(() => {
                handshakeResolver = null;
                reject(new Error('Arduino không phản hồi.'));
            }, 5000); // 5 seconds timeout

            // Send PING to start the handshake
            try {
                setNotification('Đã kết nối, đang gửi PING...');
                const encoder = new TextEncoder();
                await txCharacteristic.writeValue(encoder.encode("PING\n"));
            } catch (error) {
                if (handshakeTimeout) clearTimeout(handshakeTimeout);
                reject(error);
            }
        });
    }

    // --- CONNECTION LOGIC ---
    async function handleConnect() {
        if (!navigator.bluetooth) {
            setNotification('Lỗi: Web Bluetooth không được hỗ trợ!', true);
            return;
        }

        connectionState = 'CONNECTING';
        updateUIState();
        
        try {
            setNotification('Đang tìm thiết bị...');
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
            });

            setNotification(`Đang kết nối tới ${bluetoothDevice.name}...`);
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            const server = await bluetoothDevice.gatt.connect();
            
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(UART_CHARACTERISTIC_UUID);
            txCharacteristic = characteristic;
            rxCharacteristic = characteristic;

            // Start listening for data from Arduino
            await rxCharacteristic.startNotifications();
            rxCharacteristic.addEventListener('characteristicvaluechanged', handleRxData);

            // Perform handshake
            await performHandshake();

            // Handshake successful
            connectionState = 'CONNECTED';
            setNotification('Kết nối thành công (Đã xác nhận)!', false);
            updateUIState();
            
        } catch (error) {
            let errorMessage = 'Kết nối thất bại.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
            if (bluetoothDevice && bluetoothDevice.gatt.connected) {
                bluetoothDevice.gatt.disconnect();
            } else {
                onDisconnected(); // Reset state if connection failed early
            }
        }
    }
    
    function onDisconnected() {
        if(connectionState === 'CONNECTED') {
             setNotification('Đã mất kết nối Bluetooth.', true);
        }
        connectionState = 'DISCONNECTED';
        bluetoothDevice = null;
        txCharacteristic = null;
        rxCharacteristic = null; // Clear RX characteristic
        updateUIState();
    }

    async function handleDisconnect() {
        if (!bluetoothDevice || !bluetoothDevice.gatt.connected) return;
        try {
            setNotification('Đang ngắt kết nối...');
            // Stop listening before disconnecting
            if(rxCharacteristic) {
                await rxCharacteristic.stopNotifications();
                rxCharacteristic.removeEventListener('characteristicvaluechanged', handleRxData);
            }
            await bluetoothDevice.gatt.disconnect();
            // The 'gattserverdisconnected' event will handle the rest of the cleanup.
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
        modalTitle.textContent = 'Mã Arduino (Handshake)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <p style="color: green; font-weight: bold;">Mã nguồn này thực hiện cơ chế "bắt tay" (handshake).</p>
            <ul>
                <li>Nó sẽ chờ nhận tín hiệu "PING" từ ứng dụng.</li>
                <li>Khi nhận được "PING", nó sẽ gửi lại tín hiệu "ACK" để xác nhận kết nối.</li>
                <li>Điều này đảm bảo trạng thái trên app và Arduino luôn đồng bộ.</li>
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
  inputBuffer.reserve(50);

  delay(100);
  while(bleSerial.available()) {
    bleSerial.read();
  }
  
  Serial.println("Arduino san sang. Cho ket noi...");
}

void loop() {
  // Read incoming data from Bluetooth
  while (bleSerial.available()) {
    char c = bleSerial.read();
    
    // Check for newline character (ASCII code 10)
    if (c == 10) { 
      commandReady = true;
      break; 
    } else if (c >= 32) {
      inputBuffer += c;
    }
  }

  // If a full command has been received
  if (commandReady) {
    inputBuffer.trim();
    
    if (inputBuffer.equals("PING")) {
      Serial.println("Da nhan PING, dang gui ACK...");
      // Send Acknowledge back to the app
      bleSerial.println("ACK"); 
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
        if (connectionState === 'CONNECTED') {
            handleDisconnect();
        } else {
            handleConnect();
        }
    });

    // Dummy listeners for other buttons (they are disabled anyway in this version)
    sendButton.addEventListener('click', () => console.log('Send Clicked'));
    startButton.addEventListener('click', () => console.log('Start Clicked'));
    pauseButton.addEventListener('click', () => console.log('Pause Clicked'));
    clearButton.addEventListener('click', () => console.log('Clear Clicked'));

    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
