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

    // --- UI State Update Function ---
    function updateUIState(isBusy = false) {
        connectButton.textContent = isConnected ? 'Disconnect' : 'Connect';
        
        if (isBusy) {
             allButtons.forEach(btn => btn.disabled = true);
        } else {
             connectButton.disabled = false;
             actionButtons.forEach(btn => btn.disabled = !isConnected);
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
            updateUIState(true); // Lock UI
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
            updateUIState(false); // Unlock UI
        }
    }

    function onDisconnected() {
        setNotification('Đã mất kết nối Bluetooth.', true);
        isConnected = false;
        bluetoothDevice = null;
        txCharacteristic = null;
        updateUIState(false);
    }

    async function handleDisconnect() {
        if (!bluetoothDevice) return;
        try {
            updateUIState(true);
            setNotification('Đang ngắt kết nối...');
            await bluetoothDevice.gatt.disconnect();
        } catch (error) {
            let errorMessage = 'Ngắt kết nối thất bại.';
             if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
            // onDisconnected will be called automatically
        }
    }


    async function sendBleCommand(command: string) {
        if (!isConnected || !txCharacteristic) {
            setNotification('Lỗi: Chưa sẵn sàng để gửi lệnh.', true);
            return;
        }

        updateUIState(true); // Lock UI
        
        try {
            setNotification(`Đang gửi: ${command.substring(0, 30)}...`);
            const encoder = new TextEncoder();
            await txCharacteristic.writeValue(encoder.encode(command + '\n')); // Append newline
            setNotification(`Đã gửi thành công: ${command.substring(0, 30)}`, false);
        } catch (error) {
            let errorMessage = 'Gửi lệnh thất bại.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification(errorMessage, true);
        } finally {
            // Wait a bit before allowing new commands to prevent merging
            setTimeout(() => {
                updateUIState(false); // Unlock UI
            }, 200); 
        }
    }
    
    function handleSend() {
        // This function combines steps from different inputs into a single sequence for each motor.
        // Format: V1,VP1,D1|V2,VP2,D2;...
        let dataString = '';
        for (let i = 1; i <= 4; i++) {
            const v_input = (document.getElementById(`m${i}-v`) as HTMLInputElement).value || "0";
            const vp_input = (document.getElementById(`m${i}-vp`) as HTMLInputElement).value || "0";
            const dir_input = (document.getElementById(`m${i}-dir`) as HTMLInputElement).value || "0";

            const revs = v_input.split('/');
            const rpms = vp_input.split('/');
            const dirs = dir_input.split('/');

            let motorSequence = [];
            const stepCount = revs.length;

            for (let j = 0; j < stepCount; j++) {
                const rev = revs[j] || '0';
                // Use the first value if subsequent ones are missing
                const rpm = rpms[j] || rpms[0] || '0'; 
                const dir = dirs[j] || dirs[0] || '0';
                if (rev !== '0') { // Only add steps that have movement
                    motorSequence.push(`${rev},${rpm},${dir}`);
                }
            }
            dataString += motorSequence.join('|');
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
                <li><b>Sửa lỗi nghiêm trọng:</b> Đã sửa lỗi đọc ký tự xuống dòng (<code>'\\n' -> '\\n'</code>), đảm bảo Arduino nhận lệnh chính xác.</li>
                <li><b>Chống nhiễu:</b> Tự động xóa các dữ liệu "rác" từ module Bluetooth khi khởi động.</li>
                <li><b>Phân tích dữ liệu mạnh mẽ:</b> Thuật toán mới, phân tích chính xác chuỗi dữ liệu phức tạp cho cả 4 motor.</li>
                <li><b>Tốc độ chính xác:</b> Đọc dữ liệu mà không làm chậm hệ thống, đảm bảo motor chạy đúng tốc độ bạn nhập.</li>
                 <li><b>An toàn dữ liệu:</b> Luôn xóa sạch dữ liệu cũ trước khi nhận lệnh mới.</li>
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

// --- Khai báo các motor ---
AccelStepper stepper1(MotorInterfaceType, 2, 3);
AccelStepper stepper2(MotorInterfaceType, 4, 5);
AccelStepper stepper3(MotorInterfaceType, 6, 7);
AccelStepper stepper4(MotorInterfaceType, 8, 9);
AccelStepper* steppers[] = {&stepper1, &stepper2, &stepper3, &stepper4};

// --- Bluetooth ---
SoftwareSerial bleSerial(10, 11); // RX, TX

// --- Cấu hình ---
const long STEPS_PER_REV = 3200; 
const int MAX_SEQUENCE_STEPS = 15; // Tăng số bước cho phép
String inputBuffer = "";
bool commandReady = false;

// --- Cấu trúc dữ liệu ---
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

// --- SETUP ---
void setup() {
  Serial.begin(9600);
  bleSerial.begin(9600);
  inputBuffer.reserve(256); 
  
  // Xóa bộ đệm Bluetooth để loại bỏ nhiễu khi khởi động
  delay(100); // Chờ module ổn định
  while(bleSerial.available()) bleSerial.read();

  for (int i = 0; i < 4; i++) {
    steppers[i]->setMaxSpeed(8000); 
    steppers[i]->setAcceleration(2000);
  }
  Serial.println("Arduino san sang. Phien ban hoan chinh.");
}

// --- MAIN LOOP ---
void loop() {
  readBluetooth(); // Luôn đọc dữ liệu mà không làm chậm loop

  if (commandReady) {
    inputBuffer.trim();
    parseCommand(inputBuffer);
    inputBuffer = ""; // Xóa buffer sau khi xử lý
    commandReady = false;
  }

  if (isRunning) {
    bool anyMotorStillMoving = false;
    for (int i = 0; i < 4; i++) {
        // Nếu motor đã chạy xong bước hiện tại, nạp bước tiếp theo
        if (steppers[i]->distanceToGo() == 0) {
            loadNextStepForMotor(i);
        }
        // Nếu motor vẫn còn quãng đường để đi, tiếp tục chạy
        if (steppers[i]->distanceToGo() != 0) {
            anyMotorStillMoving = true;
            steppers[i]->run();
        }
    }
    
    // Nếu không còn motor nào cần chạy nữa, dừng lại
    if (!anyMotorStillMoving) {
        isRunning = false;
        Serial.println("!!! HOAN THANH TAT CA CHUOI LENH !!!");
    }
  }
}

// --- Các hàm chức năng ---

void readBluetooth() {
    while (bleSerial.available()) {
        char c = bleSerial.read();
        // SỬA LỖI QUAN TRỌNG NHẤT: '\n' thay vì '\\n'
        if (c == '\n') { 
            commandReady = true;
            return; // Thoát ngay khi tìm thấy lệnh hoàn chỉnh
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
    isRunning = true;
    Serial.println("!!! BAT DAU CHAY !!!");
}

void loadNextStepForMotor(int motorIndex) {
    if (currentStepIndex[motorIndex] >= sequenceLengths[motorIndex]) {
        return; // Hết bước chạy cho motor này
    }

    MotorStep next = motorSequences[motorIndex][currentStepIndex[motorIndex]];
    
    // Chỉ nạp lệnh nếu có bước chạy thực sự
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
    // XÓA SẠCH DỮ LIỆU CŨ ĐỂ ĐẢM BẢO AN TOÀN
    for(int i = 0; i < 4; i++) {
      sequenceLengths[i] = 0;
      for(int j = 0; j < MAX_SEQUENCE_STEPS; j++) {
        motorSequences[i][j] = {0, 0.0};
      }
    }

    // --- THUẬT TOÁN PHÂN TÍCH MỚI, MẠNH MẼ ---
    int lastMotorDelim = -1;
    for (int motorIdx = 0; motorIdx < 4; motorIdx++) {
        int currentMotorDelim = data.indexOf(';', lastMotorDelim + 1);
        if (currentMotorDelim == -1 && motorIdx < 3) {
           // Nếu không tìm thấy ';' và chưa phải motor cuối, có thể là cuối chuỗi
           currentMotorDelim = data.length();
        } else if (motorIdx == 3) {
           currentMotorDelim = data.length();
        }

        String motorPart = data.substring(lastMotorDelim + 1, currentMotorDelim);
        lastMotorDelim = currentMotorDelim;
        if (motorPart.length() == 0) continue;

        int stepIndex = 0;
        int lastStepDelim = -1;
        while(stepIndex < MAX_SEQUENCE_STEPS) {
            int currentStepDelim = motorPart.indexOf('|', lastStepDelim + 1);
            if (currentStepDelim == -1) {
                currentStepDelim = motorPart.length();
            }
            
            String stepPart = motorPart.substring(lastStepDelim + 1, currentStepDelim);
            lastStepDelim = currentStepDelim;

            if(stepPart.length() > 0) {
                String revStr = getValue(stepPart, ',', 0);
                String rpmStr = getValue(stepPart, ',', 1);
                String dirStr = getValue(stepPart, ',', 2);
                
                float revolutions = revStr.toFloat();
                float rpm = rpmStr.toFloat();
                int direction = dirStr.toInt();

                motorSequences[motorIdx][stepIndex].steps = (long)(revolutions * STEPS_PER_REV * (direction == 1 ? 1 : -1));
                motorSequences[motorIdx][stepIndex].speed = (rpm * STEPS_PER_REV / 60.0f) * (direction == 1 ? 1 : -1);
                stepIndex++;
            }
            if(lastStepDelim == motorPart.length()) break;
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
