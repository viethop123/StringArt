/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
function App() {
    const appContainer = document.createElement('div');
    appContainer.id = 'app-container';
    let bluetoothDevice = null;
    let txCharacteristic = null;
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'StringArt';
    header.appendChild(title);
    appContainer.appendChild(header);
    function handleInput(event) {
        const input = event.target;
        input.value = input.value.replace(/[^0-9/]/g, '');
    }
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
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls';
    controlsContainer.setAttribute('role', 'group');
    controlsContainer.setAttribute('aria-label', 'Application Controls');
    
    // --- PWA Install Button ---
    const installButton = document.createElement('button');
    installButton.id = 'install-btn';
    installButton.textContent = 'Cài đặt App';
    installButton.style.display = 'none'; // Hidden by default
    controlsContainer.appendChild(installButton);

    const connectButton = document.createElement('button');
    connectButton.textContent = 'Connect';
    connectButton.id = 'connect-btn';
    controlsContainer.appendChild(connectButton);
    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.id = 'send-btn';
    sendButton.disabled = true;
    controlsContainer.appendChild(sendButton);
    const startButton = document.createElement('button');
    startButton.textContent = 'Start';
    startButton.id = 'start-btn';
    startButton.disabled = true;
    controlsContainer.appendChild(startButton);
    const pauseButton = document.createElement('button');
    pauseButton.textContent = 'Pause';
    pauseButton.id = 'pause-btn';
    pauseButton.disabled = true;
    controlsContainer.appendChild(pauseButton);
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.id = 'clear-btn';
    controlsContainer.appendChild(clearButton);
    appContainer.appendChild(controlsContainer);
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
    function setNotification(message, isError = false) {
        notificationInput.value = message;
        notificationInput.style.color = isError ? '#D32F2F' : '#388E3C';
        notificationInput.style.borderColor = isError ? '#D32F2F' : '#388E3C';
    }
    async function handleConnect() {
        const UART_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
        const TX_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";
        try {
            setNotification('Đang tìm kiếm thiết bị...');
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
                optionalServices: [UART_SERVICE_UUID]
            });
            setNotification('Đang kết nối với thiết bị...');
            const server = await bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            txCharacteristic = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);
            sendButton.disabled = false;
            startButton.disabled = false;
            pauseButton.disabled = false;
            connectButton.textContent = 'Disconnect';
            setNotification('Đã kết nối Bluetooth thành công!');
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
        }
        catch (error) {
            console.error('Lỗi kết nối Bluetooth:', error);
            setNotification('Lỗi kết nối Bluetooth', true);
        }
    }
    function onDisconnected() {
        setNotification('Mất kết nối Bluetooth', true);
        sendButton.disabled = true;
        startButton.disabled = true;
        pauseButton.disabled = true;
        connectButton.textContent = 'Connect';
        bluetoothDevice = null;
        txCharacteristic = null;
    }
    async function handleDisconnect() {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        }
        else {
            onDisconnected();
        }
    }
    async function sendBleCommand(command) {
        if (!txCharacteristic) {
            setNotification('Không có kết nối Bluetooth', true);
            return;
        }
        try {
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n'));
            setNotification(`Lệnh ${command} đã được gửi`);
        }
        catch (error) {
            console.error(`Lỗi gửi lệnh ${command}:`, error);
            setNotification(`Gửi lệnh ${command} Thất Bại`, true);
        }
    }
    async function handleSend() {
        if (!txCharacteristic) {
            setNotification('Không có kết nối Bluetooth để gửi', true);
            return;
        }
        try {
            const motorData = [];
            for (let i = 1; i <= 4; i++) {
                const vStr = document.getElementById(`m${i}-v`).value.trim();
                const vpStr = document.getElementById(`m${i}-vp`).value.trim();
                const dirStr = document.getElementById(`m${i}-dir`).value.trim();
                if (!vStr && !vpStr && !dirStr) {
                    motorData.push('0,0,0');
                    continue;
                }
                const vArr = (vStr || '0').split('/').map(s => s.trim());
                const vpArr = (vpStr || '0').split('/').map(s => s.trim());
                const dirArr = (dirStr || '0').split('/').map(s => s.trim());
                if (vArr.length !== vpArr.length || vArr.length !== dirArr.length) {
                    setNotification(`Lỗi dữ liệu M${i}: Số lượng giá trị không khớp.`, true);
                    return;
                }
                const sequenceParts = [];
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
            await txCharacteristic.writeValue(encoder.encode(dataString + '\n'));
            setNotification('Đã gửi dữ liệu Thành Công');
        }
        catch (error) {
            console.error('Lỗi gửi dữ liệu:', error);
            setNotification('Gửi dữ liệu Thất Bại', true);
        }
    }
    function handleClear() {
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`m${i}-v`).value = '';
            document.getElementById(`m${i}-vp`).value = '';
            document.getElementById(`m${i}-dir`).value = '';
        }
        setNotification('Đã xóa dữ liệu trên App');
    }
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
    steppers[i]->setMaxSpeed(4000);
  }
}

void loop() {
  if (bleSerial.available()) {
    String command = bleSerial.readStringUntil('\\n');
    command.trim();
    parseCommand(command);
  }

  if (isRunning) {
    bool allMotorsFinished = true;
    for (int i=0; i<4; i++) {
      if (steppers[i]->distanceToGo() != 0) {
        steppers[i]->run();
        allMotorsFinished = false;
      }
    }
    
    for (int i=0; i<4; i++) {
      checkAndLoadNextStep(steppers[i], i);
    }

    if (allMotorsFinished) {
      bool allSequencesDone = true;
      for (int i=0; i<4; i++) {
        if (currentStepIndex[i] < sequenceLengths[i]) {
          allSequencesDone = false;
          break;
        }
      }
      if (allSequencesDone) {
        isRunning = false;
        Serial.println("All sequences complete.");
      }
    }
  }
}

void checkAndLoadNextStep(AccelStepper* stepper, int motorIndex) {
    if (stepper->distanceToGo() == 0) {
        if (currentStepIndex[motorIndex] < sequenceLengths[motorIndex]) {
            MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
            stepper->moveTo(stepper->currentPosition() + next.steps);
            stepper->setSpeed(next.speed);
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
  } else {
    parseDataString(command);
  }
}

void startMotors() {
    bool hasData = false;
    for(int i=0; i<4; i++) if (sequenceLengths[i] > 0) hasData = true;

    if (hasData) {
        for(int i=0; i<4; i++) {
            currentStepIndex[i] = 0;
            steppers[i]->setCurrentPosition(0);
        }

        for(int i=0; i<4; i++) checkAndLoadNextStep(steppers[i], i);

        isRunning = true;
        Serial.println("Starting execution...");
    } else {
        Serial.println("No data to start.");
    }
}

void parseDataString(String data) {
  isRunning = false;
  for(int i=0; i<4; i++) sequenceLengths[i] = 0;

  int motorIndex = 0;
  int lastDelim = -1;
  for (int i = 0; i < data.length() && motorIndex < 4; i++) {
    if (data.charAt(i) == ';') {
      String motorPart = data.substring(lastDelim + 1, i);
      parseMotorSequence(motorPart, motorIndex);
      lastDelim = i;
      motorIndex++;
    }
  }
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
  for (int i = 0; i < sequence.length() && stepIndex < MAX_SEQUENCE_STEPS; i++) {
    if (sequence.charAt(i) == '|') {
      String stepPart = sequence.substring(lastPipe + 1, i);
      parseSingleStep(stepPart, motorIndex, stepIndex);
      lastPipe = i;
      stepIndex++;
    }
  }
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

  if (firstComma == -1 || secondComma == -1) return;

  float revolutions = stepData.substring(0, firstComma).toFloat();
  float rpm = stepData.substring(firstComma + 1, secondComma).toFloat();
  int direction = stepData.substring(secondComma + 1).toInt();

  MotorStep current;
  current.steps = revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1);
  current.speed = (rpm * STEPS_PER_REV / 60.0) * (direction == 1 ? 1 : -1);
  
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
        }
        else {
            handleConnect();
        }
    });
    sendButton.addEventListener('click', handleSend);
    startButton.addEventListener('click', () => sendBleCommand('START'));
    pauseButton.addEventListener('click', () => sendBleCommand('PAUSE'));
    clearButton.addEventListener('click', handleClear);

    // --- PWA Install Logic ---
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'block';
    });

    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installButton.style.display = 'none';
        }
    });

    return appContainer;
}
const root = document.getElementById('app');
if (root) {
    root.appendChild(App());
}
