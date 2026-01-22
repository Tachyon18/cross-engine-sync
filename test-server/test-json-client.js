// test-json-client.js
// Week 2 JSON 메시지 테스트 클라이언트
// 사용법: node test-json-client.js

const net = require('net');
const readline = require('readline');

const SERVER_IP = '127.0.0.1';
const SERVER_PORT = 12793;
const CLIENT_ID = 'test_client';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const client = new net.Socket();
let messageBuffer = '';

// 서버 연결
client.connect(SERVER_PORT, SERVER_IP, () => {
    console.log('✅ Connected to JSON server!\n');
    showHelp();
    promptUser();
});

// 데이터 수신
client.on('data', (data) => {
    messageBuffer += data.toString();
    
    const messages = messageBuffer.split('\n');
    messageBuffer = messages.pop();  // 마지막 불완전한 메시지 보관
    
    messages.forEach(msg => {
        if (msg.trim()) {
            try {
                const jsonMsg = JSON.parse(msg);
                console.log(`\n📥 Received [${jsonMsg.type}]:`);
                console.log(JSON.stringify(jsonMsg, null, 2));
            } catch (err) {
                console.log(`\n📥 Received: ${msg}`);
            }
        }
    });
    
    promptUser();
});

client.on('close', () => {
    console.log('\n👋 Connection closed');
    process.exit(0);
});

client.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

// 도움말
function showHelp() {
    console.log('━'.repeat(70));
    console.log('📚 Available Commands:');
    console.log('━'.repeat(70));
    console.log('  pos <id> <x> <y> <z>     - Send position update');
    console.log('                             Example: pos cube_001 10 5 3');
    console.log('');
    console.log('  color <id> <r> <g> <b>   - Send color change');
    console.log('                             Example: color cube_001 255 0 0');
    console.log('');
    console.log('  chat <message>           - Send chat message');
    console.log('                             Example: chat Hello World!');
    console.log('');
    console.log('  spawn <id> <type>        - Spawn object');
    console.log('                             Example: spawn cube_002 cube');
    console.log('');
    console.log('  destroy <id>             - Destroy object');
    console.log('                             Example: destroy cube_001');
    console.log('');
    console.log('  help                     - Show this help');
    console.log('  quit                     - Exit');
    console.log('━'.repeat(70));
    console.log('');
}

// 메시지 전송 헬퍼
function sendMessage(type, data) {
    const message = {
        type: type,
        timestamp: Date.now(),
        clientId: CLIENT_ID,
        data: data
    };
    
    const jsonString = JSON.stringify(message) + '\n';
    client.write(jsonString);
    
    console.log(`📤 Sent [${type}]:`);
    console.log(JSON.stringify(message, null, 2));
}

// 명령어 처리
function processCommand(input) {
    const parts = input.trim().split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case 'pos':
        case 'position':
            if (parts.length >= 5) {
                sendMessage('position_update', {
                    objectId: parts[1],
                    position: {
                        x: parseFloat(parts[2]),
                        y: parseFloat(parts[3]),
                        z: parseFloat(parts[4])
                    },
                    rotation: { x: 0, y: 0, z: 0 }
                });
            } else {
                console.log('❌ Usage: pos <id> <x> <y> <z>');
            }
            break;
            
        case 'color':
            if (parts.length >= 5) {
                sendMessage('color_change', {
                    objectId: parts[1],
                    color: {
                        r: parseInt(parts[2]),
                        g: parseInt(parts[3]),
                        b: parseInt(parts[4]),
                        a: 255
                    }
                });
            } else {
                console.log('❌ Usage: color <id> <r> <g> <b>');
            }
            break;
            
        case 'chat':
            if (parts.length >= 2) {
                const message = parts.slice(1).join(' ');
                sendMessage('chat_message', {
                    message: message
                });
            } else {
                console.log('❌ Usage: chat <message>');
            }
            break;
            
        case 'spawn':
            if (parts.length >= 3) {
                sendMessage('spawn_object', {
                    objectId: parts[1],
                    objectType: parts[2],
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    color: { r: 255, g: 255, b: 255, a: 255 }
                });
            } else {
                console.log('❌ Usage: spawn <id> <type>');
            }
            break;
            
        case 'destroy':
            if (parts.length >= 2) {
                sendMessage('destroy_object', {
                    objectId: parts[1]
                });
            } else {
                console.log('❌ Usage: destroy <id>');
            }
            break;
            
        case 'help':
        case '?':
            showHelp();
            break;
            
        case 'quit':
        case 'exit':
            client.end();
            rl.close();
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