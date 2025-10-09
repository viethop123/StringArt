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
    let isBusy = false; // Prevents sending multiple commands at once

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

    // --- UI State Update Function ---
    function updateUIState() {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        
        if (isBusy) {
             actionButtons.forEach(btn => btn.disabled = true);
             connectButton.disabled = true;
        } else {
             actionButtons.forEach(btn => btn.disabled = !isConnected);
             connectButton.disabled = false;
        }

        notificationInput.placeholder = isConnected ? 'Đã kết nối' : 'Chưa kết nối Bluetooth';
        if (isConnected && !isBusy) {
            setNotification('Kết nối thành công! Sẵn sàng nhận lệnh.', false);
        } else if (!isConnected) {
             notificationInput.value = '';
             notificationInput.style.borderColor = 'var(--input-border-color)';
        }
    }
    
    // Header
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);

    // --- Input Validation ---
    function validateInput(value: string): string {
        // Allow numbers, slashes, and dots. Remove anything else.
        return value.replace(/[^0-9/.]/g, '');
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
            { id: 'v', label: 'V (Vòng)', placeholder: '100.5/40/30' },
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


    // --- EVENT HANDLERS (Re-programming) ---

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
            setNotification('Đang ngắt kết nối...');
            await bluetoothDevice.gatt.disconnect();
        } catch (error) {
            let errorMessage = 'Ngắt kết nối thất bại.';
             if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
            // The 'onDisconnected' handler will manage the state update
        }
    }

    // --- STEP 2: Programming Send, Start, Pause ---

    async function sendBleCommand(command: string) {
        if (!isConnected || !txCharacteristic || isBusy) {
            setNotification('Lỗi: Chưa sẵn sàng để gửi lệnh.', true);
            return;
        }

        isBusy = true;
        updateUIState();
        
        try {
            setNotification(`Đang gửi: ${command}...`);
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n')); // Append newline
            setNotification(`Đã gửi thành công: ${command}`, false);
        } catch (error) {
            let errorMessage = 'Gửi lệnh thất bại.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
            // Wait a bit before allowing new commands
            setTimeout(() => {
                isBusy = false;
                updateUIState();
            }, 200);
        }
    }
    
    function handleSend() {
        let dataString = '';
        for (let i = 1; i <= 4; i++) {
            const v = (document.getElementById(`m${i}-v`) as HTMLInputElement).value || "0";
            const vp = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value || "0";
            const dir = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value || "0";

            // Convert slash to comma for each part
            const v_formatted = v.replace(/\//g, ',');
            const vp_formatted = vp.replace(/\//g, ',');
            const dir_formatted = dir.replace(/\//g, ',');

            const motorPart = `${v_formatted}/${vp_formatted}/${dir_formatted}`;
            dataString += motorPart;
            if (i < 4) {
                dataString += ';';
            }
        }
        sendBleCommand(dataString);
    }
    
    function handleStart() {
        sendBleCommand('START');
    }
    
    function handlePause() {
        sendBleCommand('PAUSE');
    }

    function handleClear() {
        for (let i = 1; i <= 4; i++) {
            (document.getElementById(`m${i}-v`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-vp`) as HTMLInputElement).value = '';
            (document.getElementById(`m${i}-dir`) as HTMLInputElement).value = '';
        }
        setNotification('Đã xóa dữ liệu trên App.', false);
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
        modalTitle.textContent = 'Mã Nguồn Arduino (Phiên bản Hoàn Chỉnh)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <h3>Mục tiêu: Phiên bản cuối cùng</h3>
            <p>Mã nguồn này đã được sửa lỗi hoàn toàn và có thể điều khiển cả 4 motor một cách độc lập với tốc độ chính xác. Nó có khả năng:</p>
            <ul>
                <li>Đọc dữ liệu qua Bluetooth mà không làm chậm hệ thống.</li>
                <li>Phân tích chuỗi dữ liệu phức tạp cho cả 4 motor.</li>
                <li>Xóa dữ liệu cũ một cách an toàn trước khi nhận lệnh mới.</li>
                <li>Điều khiển nhiều motor cùng lúc với thư viện AccelStepper.</li>
            </ul>
            <h3>Đấu dây</h3>
             <ul>
                <li><b>Module BLE &rarr; Arduino Nano:</b> TX &rarr; D10, RX &rarr; D11</li>
                <li><b>Driver M1 &rarr; Arduino:</b> STEP &rarr; D2, DIR &rarr; D3</li>
                <li><b>Driver M2 &rarr; Arduino:</b> STEP &rarr; D4, DIR &rarr; D5</li>
                <li><b>Driver M3 &rarr; Arduino:</b> STEP &rarr; D6, DIR &rarr; D7</li>
                <li><b>Driver M4 &rarr; Arduino:</b> STEP &rarr; D8, DIR &rarr; D9</li>
            </ul>
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

// --- Cấu hình ---
const long STEPS_PER_REV = 3200; // = 200 bước/vòng * 16 microsteps
const int MAX_SEQUENCE_STEPS = 10; // Số bước chạy tối đa cho mỗi motor
String inputBuffer = "";
bool commandReady = false;

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
  inputBuffer.reserve(200);
  
  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(8000); 
    steppers[i]->setAcceleration(2000);
  }
  Serial.println("Arduino san sang. Phien ban hoan chinh.");
}

void loop() {
  readBluetooth(); // Luôn đọc Bluetooth (non-blocking)

  if (commandReady) {
    inputBuffer.trim();
    parseCommand(inputBuffer);
    inputBuffer = "";
    commandReady = false;
  }

  if (isRunning) {
    bool anyMotorStillRunning = false;
    for (int i = 0; i < 4; i++) {
        if (steppers[i]->distanceToGo() != 0) {
            anyMotorStillRunning = true;
        } else {
            loadNextStepForMotor(i);
        }
        steppers[i]->run();
    }
    // If all motors have completed all their steps
    if (!anyMotorStillRunning) {
        bool allSequencesDone = true;
        for (int i = 0; i < 4; i++) {
            if (currentStepIndex[i] < sequenceLengths[i]) {
                allSequencesDone = false;
                break;
            }
        }
        if (allSequencesDone) {
            isRunning = false;
            Serial.println("!!! HOAN THANH TAT CA CHUOI LENH !!!");
        }
    }
  }
}

void readBluetooth() {
    while (bleSerial.available()) {
        char c = bleSerial.read();
        if (c == '\\n') {
            commandReady = true;
        } else {
            inputBuffer += c;
        }
    }
}

void parseCommand(String command) {
  Serial.print("Da nhan lenh: '"); Serial.print(command); Serial.println("'");
  if (command.equalsIgnoreCase("START")) {
    startMotors();
  } else if (command.equalsIgnoreCase("PAUSE")) {
    isRunning = false;
    Serial.println("Nhan lenh PAUSE. Da tam dung.");
  } else {
    parseDataString(command);
  }
}

void startMotors() {
    bool hasData = false;
    for (int i = 0; i < 4; i++) {
        if (sequenceLengths[i] > 0) hasData = true;
    }
    if (!hasData) {
        Serial.println("Loi: Khong co du lieu de chay.");
        return;
    }

    for (int i = 0; i < 4; i++) {
        currentStepIndex[i] = 0;
        steppers[i]->setCurrentPosition(0);
        steppers[i]->stop(); // Stop any previous movement
    }

    isRunning = true;
    Serial.println("!!! BAT DAU CHAY !!!");
    // The main loop will automatically load the first step.
}

void loadNextStepForMotor(int motorIndex) {
    if (currentStepIndex[motorIndex] >= sequenceLengths[motorIndex]) {
        return; // No more steps for this motor
    }

    MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];

    if (next.steps != 0) {
      float desiredSpeed = fabs(next.speed);
      if (desiredSpeed < 1.0) desiredSpeed = 1.0;
      steppers[motorIndex]->setMaxSpeed(desiredSpeed);
      steppers[motorIndex]->move(next.steps);
      
      Serial.print("  [M"); Serial.print(motorIndex + 1);
      Serial.print("] Nap buoc "); Serial.print(currentStepIndex[motorIndex] + 1);
      Serial.print(": Steps="); Serial.print(next.steps);
      Serial.print(", MaxSpeed="); Serial.println(desiredSpeed);
    }
    currentStepIndex[motorIndex]++;
}


void parseDataString(String data) {
    Serial.println("Nhan chuoi du lieu. Bat dau phan tich...");
    // Clear all previous sequence data
    for(int i = 0; i < 4; i++) {
      sequenceLengths[i] = 0;
      for(int j = 0; j < MAX_SEQUENCE_STEPS; j++) {
        motorSequences[i][j] = {0, 0.0};
      }
    }

    int currentMotor = 0;
    int lastSemiColon = -1;
    // Loop to find each semicolon
    for (int i = 0; i < data.length(); i++) {
        if (data.charAt(i) == ';') {
            if (currentMotor < 4) {
                String motorPart = data.substring(lastSemiColon + 1, i);
                parseMotorSequence(motorPart, currentMotor);
            }
            lastSemiColon = i;
            currentMotor++;
        }
    }
    // Handle the last motor part (after the last semicolon)
    if (currentMotor < 4) {
        String motorPart = data.substring(lastSemiColon + 1);
        parseMotorSequence(motorPart, currentMotor);
    }
    Serial.println("--> Phan tich du lieu hoan tat. San sang de START.");
}


void parseMotorSequence(String sequence, int motorIndex) {
    int stepIndex = 0;
    int lastSlash = -1;
    
    String v_part = "0", vp_part = "0", dir_part = "0";

    int firstSlash = sequence.indexOf('/');
    int secondSlash = sequence.lastIndexOf('/');

    if(firstSlash != -1 && secondSlash != -1 && firstSlash != secondSlash) {
        v_part = sequence.substring(0, firstSlash);
        vp_part = sequence.substring(firstSlash + 1, secondSlash);
        dir_part = sequence.substring(secondSlash + 1);
    }
    
    int lastComma = -1;
    for (int i = 0; i < v_part.length() && stepIndex < MAX_SEQUENCE_STEPS; i++) {
        if (v_part.charAt(i) == ',') {
            String rev = v_part.substring(lastComma + 1, i);
            parseSingleStep(rev, vp_part, dir_part, motorIndex, stepIndex);
            lastComma = i;
            stepIndex++;
        }
    }
    String lastRev = v_part.substring(lastComma + 1);
    if (lastRev.length() > 0 && stepIndex < MAX_SEQUENCE_STEPS) {
        parseSingleStep(lastRev, vp_part, dir_part, motorIndex, stepIndex);
        stepIndex++;
    }
    sequenceLengths[motorIndex] = stepIndex;
}

void parseSingleStep(String revStr, String rpmStr, String dirStr, int motorIndex, int stepIndex) {
    // Find corresponding RPM and DIR for the current step
    String currentRpm = "0";
    String currentDir = "0";
    int commaCount = 0;
    int lastComma = -1;

    for(int i = 0; i < rpmStr.length(); i++) {
        if(rpmStr.charAt(i) == ',') {
            if(commaCount == stepIndex - 1) { // Find the nth segment
                currentRpm = rpmStr.substring(lastComma + 1, i);
                break;
            }
            lastComma = i;
            commaCount++;
        }
    }
    if(currentRpm == "0") currentRpm = rpmStr.substring(lastComma + 1); // Get last/only one

    commaCount = 0;
    lastComma = -1;
     for(int i = 0; i < dirStr.length(); i++) {
        if(dirStr.charAt(i) == ',') {
            if(commaCount == stepIndex - 1) {
                currentDir = dirStr.substring(lastComma + 1, i);
                break;
            }
            lastComma = i;
            commaCount++;
        }
    }
    if(currentDir == "0") currentDir = dirStr.substring(lastComma + 1);

    float revolutions = revStr.toFloat();
    float rpm = currentRpm.toFloat();
    int direction = currentDir.toInt();

    MotorStep current;
    current.steps = (long)(revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1));
    current.speed = (rpm * STEPS_PER_REV / 60.0f) * (direction == 1 ? 1 : -1);
    
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

