const net = require('net');

// 연결된 클라이언트 관리
const clients = new Map();
let clientIdCounter = 0;

// 서버 설정
const PORT = 12793;
const HOST = '0.0.0.0';

const server = net.createServer((socket) => {
    // 클라이언트에 고유 ID 부여
    const clientId = ++clientIdCounter;
    clients.set(clientId, socket);
    
    console.log(`[${new Date().toISOString()}] ✅ Client ${clientId} connected from ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`   Total clients: ${clients.size}`);
    
    // 클라이언트에게 환영 메시지 전송
    socket.write(`Welcome! You are Client ${clientId}\n`);
    
    // 데이터 수신 이벤트
    socket.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`[${new Date().toISOString()}] 📨 Client ${clientId}: ${message}`);
        
        // 다른 모든 클라이언트에게 브로드캐스트
        let broadcastCount = 0;
        clients.forEach((client, id) => {
            if (id !== clientId && !client.destroyed) {
                try {
                    client.write(`[Client ${clientId}]: ${message}\n`);
                    broadcastCount++;
                } catch (err) {
                    console.error(`❌ Failed to send to Client ${id}:`, err.message);
                }
            }
        });
        
        // 에코백 (자신에게도 확인 메시지 전송)
        socket.write(`✓ Message sent to ${broadcastCount} client(s)\n`);
    });
    
    // 연결 종료 이벤트
    socket.on('end', () => {
        console.log(`[${new Date().toISOString()}] 👋 Client ${clientId} disconnected gracefully`);
        clients.delete(clientId);
        console.log(`   Remaining clients: ${clients.size}`);
    });
    
    // 에러 처리
    socket.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ Client ${clientId} error:`, err.message);
        clients.delete(clientId);
    });
    
    // 타임아웃 설정 (선택사항 - 30초)
    socket.setTimeout(30000);
    socket.on('timeout', () => {
        console.log(`[${new Date().toISOString()}] ⏰ Client ${clientId} timeout`);
        socket.end();
    });
});

// 서버 에러 처리
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close other instances or use a different port.`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});

// 서버 시작
server.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🚀 Cross-Engine TCP Server Started');
    console.log('='.repeat(60));
    console.log(`📍 Address: ${HOST}:${PORT}`);
    console.log(`🕒 Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('💡 Waiting for connections from Unreal and Unity...');
    console.log('   Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down server...');
    
    // 모든 클라이언트에게 종료 메시지 전송
    clients.forEach((client, id) => {
        try {
            client.write('Server is shutting down. Goodbye!\n');
            client.end();
        } catch (err) {
            // Ignore errors during shutdown
        }
    });
    
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
    
    // 강제 종료 (5초 후)
    setTimeout(() => {
        console.error('⚠️  Forced shutdown');
        process.exit(1);
    }, 5000);
});