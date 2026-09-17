const net = require('net');
const readline = require('readline');

// ============================================
// 🎛️ 로그 설정 시스템
// ============================================

const LogLevel = {
    NONE: 0,      // 로그 없음
    ERROR: 1,     // 오류만
    WARN: 2,      // 경고 이상
    INFO: 3,      // 일반 정보
    DEBUG: 4,     // 디버그 정보
    TRACE: 5      // 모든 메시지 (position_update 포함)
};

const LogConfig = {
    // 현재 로그 레벨
    level: LogLevel.INFO,
    
    // 메시지 타입별 필터링
    filters: {
        position_update: false,   // 기본적으로 위치 업데이트는 숨김
        color_change: true,
        chat_message: true,
        connection: true,
        error: true
    },
    
    // 통계 표시
    showStats: true,
    statsInterval: 5000,  // 5초마다 통계 표시
    
    // 타임스탬프 표시
    showTimestamp: false,
    
    // 색상 표시
    useColors: true
};

// ============================================
// 🎨 색상 출력 (선택적)
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
    if (!LogConfig.useColors) return text;
    return `${color}${text}${Colors.reset}`;
}

// ============================================
// 📊 통계 시스템
// ============================================

const Stats = {
    connections: 0,
    totalMessages: 0,
    messagesByType: {
        position_update: 0,
        color_change: 0,
        chat_message: 0,
        unknown: 0
    },
    messagesPerSecond: 0,
    lastMessageCount: 0,
    startTime: Date.now()
};

// ============================================
// 📝 로깅 시스템
// ============================================

function log(level, type, message, data = null) {
    // 레벨 체크
    if (level > LogConfig.level) return;
    
    // 타입 필터링
    if (type && LogConfig.filters[type] === false) return;
    
    // 타임스탬프
    let output = '';
    if (LogConfig.showTimestamp) {
        const time = new Date().toLocaleTimeString();
        output += colorize(`[${time}] `, Colors.gray);
    }
    
    // 레벨 표시
    const levelStr = {
        [LogLevel.ERROR]: colorize('ERROR', Colors.red),
        [LogLevel.WARN]: colorize('WARN', Colors.yellow),
        [LogLevel.INFO]: colorize('INFO', Colors.green),
        [LogLevel.DEBUG]: colorize('DEBUG', Colors.cyan),
        [LogLevel.TRACE]: colorize('TRACE', Colors.gray)
    }[level] || 'LOG';
    
    output += `[${levelStr}] `;
    
    // 타입 표시
    if (type) {
        const typeColor = {
            position_update: Colors.gray,
            color_change: Colors.magenta,
            chat_message: Colors.cyan,
            connection: Colors.green,
            error: Colors.red
        }[type] || Colors.reset;
        
        output += colorize(`[${type}]`, typeColor) + ' ';
    }
    
    // 메시지
    output += message;
    
    // 추가 데이터
    if (data && LogConfig.level >= LogLevel.DEBUG) {
        output += '\n' + colorize(JSON.stringify(data, null, 2), Colors.gray);
    }
    
    console.log(output);
}

// 편의 함수들
const logger = {
    error: (msg, data) => log(LogLevel.ERROR, 'error', msg, data),
    warn: (msg, data) => log(LogLevel.WARN, null, msg, data),
    info: (msg, data) => log(LogLevel.INFO, null, msg, data),
    debug: (msg, data) => log(LogLevel.DEBUG, null, msg, data),
    trace: (msg, data) => log(LogLevel.TRACE, null, msg, data),
    
    // 메시지 타입별
    position: (msg, data) => log(LogLevel.TRACE, 'position_update', msg, data),
    color: (msg, data) => log(LogLevel.INFO, 'color_change', msg, data),
    chat: (msg, data) => log(LogLevel.INFO, 'chat_message', msg, data),
    connection: (msg, data) => log(LogLevel.INFO, 'connection', msg, data)
};

// ============================================
// 📈 통계 표시
// ============================================

function printStats() {
    if (!LogConfig.showStats) return;
    
    const uptime = Math.floor((Date.now() - Stats.startTime) / 1000);
    const avgMsgPerSec = (Stats.totalMessages / uptime).toFixed(1);
    
    console.log('\n' + colorize('='.repeat(60), Colors.cyan));
    console.log(colorize('📊 서버 통계', Colors.bright));
    console.log(colorize('='.repeat(60), Colors.cyan));
    console.log(`⏱️  가동 시간: ${uptime}초`);
    console.log(`👥 현재 연결: ${Stats.connections}`);
    console.log(`📨 총 메시지: ${Stats.totalMessages}`);
    console.log(`⚡ 평균 처리량: ${avgMsgPerSec} msg/s`);
    console.log(`📊 최근 처리량: ${Stats.messagesPerSecond} msg/s`);
    console.log('\n메시지 타입별:');
    console.log(`  📍 위치 업데이트: ${Stats.messagesByType.position_update}`);
    console.log(`  🎨 색상 변경: ${Stats.messagesByType.color_change}`);
    console.log(`  💬 채팅: ${Stats.messagesByType.chat_message}`);
    console.log(`  ❓ 기타: ${Stats.messagesByType.unknown}`);
    console.log(colorize('='.repeat(60), Colors.cyan) + '\n');
}

// 통계 업데이트
setInterval(() => {
    Stats.messagesPerSecond = Stats.totalMessages - Stats.lastMessageCount;
    Stats.lastMessageCount = Stats.totalMessages;
    printStats();
}, LogConfig.statsInterval);

// ============================================
// 🖥️ CLI 명령어 시스템
// ============================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize('server> ', Colors.green)
});

function printHelp() {
    console.log('\n' + colorize('📚 사용 가능한 명령어:', Colors.cyan));
    console.log('  help              - 이 도움말 표시');
    console.log('  stats             - 현재 통계 표시');
    console.log('  level <0-5>       - 로그 레벨 변경 (0=NONE, 5=TRACE)');
    console.log('  filter <type> <on|off>  - 메시지 타입 필터링');
    console.log('  colors <on|off>   - 색상 표시 토글');
    console.log('  timestamp <on|off> - 타임스탬프 토글');
    console.log('  clear             - 화면 지우기');
    console.log('  clients           - 연결된 클라이언트 목록');
    console.log('  broadcast <msg>   - 모든 클라이언트에게 채팅 전송');
    console.log('  quit              - 서버 종료\n');
}

function handleCommand(cmd) {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case 'help':
        case '?':
            printHelp();
            break;
            
        case 'stats':
            printStats();
            break;
            
        case 'level':
            const level = parseInt(parts[1]);
            if (level >= 0 && level <= 5) {
                LogConfig.level = level;
                const levelNames = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
                logger.info(`로그 레벨 변경: ${levelNames[level]}`);
            } else {
                logger.warn('유효한 레벨: 0(NONE) ~ 5(TRACE)');
            }
            break;
            
        case 'filter':
            const filterType = parts[1];
            const filterValue = parts[2] === 'on';
            if (LogConfig.filters.hasOwnProperty(filterType)) {
                LogConfig.filters[filterType] = filterValue;
                logger.info(`필터 ${filterType}: ${filterValue ? 'ON' : 'OFF'}`);
            } else {
                logger.warn(`알 수 없는 필터: ${filterType}`);
                logger.info(`사용 가능: ${Object.keys(LogConfig.filters).join(', ')}`);
            }
            break;
            
        case 'colors':
            LogConfig.useColors = parts[1] === 'on';
            logger.info(`색상 표시: ${LogConfig.useColors ? 'ON' : 'OFF'}`);
            break;
            
        case 'timestamp':
            LogConfig.showTimestamp = parts[1] === 'on';
            logger.info(`타임스탬프: ${LogConfig.showTimestamp ? 'ON' : 'OFF'}`);
            break;
            
        case 'clear':
            console.clear();
            break;
            
        case 'clients':
            logger.info(`연결된 클라이언트: ${clients.length}개`);
            clients.forEach((client, i) => {
                console.log(`  ${i + 1}. ${client.remoteAddress}:${client.remotePort}`);
            });
            break;
            
        case 'broadcast':
            const message = parts.slice(1).join(' ');
            if (message) {
                broadcastMessage({
                    type: 'chat_message',
                    objectId: 'SERVER',
                    content: message,
                    timestamp: Date.now()
                });
                logger.chat(`서버 브로드캐스트: ${message}`);
            }
            break;
            
        case 'quit':
        case 'exit':
            logger.info('서버 종료 중...');
            process.exit(0);
            break;
            
        default:
            if (cmd.trim()) {
                logger.warn(`알 수 없는 명령어: ${command}`);
                console.log('help를 입력하여 사용 가능한 명령어를 확인하세요.');
            }
    }
    
    rl.prompt();
}

// ============================================
// 🔧 메시지 구조 정규화 함수
// ============================================
// 두 가지 메시지 구조를 모두 지원:
// 1. 평면 구조 (NetworkTestObject): { type, objectId, r, g, b }
// 2. 중첩 구조 (TCPClientJSON): { type, data: { objectId, color: { r, g, b } } }

function normalizeMessage(message) {
    // 평면 구조면 그대로 반환
    if (!message.data) {
        return message;
    }
    
    // 중첩 구조를 평면 구조로 변환
    let normalized = {
        type: message.type,
        timestamp: message.timestamp || Date.now(),
        objectId: message.data?.objectId || message.clientId || 'unknown',
    };
    
    // position_update 처리
    if (message.data.position) {
        normalized.x = message.data.position.x;
        normalized.y = message.data.position.y;
        normalized.z = message.data.position.z;
    }
    
    // color_change 처리 (0-255 → 0-1 변환)
    if (message.data.color) {
        // Color32 (0-255) → Color (0-1)
        normalized.r = message.data.color.r / 255;
        normalized.g = message.data.color.g / 255;
        normalized.b = message.data.color.b / 255;
    }
    
    // chat_message 처리
    if (message.data.message) {
        normalized.content = message.data.message;
    }
    
    return normalized;
}


// ============================================
// 🌐 TCP 서버 (기존 로직)
// ============================================

const PORT = 12793;
const clients = [];

function broadcastMessage(message, sender) {

    const normalizedMsg = normalizeMessage(message);

    const json = JSON.stringify(normalizedMsg);
    const data = Buffer.from(json + '\n');
    
    // 통계 업데이트
    Stats.totalMessages++;
    const msgType = normalizedMsg.type || 'unknown';
    Stats.messagesByType[msgType] = (Stats.messagesByType[msgType] || 0) + 1;
    
    // 로깅
    switch (msgType) {
        case 'position_update':
            console.log(`[${msgType}] ${normalizedMsg.objectId} -> (${normalizedMsg.x?.toFixed(2)}, ${normalizedMsg.y?.toFixed(2)}, ${normalizedMsg.z?.toFixed(2)})`);
            break;
        case 'color_change':
            console.log(`[${msgType}] ${normalizedMsg.objectId} -> RGB(${normalizedMsg.r?.toFixed(2)}, ${normalizedMsg.g?.toFixed(2)}, ${normalizedMsg.b?.toFixed(2)})`);
            break;
        case 'chat_message':
            console.log(`[${msgType}] ${normalizedMsg.objectId}: ${normalizedMsg.content}`);
            break;
        default:
            console.log(`[${msgType}] ${normalizedMsg.objectId}`);
    }
    
    // 브로드캐스트 (송신자 제외)
    clients.forEach(client => {
        if (client !== sender && client.writable) {
            client.write(data);
        }
    });
}

const server = net.createServer((socket) => {
    Stats.connections++;
    clients.push(socket);
    
    logger.connection(`새 클라이언트 연결: ${socket.remoteAddress}:${socket.remotePort}`);
    logger.info(`현재 연결: ${clients.length}개`);
    
    let buffer = '';
    
    socket.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const messageStr = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            try {
                const message = JSON.parse(messageStr);
                broadcastMessage(message, socket);
            } catch (e) {
                logger.error('JSON 파싱 오류', { message: messageStr, error: e.message });
            }
        }
    });
    
    socket.on('end', () => {
        const index = clients.indexOf(socket);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        Stats.connections--;
        logger.connection(`클라이언트 연결 해제: ${socket.remoteAddress}:${socket.remotePort}`);
        logger.info(`현재 연결: ${clients.length}개`);
    });
    
    socket.on('error', (err) => {
        logger.error(`소켓 오류: ${err.message}`);
    });
});

// ============================================
// 🚀 서버 시작
// ============================================

server.listen(PORT, () => {
    console.clear();
    console.log(colorize('╔═══════════════════════════════════════════════════════════╗', Colors.cyan));
    console.log(colorize('║       🎮 Week 2 JSON TCP Server (개선 버전)              ║', Colors.bright));
    console.log(colorize('╚═══════════════════════════════════════════════════════════╝', Colors.cyan));
    console.log('');
    logger.info(`서버 시작: 포트 ${PORT}`);
    logger.info(`로그 레벨: ${Object.keys(LogLevel).find(k => LogLevel[k] === LogConfig.level)}`);
    console.log('');
    console.log(colorize('💡 팁:', Colors.yellow));
    console.log('  - "help"를 입력하여 사용 가능한 명령어 확인');
    console.log('  - "level 5"로 모든 메시지 보기 (position_update 포함)');
    console.log('  - "filter position_update on"으로 위치 업데이트 표시');
    console.log('  - "stats"로 현재 통계 확인');
    console.log('');
    console.log('📡 지원하는 메시지 구조:');
    console.log('   1. 평면 구조 (NetworkTestObject)');
    console.log('   2. 중첩 구조 (TCPClientJSON)');
    console.log('');
    console.log('💡 색상 범위 자동 변환: 0-255 → 0-1');
    console.log('');
    console.log('⏳ Waiting for clients...\n');

    rl.prompt();
});

// CLI 입력 처리
rl.on('line', (line) => {
    handleCommand(line);
});

rl.on('close', () => {
    logger.info('CLI 종료');
    process.exit(0);
});

// 프로세스 종료 처리
process.on('SIGINT', () => {
    logger.info('\n서버 종료 중...');
    server.close();
    process.exit(0);
});