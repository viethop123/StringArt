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

    // --- Input Filter ---
    function handleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        // Allow only numbers and '/'
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
            input.type = 'text'; // Changed to text to allow '/'
            input.id = `m${i}-${inputInfo.id}`;
            input.name = `m${i}-${inputInfo.id}`;
            input.placeholder = inputInfo.placeholder;
            input.addEventListener('input', handleInput); // Add filter
            
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
    
    async function sendBleCommand(command: string) {
        if (!uartCharacteristic) {
            setNotification('Không có kết nối Bluetooth', true);
            return;
        }
        try {
            const encoder = new TextEncoder();
            await uartCharacteristic.writeValue(encoder.encode(command + '\n'));
            setNotification(`Lệnh ${command} đã được gửi`);
        } catch (error) {
            console.error(`Lỗi gửi lệnh ${command}:`, error);
            setNotification(`Gửi lệnh ${command} Thất Bại`, true);
        }
    }

    async function handleSend() {
        if (!uartCharacteristic) {
            setNotification('Không có kết nối Bluetooth để gửi', true);
            return;
        }
    
        try {
            const motorData: string[] = [];
            for (let i = 1; i <= 4; i++) {
                const vStr = (document.getElementById(`m${i}-v`) as HTMLInputElement).value.trim();
                const vpStr = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value.trim();
                const dirStr = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value.trim();
    
                if (!vStr && !vpStr && !dirStr) {
                    motorData.push('0,0,0'); // Default for empty motor
                    continue;
                }
    
                const vArr = (vStr || '0').split('/').map(s => s.trim());
                const vpArr = (vpStr || '0').split('/').map(s => s.trim());
                const dirArr = (dirStr || '0').split('/').map(s => s.trim());
    
                if (vArr.length !== vpArr.length || vArr.length !== dirArr.length) {
                    setNotification(`Lỗi dữ liệu M${i}: Số lượng giá trị không khớp.`, true);
                    return;
                }
    
                const sequenceParts: string[] = [];
                for (let j = 0; j < vArr.length; j++) {
                    const v = vArr[j] || '0';
                    const vp = vpArr[j] || '0';
                    const dir = dirArr[j] || '0';
                    sequenceParts.push(`${v},${vp},${dir}`);
                }
                motorData.push(sequenceParts.join('|'));
            }
            const dataString = motorData.join(';');
    
            const encoder = new TextEncoder();
            await uartCharacteristic.writeValue(encoder.encode(dataString + '\n'));
            setNotification('Đã gửi dữ liệu Thành Công');
    
        } catch (error) {
            console.error('Lỗi gửi dữ liệu:', error);
            setNotification('Gửi dữ liệu Thất Bại', true);
        }
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

AccelStepper stepper1(MotorInterfaceType, 2, 3);
AccelStepper stepper2(MotorInterfaceType, 4, 5);
AccelStepper stepper3(MotorInterfaceType, 6, 7);
AccelStepper stepper4(MotorInterfaceType, 8, 9);
AccelStepper* steppers[] = {&stepper1, &stepper2, &stepper3, &stepper4};

SoftwareSerial bleSerial(10, 11); // RX, TX

const long STEPS_PER_REV = 3200;
const int MAX_SEQUENCE_STEPS = 10;

struct MotorStep {
  long steps;
  float speed;
};

MotorStep motorSequences[4][MAX_SEQUENCE_STEPS];
int sequenceLengths[4] = {0};
int currentStepIndex[4] = {0};
bool isRunning = false;

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600); 

  for (int i=0; i<4; i++) {
    steppers[i]->setMaxSpeed(8000.0); // Set a high initial max speed
    steppers[i]->setAcceleration(1000.0); // Set a moderate acceleration
  }
}

void loop() {
  // Use a more robust method to read from BLE to handle long data strings
  // that might overflow the default 64-byte SoftwareSerial buffer.
  if (bleSerial.available()) {
    static String command = ""; // Use static to persist data across loop iterations
    while (bleSerial.available()) {
      char c = bleSerial.read();
      if (c == '\\n') {
        command.trim();
        parseCommand(command);
        command = ""; // Reset for the next command
        break;        // Exit the inner while loop
      } else {
        command += c;
      }
    }
  }

  // If the machine is running, execute motor steps
  if (isRunning) {
    // These run() calls must be made as frequently as possible
    steppers[0]->run();
    steppers[1]->run();
    steppers[2]->run();
    steppers[3]->run();

    // After running, check if any motor has finished its move
    // and needs the next sequence step loaded.
    for (int i=0; i<4; i++) {
      checkAndLoadNextStep(steppers[i], i);
    }

    // Check if all motors have completed all their sequences
    bool allSequencesDone = true;
    for (int i = 0; i < 4; i++) {
      // A motor's sequence is not done if it's still moving OR 
      // if it has stopped but still has more steps in its sequence list.
      if (steppers[i]->distanceToGo() != 0 || currentStepIndex[i] < sequenceLengths[i]) {
        allSequencesDone = false;
        break;
      }
    }

    if (allSequencesDone) {
      isRunning = false;
      Serial.println("All sequences complete.");
      bleSerial.println("All sequences complete."); // Notify app
    }
  }
}

void checkAndLoadNextStep(AccelStepper* stepper, int motorIndex) {
    // If the motor is not busy (has reached its target) and there are more steps in its sequence...
    if (stepper->distanceToGo() == 0) {
        if (currentStepIndex[motorIndex] < sequenceLengths[motorIndex]) {
            MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
            // Per user feedback: use abs() for speed and set acceleration for each move.
            stepper->setMaxSpeed(abs(next.speed)); 
            stepper->setAcceleration(1000.0);
            stepper->moveTo(stepper->currentPosition() + next.steps);
            currentStepIndex[motorIndex]++;
        }
    }
}

void parseCommand(String command) {
  Serial.println("Received: " + command);
  if (command.equalsIgnoreCase("START")) {
    startMotors();
  } else if (command.equalsIgnoreCase("PAUSE")) {
    isRunning = false;
    Serial.println("Execution paused.");
    bleSerial.println("Execution paused.");
  } else {
    // Any other string is assumed to be motor data
    parseDataString(command);
  }
}

void startMotors() {
    bool hasData = false;
    for(int i=0; i<4; i++) if (sequenceLengths[i] > 0) hasData = true;

    if (hasData) {
        // Reset positions and sequence indices for all motors
        for(int i=0; i<4; i++) {
            currentStepIndex[i] = 0;
            steppers[i]->setCurrentPosition(0);
        }

        // Load the first step for all motors that have a sequence
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

void parseDataString(String data) {
  // Stop any current execution when new data is received
  isRunning = false; 
  for(int i=0; i<4; i++) {
    sequenceLengths[i] = 0; // Clear old sequences
    steppers[i]->stop(); // Immediately stop the motor
  }

  int motorIndex = 0;
  int lastDelim = -1;
  // Parse M1;M2;M3;
  for (int i = 0; i < data.length() && motorIndex < 4; i++) {
    if (data.charAt(i) == ';') {
      String motorPart = data.substring(lastDelim + 1, i);
      parseMotorSequence(motorPart, motorIndex);
      lastDelim = i;
      motorIndex++;
    }
  }
  // Parse M4 (the last part without a trailing ';')
  String lastMotorPart = data.substring(lastDelim + 1);
  if (lastMotorPart.length() > 0 && motorIndex < 4) {
      parseMotorSequence(lastMotorPart, motorIndex);
  }
  
  Serial.println("Data parsed and stored.");
  bleSerial.println("Data parsed and stored.");
}

void parseMotorSequence(String sequence, int motorIndex) {
  int stepIndex = 0;
  int lastPipe = -1;
  // Parse V1,VP1,D1|V2,VP2,D2
  for (int i = 0; i < sequence.length() && stepIndex < MAX_SEQUENCE_STEPS; i++) {
    if (sequence.charAt(i) == '|') {
      String stepPart = sequence.substring(lastPipe + 1, i);
      parseSingleStep(stepPart, motorIndex, stepIndex);
      lastPipe = i;
      stepIndex++;
    }
  }
  // Parse the last step part
  String lastStepPart = sequence.substring(lastPipe + 1);
  if (lastStepPart.length() > 0 && stepIndex < MAX_SEQUENCE_STEPS) {
      parseSingleStep(lastStepPart, motorIndex, stepIndex);
      stepIndex++;
  }
  sequenceLengths[motorIndex] = stepIndex;
}

void parseSingleStep(String stepData, int motorIndex, int stepIndex) {
  int firstComma = stepData.indexOf(',');
  int secondComma = stepData.lastIndexOf(',');

  if (firstComma == -1 || secondComma == -1 || firstComma == secondComma) return;

  float revolutions = stepData.substring(0, firstComma).toFloat();
  float rpm = stepData.substring(firstComma + 1, secondComma).toFloat();
  int direction = stepData.substring(secondComma + 1).toInt();

  MotorStep current;
  // Calculate total steps. Direction is applied here. AccelStepper handles direction
  // based on whether the target position is > or < the current position.
  current.steps = revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1);
  
  // Calculate speed in steps/sec. This MUST be a positive value for setMaxSpeed.
  current.speed = (rpm * STEPS_PER_REV / 60.0);
  
  motorSequences[motorIndex][stepIndex] = current;
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
    arduinoCodeButton.addEventListener('click', showArduinoCodeModal);

    connectButton.addEventListener('click', () => {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            handleDisconnect();
        } else {
            handleConnect();
        }
    });

    sendButton.addEventListener('click', handleSend);
    startButton.addEventListener('click', () => sendBleCommand('START'));
    pauseButton.addEventListener('click', () => sendBleCommand('PAUSE'));
    clearButton.addEventListener('click', handleClear);

    return appContainer;
}

const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}

export {};
