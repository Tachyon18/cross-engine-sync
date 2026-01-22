// test-udp-client.js
// Week 3: UDP 테스트 클라이언트
// 사용법: node test-udp-client.js

const dgram = require('dgram');
const readline = require('readline');

const SERVER_IP = '127.0.0.1';
const SERVER_PORT = 12794;
const CLIENT_ID = 'test_udp_client';

const socket = dgram.createSocket('udp4');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('═'.repeat(70));
console.log('🚀 UDP Test Client');
console.log('═'.repeat(70));
console.log(`📍 Server: ${SERVER_IP}:${SERVER_PORT}`);
console.log('═'.repeat(70));
console.log('');
showHelp();

// 서버로부터 메시지 수신
socket.on('message', (msg, rinfo) => {
    try {
        const message = JSON.parse(msg.toString());
        console.log(`\n📥 Received from ${rinfo.address}:${rinfo.port}:`);
        console.log(JSON.stringify(message, null, 2));
    } catch (err) {
        console.log(`\n📥 Received: ${msg.toString()}`);
    }
    promptUser();
});

socket.on('error', (err) => {
    console.error('❌ Socket error:', err.message);
    process.exit(1);
});

// 도움말
function showHelp() {
    console.log('📚 Available Commands:');
    console.log('━'.repeat(70));
    console.log('  pos <id> <x> <y> <z>     - Send position update (fast!)');
    console.log('                             Example: pos cube_001 10 5 3');
    console.log('');
    console.log('  spam <id> <count>        - Send multiple position updates');
    console.log('                             Example: spam cube_001 100');
    console.log('');
    console.log('  auto <id> <duration>     - Auto-send positions (seconds)');
    console.log('                             Example: auto cube_001 10');
    console.log('');
    console.log('  help                     - Show this help');
    console.log('  quit                     - Exit');
    console.log('━'.repeat(70));
    console.log('');
}

// 메시지 전송
function sendMessage(type, data) {
    const message = {
        type: type,
        timestamp: Date.now(),
        clientId: CLIENT_ID,
        data: data
    };
    
    const jsonString = JSON.stringify(message);
    const buffer = Buffer.from(jsonString);
    
    socket.send(buffer, SERVER_PORT, SERVER_IP, (err) => {
        if (err) {
            console.error('❌ Send error:', err.message);
        }
    });
    
    return message;
}

// 랜덤 위치 생성
function randomPosition() {
    return {
        x: parseFloat((Math.random() * 20 - 10).toFixed(2)),
        y: parseFloat((Math.random() * 10).toFixed(2)),
        z: parseFloat((Math.random() * 20 - 10).toFixed(2))
    };
}

// 명령어 처리
function processCommand(input) {
    const parts = input.trim().split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case 'pos':
        case 'position':
            if (parts.length >= 5) {
                const msg = sendMessage('position_update', {
                    objectId: parts[1],
                    position: {
                        x: parseFloat(parts[2]),
                        y: parseFloat(parts[3]),
                        z: parseFloat(parts[4])
                    },
                    rotation: { x: 0, y: 0, z: 0 }
                });
                console.log(`📤 Sent position for ${parts[1]}`);
            } else {
                console.log('❌ Usage: pos <id> <x> <y> <z>');
            }
            break;
            
        case 'spam':
            if (parts.length >= 3) {
                const objectId = parts[1];
                const count = parseInt(parts[2]);
                
                console.log(`📤 Sending ${count} position updates...`);
                const startTime = Date.now();
                
                for (let i = 0; i < count; i++) {
                    sendMessage('position_update', {
                        objectId: objectId,
                        position: randomPosition(),
                        rotation: { x: 0, y: 0, z: 0 }
                    });
                }
                
                const duration = Date.now() - startTime;
                const rate = (count / duration * 1000).toFixed(0);
                console.log(`✅ Sent ${count} messages in ${duration}ms (${rate} msg/s)`);
            } else {
                console.log('❌ Usage: spam <id> <count>');
            }
            break;
            
        case 'auto':
            if (parts.length >= 3) {
                const objectId = parts[1];
                const duration = parseInt(parts[2]) * 1000;
                
                console.log(`🔄 Auto-sending positions for ${duration/1000} seconds...`);
                let count = 0;
                const startTime = Date.now();
                
                const interval = setInterval(() => {
                    if (Date.now() - startTime >= duration) {
                        clearInterval(interval);
                        const actualDuration = (Date.now() - startTime) / 1000;
                        const rate = (count / actualDuration).toFixed(1);
                        console.log(`✅ Sent ${count} messages in ${actualDuration.toFixed(1)}s (${rate} msg/s)`);
                        promptUser();
                        return;
                    }
                    
                    sendMessage('position_update', {
                        objectId: objectId,
                        position: randomPosition(),
                        rotation: { x: 0, y: 0, z: 0 }
                    });
                    count++;
                }, 50); // 20 messages per second
                
                return; // Don't prompt immediately
            } else {
                console.log('❌ Usage: auto <id> <duration_seconds>');
            }
            break;
            
        case 'help':
        case '?':
            showHelp();
            break;
            
        case 'quit':
        case 'exit':
            socket.close();
            rl.close();
            process.exit(0);
            return;
            
        default:
            console.log(`❌ Unknown command: ${command}`);
            console.log('   Type "help" for available commands');
            break;
    }
    
    promptUser();
}

// 사용자 입력 대기
function promptUser() {
    rl.question('\n> ', (input) => {
        if (input.trim()) {
            processCommand(input);
        } else {
            promptUser();
        }
    });
}

// 초기 연결 테스트
console.log('🔌 Sending initial connection message...');
sendMessage('client_connect', {
    clientType: 'udp_test_client',
    version: '3.0'
});

setTimeout(() => {
    console.log('✅ Ready! Type commands...\n');
    promptUser();
}, 500);