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

    // --- DOM Elements ---
    const connectButton = document.createElement('button');
    const sendButton = document.createElement('button');
    const startButton = document.createElement('button');
    const pauseButton = document.createElement('button');
    const clearButton = document.createElement('button');
    const notificationInput = document.createElement('input');
    const actionButtons = [sendButton, startButton, pauseButton, clearButton];

    // --- UI State Update Function ---
    function updateUIState(connected: boolean) {
        isConnected = connected;

        connectButton.textContent = connected ? 'Disconnect' : 'Connect';
        
        actionButtons.forEach(btn => {
            btn.disabled = !connected;
        });

        if (connected) {
            setNotification('Đã kết nối. Sẵn sàng nhận lệnh.');
        } else {
            setNotification('Đã ngắt kết nối. Vui lòng kết nối lại.', true);
        }
    }
    
    // --- Simple, reliable BLE command sending ---
    async function sendBleCommand(command: string) {
        if (!isConnected || !txCharacteristic) {
            setNotification('Lỗi: Chưa kết nối Bluetooth.', true);
            return;
        }

        // 1. Lock UI to prevent command merging
        actionButtons.forEach(btn => btn.disabled = true);
        connectButton.disabled = true;
        const shortCmd = command.length > 30 ? `${command.substring(0, 30)}...` : command;
        setNotification(`Đang gửi: '${shortCmd}'`);

        try {
            // 2. Send command
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n'));
            setNotification(`Đã gửi: '${shortCmd}'`);

            // 3. Wait for a safe delay for BLE stack and Arduino to process
            await new Promise(resolve => setTimeout(resolve, 150));

        } catch (error) {
            console.error(`Lỗi gửi lệnh ${command}:`, error);
            setNotification(`Lỗi nghiêm trọng khi gửi lệnh.`, true);
            handleDisconnect(); // Treat send error as a disconnection
        } finally {
            // 4. Unlock UI if still connected
            if (isConnected) {
                actionButtons.forEach(btn => btn.disabled = false);
                setNotification('Sẵn sàng nhận lệnh tiếp theo.');
            }
            connectButton.disabled = false;
        }
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
        // Allow numbers and the '/' separator
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
    notificationInput.placeholder = 'Chưa kết nối Bluetooth';
    notificationInput.readOnly = true;
    notificationArea.appendChild(notificationInput);
    appContainer.appendChild(notificationArea);
    
    // Set initial UI state
    updateUIState(false);
    setNotification('Sẵn sàng kết nối Bluetooth.', false);


    // --- Event Handlers ---

    function setNotification(message: string, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
        notificationInput.style.borderColor = isError ? '#D32F2F' : '#388E3C';
    }

    async function handleConnect() {
        if (isConnected) {
            handleDisconnect();
            return;
        }

        const UART_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
        const TX_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

        try {
            connectButton.disabled = true;
            setNotification('Đang tìm kiếm thiết bị...');
            
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
                optionalServices: [UART_SERVICE_UUID]
            });
            
            setNotification(`Đang kết nối GATT tới ${bluetoothDevice.name || 'thiết bị'}...`);
            const server = await bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            txCharacteristic = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);

            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            updateUIState(true);

        } catch (error) {
            console.error('Lỗi kết nối Bluetooth:', error);
            if (error instanceof DOMException && error.name === 'NotFoundError') {
                 setNotification('Đã hủy tìm kiếm thiết bị.');
            } else {
                setNotification('Lỗi kết nối Bluetooth', true);
            }
            updateUIState(false);
        } finally {
            connectButton.disabled = false;
        }
    }

    function onDisconnected() {
        if (!isConnected) return; // Prevent multiple calls
        
        bluetoothDevice = null;
        txCharacteristic = null;
        updateUIState(false);
    }

    function handleDisconnect() {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        } else {
           onDisconnected();
        }
    }
    
    function handleSend() {
        const motorData: string[] = [];
        for (let i = 1; i <= 4; i++) {
            const vStr = (document.getElementById(`m${i}-v`) as HTMLInputElement).value.trim();
            const vpStr = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value.trim();
            const dirStr = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value.trim();

            if (!vStr && !vpStr && !dirStr) {
                motorData.push('');
                continue;
            }

            // Provide default values if some are missing, but not all
            const vArr = (vStr || '0').split('/');
            const vpArr = (vpStr || '0').split('/');
            const dirArr = (dirStr || '0').split('/');
            
            const maxLength = Math.max(vArr.length, vpArr.length, dirArr.length);

            // Simple, robust validation: if multiple steps, all fields must have the same number of steps.
            if (maxLength > 1) {
                if (vArr.length !== maxLength || vpArr.length !== maxLength || dirArr.length !== maxLength) {
                    setNotification(`Lỗi M${i}: Các trường (V, V/P, Chiều) phải có cùng số lượng giá trị.`, true);
                    return;
                }
            }

            const sequenceParts: string[] = [];
            for (let j = 0; j < maxLength; j++) {
                const v = (vArr[j] || vArr[0] || '0').trim();
                const vp = (vpArr[j] || vpArr[0] || '0').trim();
                const dir = (dirArr[j] || dirArr[0] || '0').trim();
                sequenceParts.push(`${v},${vp},${dir}`);
            }
            motorData.push(sequenceParts.join('|'));
        }
        
        const dataString = motorData.join(';');
        sendBleCommand(dataString);
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
             <h3>3. Nạp mã cho Arduino (Phiên bản cuối cùng, đã sửa lỗi)</h3>
             <p>Phiên bản này đã sửa 3 lỗi nghiêm trọng: <b>(1) Động cơ chạy chậm</b>, <b>(2) Motor 3, 4 không nhận lệnh</b> và <b>(3) Sử dụng dữ liệu cũ khi có lỗi.</b> Vui lòng sử dụng mã này.</p>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>
#include <AccelStepper.h>

#define MotorInterfaceType AccelStepper::DRIVER

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

String bleCommand = "";
bool commandComplete = false;

void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  Serial.println("Arduino san sang. Phien ban sua loi cuoi cung.");

  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(40000); // Set a high absolute max speed
    steppers[i]->setAcceleration(2000);
  }
}

void loop() {
  // 1. NON-BLOCKING BLUETOOTH READER (ensures motor loop is never starved)
  while (bleSerial.available() > 0 && !commandComplete) {
    char inChar = (char)bleSerial.read();
    if (inChar == '\\n') {
      commandComplete = true;
    } else if (inChar != '\\r') {
      bleCommand += inChar;
    }
  }

  // 2. PROCESS COMPLETE COMMAND (only when not running motors)
  if (commandComplete) {
    bleCommand.trim();
    if (bleCommand.length() > 0) {
      Serial.print("Da nhan lenh: '"); Serial.print(bleCommand); Serial.println("'");
      parseCommand(bleCommand);
    }
    bleCommand = "";
    commandComplete = false;
  }
  
  if (!isRunning) {
    return;
  }
  
  // 3. HIGH-PERFORMANCE MOTOR CONTROL LOOP
  bool isAnyMotorStillRunning = false;
  for (int i = 0; i < 4; i++) {
    // If a motor has finished its move, load the next one
    if (steppers[i]->distanceToGo() == 0) {
      loadNextStep(i);
    }
    // The run() function must be called as often as possible.
    // It returns true if the motor is still running.
    if (steppers[i]->run()) {
      isAnyMotorStillRunning = true;
    }
  }

  // If all motors have completed all their steps, stop the machine.
  if (!isAnyMotorStillRunning) {
    isRunning = false;
    Serial.println("!!! HOAN THANH TAT CA CHUOI LENH !!!");
  }
}

void loadNextStep(int motorIndex) {
  if (currentStepIndex[motorIndex] < sequenceLengths[motorIndex]) {
    MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
    steppers[motorIndex]->setMaxSpeed(next.speed);
    steppers[motorIndex]->move(next.steps); // move() is relative
    currentStepIndex[motorIndex]++;
  }
}

void parseCommand(String command) {
  if (command.equalsIgnoreCase("START")) {
    startMotors();
  } else if (command.equalsIgnoreCase("PAUSE")) {
    isRunning = false;
    for(int i=0; i<4; i++) steppers[i]->stop(); // stop() is abrupt
    Serial.println("Nhan lenh PAUSE. Da tam dung.");
  } else {
    Serial.println("Nhan chuoi du lieu. Bat dau phan tich...");
    parseDataString(command);
  }
}

void startMotors() {
  bool hasData = false;
  for (int i = 0; i < 4; i++) if (sequenceLengths[i] > 0) hasData = true;

  if (!hasData) {
    Serial.println("Loi: Khong co du lieu de chay.");
    return;
  }
  
  for (int i = 0; i < 4; i++) {
    currentStepIndex[i] = 0;
    steppers[i]->setCurrentPosition(0); // Reset position for relative moves
    steppers[i]->stop(); // Clear any previous movement
  }

  isRunning = true;
  Serial.println("!!! BAT DAU CHAY !!!");
  // Print initial step info for debugging
  for (int i = 0; i < 4; i++) {
    if (sequenceLengths[i] > 0) {
      MotorStep firstStep = motorSequences[i][0];
      Serial.print("  [M"); Serial.print(i + 1);
      Serial.print("] Buoc 1: Steps="); Serial.print(firstStep.steps);
      Serial.print(", MaxSpeed="); Serial.println(firstStep.speed);
    }
  }
}

// Robust parser for the data string "V,V/P,D|...;V,V/P,D|...;..."
void parseDataString(String data) {
    isRunning = false;
    // CRITICAL: Clear all old data before parsing new data to prevent stale commands.
    for(int i = 0; i < 4; i++) {
        sequenceLengths[i] = 0;
        for (int j = 0; j < MAX_SEQUENCE_STEPS; j++) {
            motorSequences[i][j] = {0, 0.0f};
        }
    }

    String dataCopy = data;
    for (int motorIndex = 0; motorIndex < 4; motorIndex++) {
        int separator = dataCopy.indexOf(';');
        String motorPart;

        if (separator != -1) {
            motorPart = dataCopy.substring(0, separator);
            dataCopy = dataCopy.substring(separator + 1);
        } else {
            // This is the last part of the string (or the only part)
            motorPart = dataCopy;
            dataCopy = ""; 
        }
        
        motorPart.trim();
        Serial.print("Phan tich M"); Serial.print(motorIndex + 1); Serial.print(": '"); Serial.print(motorPart); Serial.println("'");
        if (motorPart.length() > 0) {
            parseMotorSequence(motorPart, motorIndex);
        }
    }

    Serial.println("--> Phan tich du lieu hoan tat. San sang de START.");
    bleSerial.println("Data parsed and stored.");
}

void parseMotorSequence(String sequence, int motorIndex) {
  int stepIndex = 0;
  String seqCopy = sequence;

  while(seqCopy.length() > 0 && stepIndex < MAX_SEQUENCE_STEPS) {
    int separator = seqCopy.indexOf('|');
    String stepPart;
    if (separator != -1) {
      stepPart = seqCopy.substring(0, separator);
      seqCopy = seqCopy.substring(separator + 1);
    } else {
      stepPart = seqCopy;
      seqCopy = "";
    }
    
    stepPart.trim();
    if (stepPart.length() > 0) {
      if (parseSingleStep(stepPart, motorIndex, stepIndex)) {
        stepIndex++;
      }
    }
  }
  sequenceLengths[motorIndex] = stepIndex;
}

bool parseSingleStep(String stepData, int motorIndex, int stepIndex) {
  int firstComma = stepData.indexOf(',');
  int secondComma = stepData.lastIndexOf(',');

  // Ensure there are exactly two commas
  if (firstComma == -1 || secondComma == -1 || firstComma == secondComma) {
    Serial.print("LOI: Du lieu buoc khong hop le: "); Serial.println(stepData);
    return false;
  }

  float revolutions = stepData.substring(0, firstComma).toFloat();
  float rpm = stepData.substring(firstComma + 1, secondComma).toFloat();
  int direction = stepData.substring(secondComma + 1).toInt();

  MotorStep current;
  current.steps = (long)(revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1));
  // Speed is always positive for AccelStepper, direction is handled by steps sign
  current.speed = (rpm * STEPS_PER_REV / 60.0f); 
  if (current.speed < 1.0 && rpm > 0) current.speed = 1.0; // Avoid speed 0

  motorSequences[motorIndex][stepIndex] = current;

  Serial.print("[Parse M"); Serial.print(motorIndex+1);
  Serial.print("] rev="); Serial.print(revolutions);
  Serial.print(", rpm="); Serial.print(rpm);
  Serial.print(", dir="); Serial.print(direction);
  Serial.print(" => steps="); Serial.print(current.steps);
  Serial.print(", speedSteps/s="); Serial.println(current.speed);
  
  return true;
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

    connectButton.addEventListener('click', handleConnect);
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
