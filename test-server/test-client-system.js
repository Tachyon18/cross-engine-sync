const net = require('net');
const readline = require('readline');

// ============================================
// 🎛️ 클라이언트 설정
// ============================================

const Config = {
    host: 'localhost',
    port: 8080,
    objectId: `client_${Math.random().toString(36).substr(2, 9)}`,
    
    // 로그 설정
    showPositionUpdates: false,  // 기본적으로 위치 업데이트는 숨김
    showColorChanges: true,
    showChatMessages: true,
    useColors: true,
    
    // 자동 테스트 설정
    autoTest: false,
    autoTestInterval: 100  // ms
};

// ============================================
// 🎨 색상 출력
// ============================================

const Colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

function colorize(text, color) {
    if (!Config.useColors) return text;
    return `${color}${text}${Colors.reset}`;
}

// ============================================
// 📊 통계
// ============================================

const Stats = {
    sent: 0,
    received: 0,
    byType: {
        position_update: 0,
        color_change: 0,
        chat_message: 0
    }
};

// ============================================
// 🌐 TCP 클라이언트
// ============================================

let client;
let isConnected = false;
let buffer = '';

function connect() {
    client = new net.Socket();
    
    client.connect(Config.port, Config.host, () => {
        isConnected = true;
        console.log(colorize('\n✅ 서버 연결 성공!', Colors.green));
        console.log(colorize(`📋 나의 ID: ${Config.objectId}`, Colors.cyan));
        console.log(colorize('\n명령어를 입력하세요 (help로 도움말)\n', Colors.yellow));
        rl.prompt();
        
        // 연결 알림 메시지
        sendChatMessage(`${Config.objectId} 입장!`);
    });
    
    client.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const messageStr = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            try {
                const message = JSON.parse(messageStr);
                handleMessage(message);
            } catch (e) {
                console.error(colorize('❌ JSON 파싱 오류', Colors.red), messageStr);
            }
        }
    });
    
    client.on('error', (err) => {
        console.error(colorize(`❌ 연결 오류: ${err.message}`, Colors.red));
        isConnected = false;
    });
    
    client.on('close', () => {
        console.log(colorize('\n🔌 서버 연결 해제', Colors.yellow));
        isConnected = false;
    });
}

// ============================================
// 📨 메시지 처리
// ============================================

function handleMessage(message) {
    Stats.received++;
    Stats.byType[message.type] = (Stats.byType[message.type] || 0) + 1;
    
    // 필터링
    if (message.type === 'position_update' && !Config.showPositionUpdates) return;
    if (message.type === 'color_change' && !Config.showColorChanges) return;
    if (message.type === 'chat_message' && !Config.showChatMessages) return;
    
    // 자기 메시지는 표시 안 함
    if (message.objectId === Config.objectId) return;
    
    // 메시지 출력
    const time = new Date().toLocaleTimeString();
    
    switch (message.type) {
        case 'position_update':
            console.log(colorize(`[${time}] 📍 ${message.objectId}`, Colors.gray) + 
                       ` -> (${message.x?.toFixed(2)}, ${message.y?.toFixed(2)}, ${message.z?.toFixed(2)})`);
            break;
            
        case 'color_change':
            console.log(colorize(`[${time}] 🎨 ${message.objectId}`, Colors.magenta) +
                       ` -> RGB(${message.r?.toFixed(2)}, ${message.g?.toFixed(2)}, ${message.b?.toFixed(2)})`);
            break;
            
        case 'chat_message':
            console.log(colorize(`[${time}] 💬 ${message.objectId}:`, Colors.cyan) +
                       ` ${message.content}`);
            break;
    }
    
    rl.prompt();
}

// ============================================
// 📤 메시지 전송
// ============================================

function sendMessage(message) {
    if (!isConnected) {
        console.log(colorize('❌ 서버에 연결되지 않음', Colors.red));
        return;
    }
    
    const json = JSON.stringify(message);
    client.write(json + '\n');
    Stats.sent++;
}

function sendPosition(x, y, z) {
    sendMessage({
        type: 'position_update',
        objectId: Config.objectId,
        x: parseFloat(x),
        y: parseFloat(y),
        z: parseFloat(z),
        timestamp: Date.now()
    });
}

function sendColor(r, g, b) {
    sendMessage({
        type: 'color_change',
        objectId: Config.objectId,
        r: parseFloat(r),
        g: parseFloat(g),
        b: parseFloat(b),
        timestamp: Date.now()
    });
}

function sendChatMessage(content) {
    sendMessage({
        type: 'chat_message',
        objectId: Config.objectId,
        content: content,
        timestamp: Date.now()
    });
}

// ============================================
// 🤖 자동 테스트
// ============================================

let autoTestTimer;

function startAutoTest() {
    if (Config.autoTest) {
        console.log(colorize('⏸️  자동 테스트 중지', Colors.yellow));
        Config.autoTest = false;
        if (autoTestTimer) clearInterval(autoTestTimer);
        return;
    }
    
    Config.autoTest = true;
    console.log(colorize(`▶️  자동 테스트 시작 (${Config.autoTestInterval}ms 간격)`, Colors.green));
    
    let counter = 0;
    autoTestTimer = setInterval(() => {
        if (!isConnected) {
            clearInterval(autoTestTimer);
            Config.autoTest = false;
            return;
        }
        
        // 랜덤 위치 전송
        const x = Math.sin(counter * 0.1) * 10;
        const y = Math.cos(counter * 0.1) * 10;
        const z = (counter % 10);
        
        sendPosition(x, y, z);
        counter++;
    }, Config.autoTestInterval);
}

// ============================================
// 🖥️ CLI 명령어
// ============================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize('> ', Colors.green)
});

function printHelp() {
    console.log('\n' + colorize('📚 사용 가능한 명령어:', Colors.cyan));
    console.log('');
    console.log(colorize('📨 메시지 전송:', Colors.yellow));
    console.log('  pos <x> <y> <z>   - 위치 업데이트 (예: pos 1.5 2.0 3.0)');
    console.log('  color <r> <g> <b> - 색상 변경 (0.0-1.0, 예: color 1 0 0)');
    console.log('  chat <메시지>     - 채팅 메시지');
    console.log('  say <메시지>      - 채팅 메시지 (짧은 버전)');
    console.log('');
    console.log(colorize('🎛️  필터 설정:', Colors.yellow));
    console.log('  show pos          - 위치 업데이트 표시 ON/OFF');
    console.log('  show color        - 색상 변경 표시 ON/OFF');
    console.log('  show chat         - 채팅 표시 ON/OFF');
    console.log('');
    console.log(colorize('🤖 자동 테스트:', Colors.yellow));
    console.log('  auto              - 자동 위치 전송 시작/중지');
    console.log('  interval <ms>     - 자동 테스트 간격 설정');
    console.log('');
    console.log(colorize('📊 정보:', Colors.yellow));
    console.log('  stats             - 통계 표시');
    console.log('  id                - 나의 ID 표시');
    console.log('  clear             - 화면 지우기');
    console.log('  help              - 이 도움말');
    console.log('  quit              - 종료');
    console.log('');
}

function printStats() {
    console.log('\n' + colorize('='.repeat(50), Colors.cyan));
    console.log(colorize('📊 클라이언트 통계', Colors.bright));
    console.log(colorize('='.repeat(50), Colors.cyan));
    console.log(`📋 나의 ID: ${Config.objectId}`);
    console.log(`🔗 연결 상태: ${isConnected ? colorize('연결됨', Colors.green) : colorize('연결 안 됨', Colors.red)}`);
    console.log(`📤 전송: ${Stats.sent}개`);
    console.log(`📥 수신: ${Stats.received}개`);
    console.log('');
    console.log('수신 메시지 타입별:');
    console.log(`  📍 위치 업데이트: ${Stats.byType.position_update || 0}`);
    console.log(`  🎨 색상 변경: ${Stats.byType.color_change || 0}`);
    console.log(`  💬 채팅: ${Stats.byType.chat_message || 0}`);
    console.log('');
    console.log('필터 설정:');
    console.log(`  📍 위치 표시: ${Config.showPositionUpdates ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
    console.log(`  🎨 색상 표시: ${Config.showColorChanges ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
    console.log(`  💬 채팅 표시: ${Config.showChatMessages ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
    console.log(colorize('='.repeat(50), Colors.cyan) + '\n');
}

function handleCommand(line) {
    const parts = line.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
        case 'help':
        case '?':
            printHelp();
            break;
            
        case 'pos':
        case 'position':
            if (parts.length >= 4) {
                sendPosition(parts[1], parts[2], parts[3]);
                console.log(colorize(`📍 위치 전송: (${parts[1]}, ${parts[2]}, ${parts[3]})`, Colors.gray));
            } else {
                console.log(colorize('사용법: pos <x> <y> <z>', Colors.yellow));
            }
            break;
            
        case 'color':
            if (parts.length >= 4) {
                sendColor(parts[1], parts[2], parts[3]);
                console.log(colorize(`🎨 색상 전송: RGB(${parts[1]}, ${parts[2]}, ${parts[3]})`, Colors.magenta));
            } else {
                console.log(colorize('사용법: color <r> <g> <b> (0.0-1.0)', Colors.yellow));
            }
            break;
            
        case 'chat':
        case 'say':
            const message = parts.slice(1).join(' ');
            if (message) {
                sendChatMessage(message);
                console.log(colorize(`💬 채팅 전송: ${message}`, Colors.cyan));
            }
            break;
            
        case 'show':
            const type = parts[1];
            if (type === 'pos' || type === 'position') {
                Config.showPositionUpdates = !Config.showPositionUpdates;
                console.log(`📍 위치 표시: ${Config.showPositionUpdates ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
            } else if (type === 'color') {
                Config.showColorChanges = !Config.showColorChanges;
                console.log(`🎨 색상 표시: ${Config.showColorChanges ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
            } else if (type === 'chat') {
                Config.showChatMessages = !Config.showChatMessages;
                console.log(`💬 채팅 표시: ${Config.showChatMessages ? colorize('ON', Colors.green) : colorize('OFF', Colors.red)}`);
            } else {
                console.log(colorize('사용법: show <pos|color|chat>', Colors.yellow));
            }
            break;
            
        case 'auto':
            startAutoTest();
            break;
            
        case 'interval':
            if (parts[1]) {
                Config.autoTestInterval = parseInt(parts[1]);
                console.log(`⏱️  자동 테스트 간격: ${Config.autoTestInterval}ms`);
                if (Config.autoTest) {
                    console.log(colorize('💡 변경사항은 다음 자동 테스트 시작 시 적용됩니다', Colors.yellow));
                }
            }
            break;
            
        case 'stats':
            printStats();
            break;
            
        case 'id':
            console.log(`📋 나의 ID: ${colorize(Config.objectId, Colors.cyan)}`);
            break;
            
        case 'clear':
            console.clear();
            break;
            
        case 'quit':
        case 'exit':
            console.log(colorize('👋 종료합니다...', Colors.yellow));
            if (isConnected) {
                sendChatMessage(`${Config.objectId} 퇴장!`);
            }
            process.exit(0);
            break;
            
        default:
            if (line.trim()) {
                // 명령어가 아니면 채팅으로 간주
                if (isConnected) {
                    sendChatMessage(line);
                    console.log(colorize(`💬 채팅 전송: ${line}`, Colors.cyan));
                } else {
                    console.log(colorize(`알 수 없는 명령어: ${cmd}`, Colors.red));
                    console.log('help를 입력하여 사용 가능한 명령어를 확인하세요.');
                }
            }
    }
    
    rl.prompt();
}

// ============================================
// 🚀 시작
// ============================================

console.clear();
console.log(colorize('╔═══════════════════════════════════════════════════════════╗', Colors.cyan));
console.log(colorize('║       🎮 JSON TCP 테스트 클라이언트 (개선 버전)          ║', Colors.bright));
console.log(colorize('╚═══════════════════════════════════════════════════════════╝', Colors.cyan));
console.log('');
console.log(colorize(`📡 서버 연결 시도: ${Config.host}:${Config.port}`, Colors.yellow));

connect();

rl.on('line', (line) => {
    handleCommand(line);
});

rl.on('close', () => {
    if (isConnected) {
        sendChatMessage(`${Config.objectId} 퇴장!`);
    }
    process.exit(0);
});

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log(colorize('\n👋 종료합니다...', Colors.yellow));
    if (isConnected) {
        sendChatMessage(`${Config.objectId} 퇴장!`);
    }
    process.exit(0);
});