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

    // --- State Management (Clean Slate) ---
    let bluetoothDevice: any = null;
    let txCharacteristic: any = null;
    let isConnected = false;

    // --- DOM Elements ---
    const connectButton = document.createElement('button');
    const sendButton = document.createElement('button');
    const startButton = document.createElement('button');
    const pauseButton = document.createElement('button');
    const clearButton = document.createElement('button');
    const notificationInput = document.createElement('input');
    const actionButtons = [sendButton, startButton, pauseButton, clearButton];

    // --- UI State Update Function ---
    function updateUIState() {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        actionButtons.forEach(btn => {
            btn.disabled = !isConnected;
        });
        notificationInput.placeholder = isConnected ? 'Đã kết nối' : 'Chưa kết nối Bluetooth';
    }
    
    // Header
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);

    // --- Input Filter ---
    function handleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        input.value = input.value.replace(/[^0-9/]/g, '');
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
            { id: 'dir', label: 'Chiều (1/0)', placeholder: '1/1/0' }
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


    // --- EVENT HANDLERS (To be programmed from scratch) ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
        notificationInput.style.borderColor = isError ? '#D32F2F' : '#388E3C';
    }

    async function handleConnect() {
        console.log('Nút "Connect" đã được nhấn. Logic sẽ được thêm ở đây.');
        setNotification('Chức năng Kết nối chưa được lập trình.');
        // TODO: Add Bluetooth connection logic here.
    }

    function handleDisconnect() {
        console.log('Nút "Disconnect" đã được nhấn. Logic sẽ được thêm ở đây.');
        setNotification('Chức năng Ngắt kết nối chưa được lập trình.');
        // TODO: Add Bluetooth disconnection logic here.
    }
    
    function handleSend() {
        console.log('Nút "Send" đã được nhấn. Logic sẽ được thêm ở đây.');
        setNotification('Chức năng Gửi dữ liệu chưa được lập trình.');
        // TODO: Add logic to read inputs and send data string.
    }
    
    function handleStart() {
        console.log('Nút "Start" đã được nhấn. Logic sẽ được thêm ở đây.');
        setNotification('Chức năng Start chưa được lập trình.');
        // TODO: Add logic to send "START" command.
    }
    
    function handlePause() {
        console.log('Nút "Pause" đã được nhấn. Logic sẽ được thêm ở đây.');
        setNotification('Chức năng Pause chưa được lập trình.');
         // TODO: Add logic to send "PAUSE" command.
    }

    function handleClear() {
        for (let i = 1; i <= 4; i++) {
            (document.getElementById(`m${i}-v`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-vp`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-dir`) as HTMLInputElement).value = '';
        }
        setNotification('Đã xóa dữ liệu trên App.');
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
        modalTitle.textContent = 'Mã Nguồn Arduino (Bắt đầu lại)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <h3>Mục tiêu: Bắt đầu lại từ đầu</h3>
            <p>Chúng ta sẽ dùng đoạn mã cực kỳ đơn giản này để kiểm tra kết nối Bluetooth trước tiên. Mọi dữ liệu App gửi đến, Arduino sẽ gửi ngược lại.</p>
            <ul>
                <li><b>Module BLE &rarr; Arduino Nano:</b>
                    <ul>
                        <li>TX &rarr; Pin D10</li>
                        <li>RX &rarr; Pin D11</li>
                    </ul>
                </li>
            </ul>
             <h3>Mã kiểm tra kết nối (Echo)</h3>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>

// Kết nối module HM-10/AT-09
// TX -> D10 (RX của SoftwareSerial)
// RX -> D11 (TX của SoftwareSerial)
SoftwareSerial bleSerial(10, 11);

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  Serial.println("Arduino san sang. Ma kiem tra ket noi.");
}

void loop() {
  // Nếu có dữ liệu từ App gửi đến
  if (bleSerial.available()) {
    char c = bleSerial.read();
    
    // In ra Serial Monitor để gỡ lỗi
    Serial.write(c);
    
    // Gửi ngược lại cho App (phản hồi)
    bleSerial.write(c);
  }
  
  // Nếu có dữ liệu từ Serial Monitor gửi đến
  if (Serial.available()) {
      char c = Serial.read();
      bleSerial.write(c);
  }
}`;

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
    sendButton.addEventListener('click', handleSend);
    startButton.addEventListener('click', handleStart);
    pauseButton.addEventListener('click', handlePause);
    clearButton.addEventListener('click', handleClear);

    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
