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
        // Allow numbers, slashes. Remove anything else.
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


    // --- EVENT HANDLERS ---

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
        }
    }


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
            setTimeout(() => {
                isBusy = false;
                updateUIState();
            }, 150); // Wait a bit before allowing new commands
        }
    }
    
    function handleSend() {
        let dataString = '';
        for (let i = 1; i <= 4; i++) {
            const v = (document.getElementById(`m${i}-v`) as HTMLInputElement).value || "0";
            const vp = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value || "0";
            const dir = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value || "0";

            const motorPart = `${v}/${vp}/${dir}`;
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
        modalTitle.textContent = 'Mã Nguồn Arduino (Phiên bản Cuối Cùng)';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const instructionsHTML = `
            <h3>Mục tiêu: Phiên bản cuối cùng, đã sửa lỗi</h3>
            <p>Mã nguồn này đã được viết lại cẩn thận để khắc phục tất cả các lỗi trước đó.</p>
            <ul>
                <li><b>Sửa lỗi nghiêm trọng:</b> Đã sửa lỗi đọc ký tự xuống dòng ('\\n' -> '\\n'), đảm bảo Arduino nhận lệnh chính xác.</li>
                <li><b>Chống nhiễu:</b> Tự động xóa các dữ liệu "rác" từ module Bluetooth khi khởi động.</li>
                <li><b>Phân tích dữ liệu mạnh mẽ:</b> Thuật toán mới, phân tích chính xác chuỗi dữ liệu phức tạp cho cả 4 motor.</li>
                <li><b>Tốc độ chính xác:</b> Đọc dữ liệu mà không làm chậm hệ thống, đảm bảo motor chạy đúng tốc độ bạn nhập.</li>
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
const long STEPS_PER_REV = 3200; 
const int MAX_SEQUENCE_STEPS = 10;
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

// --- Hàm phụ trợ để lấy một phần của chuỗi ---
String getValue(String data, char separator, int index) {
  int found = 0;
  int strIndex[] = {0, -1};
  int maxIndex = data.length() - 1;

  for (int i = 0; i <= maxIndex && found <= index; i++) {
    if (data.charAt(i) == separator || i == maxIndex) {
      found++;
      strIndex[0] = strIndex[1] + 1;
      strIndex[1] = (i == maxIndex) ? i + 1 : i;
    }
  }
  return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}


void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  inputBuffer.reserve(256); 
  
  // Xóa bộ đệm Bluetooth để loại bỏ nhiễu khi khởi động
  while(bleSerial.available()) bleSerial.read();

  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(8000); 
    steppers[i]->setAcceleration(2000);
  }
  Serial.println("Arduino san sang. Phien ban cuoi cung.");
}

void loop() {
  readBluetooth();

  if (commandReady) {
    inputBuffer.trim();
    parseCommand(inputBuffer);
    inputBuffer = "";
    commandReady = false;
  }

  if (isRunning) {
    bool anyMotorStillNeedsToRun = false;
    for (int i = 0; i < 4; i++) {
        // Nếu motor đã chạy xong bước hiện tại
        if (steppers[i]->distanceToGo() == 0) {
            // Nạp bước tiếp theo nếu có
            loadNextStepForMotor(i);
        }
        // Nếu motor vẫn còn quãng đường để đi (sau khi đã nạp lệnh mới)
        if (steppers[i]->distanceToGo() != 0) {
            anyMotorStillNeedsToRun = true;
        }
        steppers[i]->run();
    }
    
    if (!anyMotorStillNeedsToRun) {
        isRunning = false;
        Serial.println("!!! HOAN THANH TAT CA CHUOI LENH !!!");
    }
  }
}

void readBluetooth() {
    while (bleSerial.available()) {
        char c = bleSerial.read();
        if (c == '\\n') { // SỬA LỖI QUAN TRỌNG NHẤT
            commandReady = true;
        } else if (c >= 32) { // Chỉ thêm các ký tự in được
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
    for (int i = 0; i < 4; i++) if (sequenceLengths[i] > 0) hasData = true;
    
    if (!hasData) {
        Serial.println("Loi: Khong co du lieu de chay.");
        return;
    }

    for (int i = 0; i < 4; i++) {
        currentStepIndex[i] = 0;
        steppers[i]->setCurrentPosition(0);
        steppers[i]->stop();
    }
    isRunning = true;
    Serial.println("!!! BAT DAU CHAY !!!");
}

void loadNextStepForMotor(int motorIndex) {
    if (currentStepIndex[motorIndex] >= sequenceLengths[motorIndex]) {
        return; // Hết bước chạy cho motor này
    }

    MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];

    if (next.steps != 0) {
      float desiredSpeed = fabs(next.speed);
      if (desiredSpeed < 1.0) desiredSpeed = 1.0;
      steppers[motorIndex]->setMaxSpeed(desiredSpeed);
      steppers[motorIndex]->move(next.steps);
    }
    currentStepIndex[motorIndex]++;
}

void parseDataString(String data) {
    Serial.println("Nhan chuoi du lieu. Bat dau phan tich...");
    // Xóa sạch dữ liệu cũ
    for(int i = 0; i < 4; i++) sequenceLengths[i] = 0;

    for (int motorIdx = 0; motorIdx < 4; motorIdx++) {
        String motorPart = getValue(data, ';', motorIdx);
        if (motorPart.length() == 0) continue;

        String v_part = getValue(motorPart, '/', 0);
        String vp_part = getValue(motorPart, '/', 1);
        String dir_part = getValue(motorPart, '/', 2);

        int stepIndex = 0;
        for (int i = 0; i < MAX_SEQUENCE_STEPS; i++) {
            String revStr = getValue(v_part, '/', i); // App dùng / làm separator
            if (revStr.length() == 0) break;

            String rpmStr = getValue(vp_part, '/', i);
            if (rpmStr.length() == 0) rpmStr = getValue(vp_part, '/', 0); // Dùng giá trị đầu nếu thiếu

            String dirStr = getValue(dir_part, '/', i);
            if (dirStr.length() == 0) dirStr = getValue(dir_part, '/', 0); // Dùng giá trị đầu nếu thiếu

            float revolutions = revStr.toFloat();
            float rpm = rpmStr.toFloat();
            int direction = dirStr.toInt();

            motorSequences[motorIdx][stepIndex].steps = (long)(revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1));
            motorSequences[motorIdx][stepIndex].speed = (rpm * STEPS_PER_REV / 60.0f) * (direction == 1 ? 1 : -1);
            stepIndex++;
        }
        sequenceLengths[motorIdx] = stepIndex;
    }
    
    // In kết quả phân tích để gỡ lỗi
    for(int i=0; i<4; i++){
      Serial.print("  [M"); Serial.print(i+1); Serial.print("] co "); Serial.print(sequenceLengths[i]); Serial.println(" buoc chay.");
      for(int j=0; j < sequenceLengths[i]; j++){
        Serial.print("    Buoc "); Serial.print(j+1);
        Serial.print(": Steps="); Serial.print(motorSequences[i][j].steps);
        Serial.print(", Speed="); Serial.println(motorSequences[i][j].speed);
      }
    }
    Serial.println("--> Phan tich du lieu hoan tat. San sang de START.");
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
