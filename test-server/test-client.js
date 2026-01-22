// test-client.js
// 서버 테스트를 위한 간단한 TCP 클라이언트
// 사용법: node test-client.js

const net = require('net');
const readline = require('readline');

const SERVER_IP = '127.0.0.1';
const SERVER_PORT = 12793;

// 터미널 입력을 위한 인터페이스
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 서버에 연결
const client = new net.Socket();

client.connect(SERVER_PORT, SERVER_IP, () => {
    console.log('✅ Connected to server!');
    console.log('Type your message and press Enter. Type "quit" to exit.\n');
    promptUser();
});

// 서버로부터 데이터 수신
client.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`\n📥 Received: ${message}`);
    promptUser();
});

// 연결 종료
client.on('close', () => {
    console.log('\n👋 Connection closed');
    process.exit(0);
});

// 에러 처리
client.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

// 사용자 입력 대기
function promptUser() {
    rl.question('> ', (input) => {
        const message = input.trim();
        
        if (message.toLowerCase() === 'quit') {
            client.end();
            rl.close();
            return;
        }
        
        if (message) {
            client.write(message + '\n');
            console.log(`📤 Sent: ${message}`);
        }
        
        promptUser();
    });
}