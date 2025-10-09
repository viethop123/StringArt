/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix for TypeScript error on line 121: Property 'bluetooth' does not exist on type 'Navigator'.
// The Web Bluetooth API is not yet part of the standard TypeScript DOM library definitions.
declare global {
    interface Navigator {
        bluetooth: any;
    }
}

function App() {
    const appContainer = document.createElement('div');
    appContainer.id = 'app-container';

    // State variables for Bluetooth connection
    let bluetoothDevice: any = null;
    let uartCharacteristic: any = null;

    // Header
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);

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
            { id: 'v', label: 'V (Vòng)', placeholder: '100' },
            { id: 'vp', label: 'V/P (Vòng/phút)', placeholder: '60' },
            { id: 'dir', label: 'Chiều (1/0)', placeholder: '1' }
        ];

        inputs.forEach(inputInfo => {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';

            const label = document.createElement('label');
            label.setAttribute('for', `m${i}-${inputInfo.id}`);
            label.textContent = inputInfo.label;

            const input = document.createElement('input');
            input.type = 'number'; 
            input.id = `m${i}-${inputInfo.id}`;
            input.name = `m${i}-${inputInfo.id}`;
            input.placeholder = inputInfo.placeholder;
            
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

    const connectButton = document.createElement('button');
    connectButton.textContent = 'Connect';
    connectButton.id = 'connect-btn';
    controlsContainer.appendChild(connectButton);

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.id = 'send-btn';
    sendButton.disabled = true; // Disabled until connected
    controlsContainer.appendChild(sendButton);

    const startButton = document.createElement('button');
    startButton.textContent = 'Start';
    startButton.id = 'start-btn';
    startButton.disabled = true; // Disabled until connected
    controlsContainer.appendChild(startButton);

    const pauseButton = document.createElement('button');
    pauseButton.textContent = 'Pause';
    pauseButton.id = 'pause-btn';
    pauseButton.disabled = true; // Disabled until connected
    controlsContainer.appendChild(pauseButton);
    
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.id = 'clear-btn';
    controlsContainer.appendChild(clearButton);

    appContainer.appendChild(controlsContainer);

    // Notification Area
    const notificationArea = document.createElement('div');
    notificationArea.className = 'notification-area';

    const notificationInput = document.createElement('input');
    notificationInput.type = 'text';
    notificationInput.id = 'notification-input';
    notificationInput.name = 'thongbao';
    notificationInput.placeholder = 'thongbao';
    notificationInput.readOnly = true;
    notificationArea.appendChild(notificationInput);
    appContainer.appendChild(notificationArea);

    // --- Event Handlers ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
        notificationInput.style.borderColor = isError ? '#D32F2F' : '#388E3C';
    }

    function handleNotifications(event: any) {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const message = decoder.decode(value);
        console.log(`Received from Arduino: ${message.trim()}`);
        setNotification(`Arduino: ${message.trim()}`);
    }

    async function handleConnect() {
        const UART_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
        const UART_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"; // Used for both TX and RX

        try {
            setNotification('Đang tìm kiếm thiết bị...');
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
                optionalServices: [UART_SERVICE_UUID]
            });
            
            setNotification('Đang kết nối với thiết bị...');
            const server = await bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            uartCharacteristic = await service.getCharacteristic(UART_CHARACTERISTIC_UUID);

            await uartCharacteristic.startNotifications();
            uartCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);

            sendButton.disabled = false;
            startButton.disabled = false;
            pauseButton.disabled = false;
            connectButton.textContent = 'Disconnect';
            setNotification('Đã kết nối Bluetooth thành công!');

            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        } catch (error) {
            console.error('Lỗi kết nối Bluetooth:', error);
            setNotification('Lỗi kết nối Bluetooth', true);
        }
    }

    function onDisconnected() {
        setNotification('Mất kết nối Bluetooth', true);
        if (uartCharacteristic) {
            try {
                uartCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
            } catch (error) {
                 console.warn("Could not remove notification listener:", error);
            }
        }
        sendButton.disabled = true;
        startButton.disabled = true;
        pauseButton.disabled = true;
        connectButton.textContent = 'Connect';
        bluetoothDevice = null;
        uartCharacteristic = null;
    }

    async function handleDisconnect() {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        } else {
           onDisconnected();
        }
    }
    
    async function sendDataInChunks(command: string) {
        if (!uartCharacteristic) {
            setNotification('Không có kết nối Bluetooth', true);
            return;
        }
        try {
            const encoder = new TextEncoder();
            const encoded = encoder.encode(command + '\n');
            const CHUNK_SIZE = 20; // Standard for BLE modules like HM-10

            setNotification(`Đang gửi ${encoded.length} bytes...`);

            for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
                const chunk = encoded.slice(i, i + CHUNK_SIZE);
                await uartCharacteristic.writeValue(chunk);
                // A small delay is crucial for some BLE modules to process each chunk
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            if (command === 'START' || command === 'PAUSE') {
                setNotification(`Lệnh ${command} đã được gửi`);
            } else {
                setNotification('Đã gửi dữ liệu Thành Công');
            }

        } catch (error) {
            console.error(`Lỗi gửi lệnh ${command}:`, error);
            setNotification(`Gửi lệnh ${command} Thất Bại`, true);
        }
    }

    async function handleSend() {
        const motorData: string[] = [];
        for (let i = 1; i <= 4; i++) {
            const vStr = (document.getElementById(`m${i}-v`) as HTMLInputElement).value.trim();
            const vpStr = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value.trim();
            const dirStr = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value.trim();
            
            const motorCommand = `${vStr || '0'},${vpStr || '0'},${dirStr || '0'}`;
            motorData.push(motorCommand);
        }
        const dataString = motorData.join(';');
        
        await sendDataInChunks(dataString);
    }

    function handleClear() {
        for (let i = 1; i <= 4; i++) {
            (document.getElementById(`m${i}-v`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-vp`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-dir`) as HTMLInputElement).value = '';
        }
        setNotification('Đã xóa dữ liệu trên App');
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
        modalTitle.textContent = 'Mã Nguồn & Hướng Dẫn Arduino';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <h3>1. Cài đặt Thư viện</h3>
            <p>Mở Arduino IDE, vào <b>Sketch &rarr; Include Library &rarr; Manage Libraries...</b>. Tìm và cài đặt thư viện <b>"AccelStepper"</b> của Mike McCauley.</p>
            <h3>2. Kết nối Phần cứng</h3>
            <p><b>Lưu ý:</b> Sử dụng module Bluetooth Low Energy (BLE) như <b>HM-10</b> hoặc <b>AT-09</b>.</p>
            <ul>
                <li><b>Module BLE &rarr; Arduino Nano:</b>
                    <ul>
                        <li>VCC &rarr; 5V</li>
                        <li>GND &rarr; GND</li>
                        <li>TX &rarr; Pin D10</li>
                        <li>RX &rarr; Pin D11</li>
                    </ul>
                </li>
                <li><b>Driver Động cơ &rarr; Arduino Nano:</b>
                    <ul>
                        <li>M1: STEP &rarr; D2, DIR &rarr; D3</li>
                        <li>M2: STEP &rarr; D4, DIR &rarr; D5</li>
                        <li>M3: STEP &rarr; D6, DIR &rarr; D7</li>
                        <li>M4: STEP &rarr; D8, DIR &rarr; D9</li>
                    </ul>
                </li>
            </ul>
             <h3>3. Nạp mã cho Arduino</h3>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>
#include <AccelStepper.h>

#define MotorInterfaceType 1

// Khai báo các đối tượng động cơ
AccelStepper stepper1(MotorInterfaceType, 2, 3);
AccelStepper stepper2(MotorInterfaceType, 4, 5);
AccelStepper stepper3(MotorInterfaceType, 6, 7);
AccelStepper stepper4(MotorInterfaceType, 8, 9);
AccelStepper* steppers[] = {&stepper1, &stepper2, &stepper3, &stepper4};

// Khai báo cổng Serial cho Bluetooth
SoftwareSerial bleSerial(10, 11); // RX, TX

// Hằng số cài đặt
const long STEPS_PER_REV = 3200; // Số bước trên 1 vòng (tuỳ chỉnh theo driver)
const int MAX_SEQUENCE_STEPS = 1; // Giờ chỉ cần 1 bước cho mỗi motor

// Cấu trúc để lưu thông tin một bước chạy
struct MotorStep {
  long steps;
  float speed;
};

// Mảng lưu trữ bước chạy cho từng motor
MotorStep motorSequences[4][MAX_SEQUENCE_STEPS];
int sequenceLengths[4] = {0};
int currentStepIndex[4] = {0};
bool isRunning = false;

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600); 

  // Đợi một chút và dọn sạch bộ đệm BLE khỏi dữ liệu rác khi khởi động
  delay(200);
  while(bleSerial.available()) {
    bleSerial.read();
  }

  for (int i=0; i<4; i++) {
    steppers[i]->setMaxSpeed(8000.0);
    steppers[i]->setAcceleration(2000.0);
  }

  bleSerial.println("System Ready");
}

void loop() {
  // Đọc lệnh từ Bluetooth
  if (bleSerial.available()) {
    static String command = "";
    while (bleSerial.available()) {
      char c = bleSerial.read();
      if (c == '\\n') {
        command.trim();
        if (command.length() > 0) { // Chỉ xử lý nếu lệnh không rỗng
           parseCommand(command);
        }
        command = "";
        break;
      } else {
        command += c;
      }
    }
  }

  // Nếu đang chạy, thực thi lệnh
  if (isRunning) {
    steppers[0]->run();
    steppers[1]->run();
    steppers[2]->run();
    steppers[3]->run();

    for (int i=0; i<4; i++) {
      checkAndLoadNextStep(steppers[i], i);
    }
    
    bool allMotorsFinished = true;
    for (int i = 0; i < 4; i++) {
      if (steppers[i]->distanceToGo() != 0) {
        allMotorsFinished = false;
        break;
      }
    }

    if (allMotorsFinished) {
      isRunning = false;
      Serial.println("All motors finished.");
      bleSerial.println("All motors finished.");
    }
  }
}

// Kiểm tra và nạp bước chạy tiếp theo (nếu có)
void checkAndLoadNextStep(AccelStepper* stepper, int motorIndex) {
    if (stepper->distanceToGo() == 0) {
        if (currentStepIndex[motorIndex] < sequenceLengths[motorIndex]) {
            MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
            stepper->setMaxSpeed(abs(next.speed)); 
            stepper->setAcceleration(2000.0);
            stepper->moveTo(stepper->currentPosition() + next.steps);
            currentStepIndex[motorIndex]++;
        }
    }
}

// Phân tích lệnh chính (START, PAUSE hoặc dữ liệu)
void parseCommand(String command) {
  Serial.println("Received: " + command);
  if (command.equalsIgnoreCase("START")) {
    startMotors();
  } else if (command.equalsIgnoreCase("PAUSE")) {
    isRunning = false;
    Serial.println("Execution paused.");
    bleSerial.println("Execution paused.");
  } else {
    // Bộ lọc: Bỏ qua chuỗi không hợp lệ trước khi phân tích
    if (command.length() < 5 || command.indexOf(',') == -1) {
      Serial.println("Invalid or garbage data ignored: " + command);
      bleSerial.println("ERROR: Invalid Data");
      return;
    }
    parseDataString(command);
  }
}

// Bắt đầu chu trình chạy
void startMotors() {
    bool hasData = false;
    for(int i=0; i<4; i++) if (sequenceLengths[i] > 0) hasData = true;

    if (hasData) {
        for(int i=0; i<4; i++) {
            currentStepIndex[i] = 0;
            steppers[i]->setCurrentPosition(0);
        }

        for(int i=0; i<4; i++) {
            checkAndLoadNextStep(steppers[i], i);
        }

        isRunning = true;
        Serial.println("Starting execution...");
        bleSerial.println("Starting execution...");
    } else {
        Serial.println("No data to start.");
        bleSerial.println("No data to start.");
    }
}

// Phân tích chuỗi dữ liệu cho các motor
// Định dạng: V1,VP1,D1;V2,VP2,D2;V3,VP3,D3;V4,VP4,D4
void parseDataString(String data) {
  isRunning = false; 
  for(int i=0; i<4; i++) {
    sequenceLengths[i] = 0;
    steppers[i]->stop();
  }

  int motorIndex = 0;
  int lastDelim = -1;
  
  for (int i = 0; i < data.length() && motorIndex < 4; i++) {
    if (data.charAt(i) == ';') {
      String motorPart = data.substring(lastDelim + 1, i);
      if (parseSingleStep(motorPart, motorIndex, 0)) {
        sequenceLengths[motorIndex] = 1;
      }
      lastDelim = i;
      motorIndex++;
    }
  }
  
  String lastMotorPart = data.substring(lastDelim + 1);
  if (lastMotorPart.length() > 0 && motorIndex < 4) {
      if (parseSingleStep(lastMotorPart, motorIndex, 0)) {
          sequenceLengths[motorIndex] = 1;
      }
  }
  
  Serial.println("Data parsed and stored.");
  bleSerial.println("Data parsed and stored.");
}

// Phân tích dữ liệu cho một motor duy nhất
bool parseSingleStep(String stepData, int motorIndex, int stepIndex) {
  int firstComma = stepData.indexOf(',');
  int secondComma = stepData.lastIndexOf(',');

  if (firstComma == -1 || secondComma == -1 || firstComma == secondComma) return false;

  float revolutions = stepData.substring(0, firstComma).toFloat();
  float rpm = stepData.substring(firstComma + 1, secondComma).toFloat();
  int direction = stepData.substring(secondComma + 1).toInt();

  if (revolutions == 0 && rpm == 0) {
      sequenceLengths[motorIndex] = 0;
      return false;
  }

  MotorStep current;
  current.steps = revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1);
  current.speed = (rpm * STEPS_PER_REV / 60.0);
  
  motorSequences[motorIndex][stepIndex] = current;
  return true;
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
    arduinoCodeButton.addEventListener('click', showArduinoCodeModal);

    connectButton.addEventListener('click', () => {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            handleDisconnect();
        } else {
            handleConnect();
        }
    });

    sendButton.addEventListener('click', handleSend);
    startButton.addEventListener('click', () => sendDataInChunks('START'));
    pauseButton.addEventListener('click', () => sendDataInChunks('PAUSE'));
    clearButton.addEventListener('click', handleClear);

    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
