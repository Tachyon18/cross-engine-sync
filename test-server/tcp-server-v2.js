// Week 2: JSON Message TCP Server
// 구조화된 데이터 전송을 위한 업그레이드된 서버

const net = require('net');

// 연결된 클라이언트 관리
const clients = new Map();
let clientIdCounter = 0;

// 게임 상태 저장 (나중에 웹서버에서도 접근 가능하도록)
const gameState = {
    objects: new Map(),  // objectId -> { position, rotation, color }
    lastUpdate: Date.now()
};

// 서버 설정
const PORT = 12793;
const HOST = '0.0.0.0';

// 메시지 핸들러
const messageHandlers = {
    'position_update': handlePositionUpdate,
    'color_change': handleColorChange,
    'chat_message': handleChatMessage,
    'spawn_object': handleSpawnObject,
    'destroy_object': handleDestroyObject
};

// 위치 업데이트 처리
function handlePositionUpdate(clientId, message) {
    const { objectId, position, rotation } = message.data;
    
    // 게임 상태 업데이트
    if (!gameState.objects.has(objectId)) {
        gameState.objects.set(objectId, {});
    }
    
    const obj = gameState.objects.get(objectId);
    obj.position = position;
    obj.rotation = rotation;
    obj.lastUpdate = Date.now();
    obj.owner = clientId;
    
    console.log(`📍 [Client ${clientId}] Position update: ${objectId} -> (${position.x}, ${position.y}, ${position.z})`);
    
    // 다른 클라이언트에게 브로드캐스트
    broadcastToOthers(clientId, message);
}

// 색상 변경 처리
function handleColorChange(clientId, message) {
    const { objectId, color } = message.data;
    
    if (!gameState.objects.has(objectId)) {
        gameState.objects.set(objectId, {});
    }
    
    const obj = gameState.objects.get(objectId);
    obj.color = color;
    obj.lastUpdate = Date.now();
    
    console.log(`🎨 [Client ${clientId}] Color change: ${objectId} -> RGB(${color.r}, ${color.g}, ${color.b})`);
    
    broadcastToOthers(clientId, message);
}

// 채팅 메시지 처리
function handleChatMessage(clientId, message) {
    console.log(`💬 [Client ${clientId}] Chat: ${message.data.message}`);
    
    // 모든 클라이언트에게 브로드캐스트 (자신 포함)
    broadcastToAll(message);
}

// 오브젝트 생성 처리
function handleSpawnObject(clientId, message) {
    const { objectId, objectType, position, rotation, color } = message.data;
    
    gameState.objects.set(objectId, {
        objectType: objectType || 'cube',
        position: position || { x: 0, y: 0, z: 0 },
        rotation: rotation || { x: 0, y: 0, z: 0 },
        color: color || { r: 255, g: 255, b: 255, a: 255 },
        owner: clientId,
        spawnedAt: Date.now()
    });
    
    console.log(`✨ [Client ${clientId}] Spawned: ${objectId} (${objectType})`);
    
    broadcastToOthers(clientId, message);
}

// 오브젝트 삭제 처리
function handleDestroyObject(clientId, message) {
    const { objectId } = message.data;
    
    if (gameState.objects.has(objectId)) {
        gameState.objects.delete(objectId);
        console.log(`💥 [Client ${clientId}] Destroyed: ${objectId}`);
        
        broadcastToOthers(clientId, message);
    }
}

// 다른 클라이언트에게 브로드캐스트 (자신 제외)
function broadcastToOthers(senderId, message) {
    const jsonString = JSON.stringify(message) + '\n';
    let count = 0;
    
    clients.forEach((client, id) => {
        if (id !== senderId && !client.socket.destroyed) {
            try {
                client.socket.write(jsonString);
                count++;
            } catch (err) {
                console.error(`❌ Failed to send to Client ${id}:`, err.message);
            }
        }
    });
    
    return count;
}

// 모든 클라이언트에게 브로드캐스트 (자신 포함)
function broadcastToAll(message) {
    const jsonString = JSON.stringify(message) + '\n';
    let count = 0;
    
    clients.forEach((client, id) => {
        if (!client.socket.destroyed) {
            try {
                client.socket.write(jsonString);
                count++;
            } catch (err) {
                console.error(`❌ Failed to send to Client ${id}:`, err.message);
            }
        }
    });
    
    return count;
}

// TCP 서버 생성
const server = net.createServer((socket) => {
    const clientId = ++clientIdCounter;
    const clientInfo = {
        id: clientId,
        socket: socket,
        connectedAt: Date.now(),
        messageBuffer: ''  // 불완전한 JSON 메시지 저장용
    };
    
    clients.set(clientId, clientInfo);
    
    console.log(`[${new Date().toISOString()}] ✅ Client ${clientId} connected from ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`   Total clients: ${clients.size}`);
    
    // 환영 메시지 (JSON 형식)
    const welcomeMessage = {
        type: 'server_message',
        timestamp: Date.now(),
        data: {
            message: `Welcome! You are Client ${clientId}`,
            clientId: clientId,
            serverVersion: '2.0'
        }
    };
    socket.write(JSON.stringify(welcomeMessage) + '\n');
    
    // 현재 게임 상태 전송 (새로 접속한 클라이언트에게)
    if (gameState.objects.size > 0) {
        const stateSync = {
            type: 'state_sync',
            timestamp: Date.now(),
            data: {
                objects: Array.from(gameState.objects.entries()).map(([id, obj]) => ({
                    objectId: id,
                    ...obj
                }))
            }
        };
        socket.write(JSON.stringify(stateSync) + '\n');
        console.log(`📦 Sent ${gameState.objects.size} objects to Client ${clientId}`);
    }
    
    // 데이터 수신 처리
    socket.on('data', (data) => {
        // 버퍼에 데이터 추가
        clientInfo.messageBuffer += data.toString();
        
        // 개행 문자로 메시지 분리
        const messages = clientInfo.messageBuffer.split('\n');
        
        // 마지막 조각은 불완전할 수 있으므로 보관
        clientInfo.messageBuffer = messages.pop();
        
        // 완전한 메시지들 처리
        messages.forEach(messageStr => {
            if (messageStr.trim()) {
                try {
                    const message = JSON.parse(messageStr);
                    
                    // 타임스탬프가 없으면 추가
                    if (!message.timestamp) {
                        message.timestamp = Date.now();
                    }
                    
                    // 클라이언트 ID가 없으면 추가
                    if (!message.clientId) {
                        message.clientId = `client_${clientId}`;
                    }
                    
                    console.log(`📨 [Client ${clientId}] Type: ${message.type}`);
                    
                    // 메시지 타입에 따라 핸들러 호출
                    const handler = messageHandlers[message.type];
                    if (handler) {
                        handler(clientId, message);
                    } else {
                        console.warn(`⚠️  Unknown message type: ${message.type}`);
                        // 알 수 없는 메시지는 그냥 브로드캐스트
                        broadcastToOthers(clientId, message);
                    }
                    
                } catch (err) {
                    console.error(`❌ [Client ${clientId}] JSON parse error:`, err.message);
                    console.error(`   Raw data: ${messageStr.substring(0, 100)}...`);
                }
            }
        });
    });
    
    // 연결 종료
    socket.on('end', () => {
        console.log(`[${new Date().toISOString()}] 👋 Client ${clientId} disconnected gracefully`);
        clients.delete(clientId);
        console.log(`   Remaining clients: ${clients.size}`);
        
        // 해당 클라이언트가 소유한 오브젝트 정리 (옵션)
        // gameState.objects.forEach((obj, id) => {
        //     if (obj.owner === clientId) {
        //         gameState.objects.delete(id);
        //     }
        // });
    });
    
    socket.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ Client ${clientId} error:`, err.message);
        clients.delete(clientId);
    });
});

// 서버 에러 처리
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});

// 서버 시작
server.listen(PORT, HOST, () => {
    console.log('='.repeat(70));
    console.log('🚀 Cross-Engine JSON TCP Server Started (Week 2)');
    console.log('='.repeat(70));
    console.log(`📍 Address: ${HOST}:${PORT}`);
    console.log(`🕒 Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(70));
    console.log('📦 Message Types Supported:');
    console.log('   - position_update: 오브젝트 위치/회전 업데이트');
    console.log('   - color_change: 오브젝트 색상 변경');
    console.log('   - chat_message: 채팅 메시지');
    console.log('   - spawn_object: 오브젝트 생성');
    console.log('   - destroy_object: 오브젝트 삭제');
    console.log('='.repeat(70));
    console.log('💡 Waiting for connections...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down server...');
    
    // 종료 메시지 전송
    const shutdownMessage = {
        type: 'server_message',
        timestamp: Date.now(),
        data: { message: 'Server is shutting down. Goodbye!' }
    };
    
    clients.forEach((client, id) => {
        try {
            client.socket.write(JSON.stringify(shutdownMessage) + '\n');
            client.socket.end();
        } catch (err) {
            // Ignore
        }
    });
    
    server.close(() => {
        console.log('✅ Server closed successfully');
        console.log(`📊 Final stats: ${gameState.objects.size} objects in state`);
        process.exit(0);
    });
    
    setTimeout(() => {
        console.error('⚠️  Forced shutdown');
        process.exit(1);
    }, 5000);
});

// 통계 출력 (10초마다)
setInterval(() => {
    if (clients.size > 0) {
        console.log(`\n📊 Status: ${clients.size} clients, ${gameState.objects.size} objects\n`);
    }
}, 10000);