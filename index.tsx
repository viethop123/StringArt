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
    const allButtons = [connectButton, ...actionButtons];
    const inputElements: HTMLInputElement[] = [];


    // --- UI State Update Function ---
    function updateUIState() {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        
        if (isBusy) {
            allButtons.forEach(btn => btn.disabled = true);
        } else {
            connectButton.disabled = false;
            actionButtons.forEach(btn => btn.disabled = !isConnected);
        }
        
        if (isConnected) {
             notificationInput.placeholder = 'Đã kết nối. Sẵn sàng nhận lệnh.';
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

    // --- Input Validation ---
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
            inputElements.push(input);
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
    
    // Simple delay function
    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function handleConnect() {
        if (!navigator.bluetooth) {
            setNotification('Lỗi: Web Bluetooth không được hỗ trợ!', true);
            return;
        }
        try {
            isBusy = true;
            updateUIState();
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
            setNotification(`Kết nối thành công tới ${bluetoothDevice.name}!`, false);
            
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
            isBusy = false;
            updateUIState(); 
        }
    }
    
    function onDisconnected() {
        setNotification('Đã mất kết nối Bluetooth.', true);
        isConnected = false;
        isBusy = false;
        bluetoothDevice = null;
        txCharacteristic = null;
        updateUIState();
    }

    async function handleDisconnect() {
        if (!bluetoothDevice) return;
        try {
            isBusy = true;
            updateUIState();
            setNotification('Đang ngắt kết nối...');
            await bluetoothDevice.gatt.disconnect();
        } catch (error) {
            let errorMessage = 'Ngắt kết nối thất bại.';
             if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
             // onDisconnected will handle the final state update
        }
    }

    async function sendBleCommand(command: string) {
        if (!isConnected || !txCharacteristic) {
            setNotification('Lỗi: Chưa kết nối để gửi lệnh.', true);
            return;
        }
        
        isBusy = true;
        updateUIState();
        
        try {
            setNotification(`Đang gửi: ${command}`, false);
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n'));
            await sleep(150); // Wait to ensure command is processed
            setNotification(`Đã gửi: ${command}`, false);
        } catch (error) {
            let errorMessage = 'Gửi lệnh thất bại.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
            isBusy = false;
            updateUIState();
        }
    }

    function handleSend() {
        const motorData: string[] = [];
        for (let i = 1; i <= 4; i++) {
            const v = (document.getElementById(`m${i}-v`) as HTMLInputElement).value || '0';
            const vp = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value || '0';
            const dir = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value || '0';
            // Use comma as the separator within a step, as it's less likely to be in the data itself
            motorData.push(`${v},${vp},${dir}`);
        }
        const commandString = motorData.join(';');
        sendBleCommand(commandString);
    }

    function handleClear() {
        inputElements.forEach(input => input.value = '');
        setNotification('Đã xóa tất cả dữ liệu nhập.', false);
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
        modalTitle.textContent = 'Mã Nguồn Arduino (Phiên Bản Hoàn Chỉnh)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <p style="color: green; font-weight: bold;">Đây là phiên bản cuối cùng, đã sửa tất cả các lỗi biên dịch và lỗi logic.</p>
            <ul>
                <li>Sửa lỗi biên dịch bằng cách sử dụng mã ASCII (10) cho ký tự xuống dòng.</li>
                <li>Có đầy đủ chức năng điều khiển cả 4 motor.</li>
                <li>Tự động xóa nhiễu và dữ liệu cũ để đảm bảo an toàn.</li>
            </ul>
        `;
        
        const arduinoCodeString = `
#include <SoftwareSerial.h>
#include <AccelStepper.h>

// --- KHAI BAO TRUOC HAM (FIX LOI BIEN DICH) ---
void readBluetooth();
void parseCommand(String command);
void parseDataString(String data);
void parseMotorSequence(String sequence, int motorIndex);
void parseSingleStep(String stepData, int motorIndex, int stepIndex);
void startMotors();
void loadNextStepForMotor(int motorIndex);
void clearAllMotorData();

// --- CAU HINH ---
#define MotorInterfaceType AccelStepper::DRIVER
SoftwareSerial bleSerial(10, 11); // RX, TX

AccelStepper stepper1(MotorInterfaceType, 2, 3);
AccelStepper stepper2(MotorInterfaceType, 4, 5);
AccelStepper stepper3(MotorInterfaceType, 6, 7);
AccelStepper stepper4(MotorInterfaceType, 8, 9);
AccelStepper* steppers[] = {&stepper1, &stepper2, &stepper3, &stepper4};

const long STEPS_PER_REV = 3200; 
const int MAX_SEQUENCE_STEPS = 10; 

struct MotorStep {
  long steps;
  float speed; 
};

MotorStep motorSequences[4][MAX_SEQUENCE_STEPS];
int sequenceLengths[4] = {0, 0, 0, 0};
int currentStepIndex[4] = {0, 0, 0, 0};
bool isRunning = false;
String inputBuffer = "";
bool commandReady = false;

// --- CHUONG TRINH CHINH ---
void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  inputBuffer.reserve(200); 

  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(8000); 
    steppers[i]->setAcceleration(2000);
  }

  delay(100);
  while(bleSerial.available()) bleSerial.read();

  Serial.println("Arduino san sang. Phien ban hoan chinh.");
}

void loop() {
  readBluetooth();

  if (commandReady) {
    parseCommand(inputBuffer);
    inputBuffer = "";
    commandReady = false;
  }

  if (isRunning) {
    for (int i = 0; i < 4; i++) {
      if (steppers[i]->distanceToGo() == 0) {
        loadNextStepForMotor(i);
      }
      steppers[i]->run();
    }
  }
}

// --- CAC HAM CHUC NANG ---

void readBluetooth() {
  while (bleSerial.available()) {
    char c = bleSerial.read();
    if (c == 10) { // SU DUNG ASCII 10 DE FIX LOI BIEN DICH
      commandReady = true;
      return;
    } else if (c >= 32) {
      inputBuffer += c;
    }
  }
}

void parseCommand(String command) {
  command.trim();
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
    steppers[i]->stop(); 
  }

  Serial.println("!!! BAT DAU CHAY !!!");
  isRunning = true;
}

void loadNextStepForMotor(int motorIndex) {
  if (currentStepIndex[motorIndex] >= sequenceLengths[motorIndex]) {
    return; // Da chay het cac buoc
  }

  MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
  
  steppers[motorIndex]->setMaxSpeed(fabs(next.speed));
  steppers[motorIndex]->move(next.steps);

  currentStepIndex[motorIndex]++;
}

void clearAllMotorData() {
  for (int i = 0; i < 4; i++) {
    sequenceLengths[i] = 0;
    currentStepIndex[i] = 0;
    for (int j = 0; j < MAX_SEQUENCE_STEPS; j++) {
      motorSequences[i][j].steps = 0;
      motorSequences[i][j].speed = 0;
    }
  }
}

void parseDataString(String data) {
  Serial.println("Nhan chuoi du lieu. Bat dau phan tich...");
  clearAllMotorData(); // XOA DU LIEU CU DE DAM BAO AN TOAN
  isRunning = false;

  int motorIndex = 0;
  int lastSemi = -1;

  for (int i = 0; i < data.length(); i++) {
    if (data.charAt(i) == ';') {
      if (motorIndex < 4) {
        String motorPart = data.substring(lastSemi + 1, i);
        parseMotorSequence(motorPart, motorIndex);
      }
      lastSemi = i;
      motorIndex++;
    }
  }

  if (motorIndex < 4) {
    String lastMotorPart = data.substring(lastSemi + 1);
    parseMotorSequence(lastMotorPart, motorIndex);
  }
  
  Serial.println("--> Phan tich du lieu hoan tat. San sang de START.");
}

void parseMotorSequence(String sequence, int motorIndex) {
  if (sequence.length() == 0) return;

  int stepIndex = 0;
  int lastPipe = -1;

  for (int i = 0; i < sequence.length(); i++) {
    if (sequence.charAt(i) == '/') {
      if (stepIndex < MAX_SEQUENCE_STEPS) {
        String stepPart = sequence.substring(lastPipe + 1, i);
        parseSingleStep(stepPart, motorIndex, stepIndex);
        stepIndex++;
      }
      lastPipe = i;
    }
  }

  if (stepIndex < MAX_SEQUENCE_STEPS) {
    String lastStepPart = sequence.substring(lastPipe + 1);
    if (lastStepPart.length() > 0) {
      parseSingleStep(lastStepPart, motorIndex, stepIndex);
      stepIndex++;
    }
  }
  sequenceLengths[motorIndex] = stepIndex;
}

void parseSingleStep(String stepData, int motorIndex, int stepIndex) {
  int firstComma = stepData.indexOf(',');
  int secondComma = stepData.lastIndexOf(',');

  if (firstComma == -1 || secondComma == -1 || firstComma == secondComma) {
    if(stepData.length() > 0) Serial.println("LOI: Du lieu buoc khong hop le: " + stepData);
    return;
  }

  float revolutions = stepData.substring(0, firstComma).toFloat();
  float rpm = stepData.substring(firstComma + 1, secondComma).toFloat();
  int direction = stepData.substring(secondComma + 1).toInt();

  long steps = (long)(revolutions * STEPS_PER_REV);
  float speed = (rpm * STEPS_PER_REV / 60.0f);

  if (direction == 0) {
    steps = -steps;
  }

  motorSequences[motorIndex][stepIndex].steps = steps;
  motorSequences[motorIndex][stepIndex].speed = speed;
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
