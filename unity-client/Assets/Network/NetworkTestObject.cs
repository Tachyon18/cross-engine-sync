using UnityEngine;
using System;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;

/// <summary>
/// 네트워크 테스트 오브젝트 - 최종 완성 버전
/// 
/// 기능:
/// - 자동 TCP 연결
/// - 위치/색상/채팅 동기화
/// - 자동 재연결 (연결 끊김 감지)
/// - 스레드 안전 메시지 처리
/// 
/// 사용법:
/// 1. GameObject에 추가
/// 2. Inspector 설정 (Server IP, Port, Object ID)
/// 3. Play!
/// </summary>
public class NetworkTestObject : MonoBehaviour
{
    [Header("서버 설정")]
    [Tooltip("서버 주소")]
    public string serverIP = "localhost";

    [Tooltip("서버 포트")]
    public int port = 8080;

    [Header("오브젝트 설정")]
    [Tooltip("이 오브젝트의 고유 ID")]
    public string objectID = "cube_001";

    [Tooltip("위치 자동 전송")]
    public bool autoSendPosition = true;

    [Tooltip("위치 전송 간격 (초)")]
    [Range(0.01f, 1.0f)]
    public float sendInterval = 0.1f;

    [Header("재연결 설정")]
    [Tooltip("자동 재연결 활성화")]
    public bool autoReconnect = true;

    [Tooltip("재연결 시도 간격 (초)")]
    [Range(1f, 10f)]
    public float reconnectInterval = 3f;

    [Header("시각적 피드백")]
    [Tooltip("연결 상태를 색상으로 표시")]
    public bool showConnectionStatus = true;

    [Tooltip("연결됨 색상")]
    public Color connectedColor = Color.green;

    [Tooltip("연결 안 됨 색상")]
    public Color disconnectedColor = Color.red;

    [Header("디버그")]
    [Tooltip("콘솔에 메시지 출력")]
    public bool debugMode = true;

    [Tooltip("position_update 메시지 숨김")]
    public bool filterPositionUpdates = true;

    // 내부 상태
    private TcpClient client;
    private NetworkStream stream;
    private Thread receiveThread;
    private bool isConnected = false;
    private bool isRunning = false;
    private float lastSendTime;
    private Vector3 lastPosition;
    private Renderer objectRenderer;
    private Color originalColor;
    private float lastReconnectAttempt;
    private bool isReconnecting = false;

    // 스레드 안전 메시지 큐
    private Queue<string> messageQueue = new Queue<string>();
    private object queueLock = new object();

    void Start()
    {
        objectRenderer = GetComponent<Renderer>();
        if (objectRenderer != null)
        {
            originalColor = objectRenderer.material.color;
        }

        lastPosition = transform.position;

        ConnectToServer();
    }

    void Update()
    {
        // 메시지 큐 처리
        ProcessMessageQueue();

        // 재연결 확인
        if (!isConnected && autoReconnect && !isReconnecting)
        {
            if (Time.time - lastReconnectAttempt >= reconnectInterval)
            {
                LogDebug("자동 재연결 시도...");
                ConnectToServer();
                lastReconnectAttempt = Time.time;
            }
        }

        // 위치 전송
        if (autoSendPosition && isConnected)
        {
            if (Vector3.Distance(transform.position, lastPosition) > 0.01f)
            {
                if (Time.time - lastSendTime >= sendInterval)
                {
                    SendPositionUpdate();
                    lastSendTime = Time.time;
                    lastPosition = transform.position;
                }
            }
        }

        // 연결 상태 시각화
        UpdateConnectionVisual();

        // 키보드 입력 (테스트용)
        HandleTestInput();
    }

    void UpdateConnectionVisual()
    {
        if (!showConnectionStatus || objectRenderer == null) return;

        // 연결 상태에 따라 머티리얼 색상 변경
        // 단, 다른 클라이언트가 보낸 색상 변경은 유지
        if (isConnected)
        {
            // 연결됨 - 머티리얼의 emission이나 outline으로 표시하는 것이 좋지만
            // 간단하게 하려면 이렇게
            if (!isReceivingColorUpdate)
            {
                objectRenderer.material.color = Color.Lerp(
                    objectRenderer.material.color,
                    connectedColor,
                    Time.deltaTime * 2f
                );
            }
        }
        else
        {
            objectRenderer.material.color = Color.Lerp(
                objectRenderer.material.color,
                disconnectedColor,
                Time.deltaTime * 2f
            );
        }
    }

    private bool isReceivingColorUpdate = false;

    void HandleTestInput()
    {
        // 테스트용 키보드 입력은 옵션에 따라 활성화
        // Input System 오류 방지를 위해 주석 처리
        // 필요하면 Inspector 버튼이나 코드로 호출

        /*
        if (Input.GetKey(KeyCode.W)) transform.position += Vector3.forward * 5f * Time.deltaTime;
        if (Input.GetKey(KeyCode.S)) transform.position += Vector3.back * 5f * Time.deltaTime;
        if (Input.GetKey(KeyCode.A)) transform.position += Vector3.left * 5f * Time.deltaTime;
        if (Input.GetKey(KeyCode.D)) transform.position += Vector3.right * 5f * Time.deltaTime;
        if (Input.GetKeyDown(KeyCode.Space)) SendColorChange(UnityEngine.Random.ColorHSV());
        if (Input.GetKeyDown(KeyCode.C)) SendChatMessage($"테스트 from {objectID}");
        if (Input.GetKeyDown(KeyCode.R)) { DisconnectFromServer(); ConnectToServer(); }
        */
    }

    void ConnectToServer()
    {
        if (isReconnecting) return;

        isReconnecting = true;

        try
        {
            LogDebug($"서버 연결 시도: {serverIP}:{port}");

            // 기존 연결 정리
            if (client != null)
            {
                try { client.Close(); } catch { }
                client = null;
            }

            client = new TcpClient();
            client.Connect(serverIP, port);
            stream = client.GetStream();
            isConnected = true;
            isRunning = true;

            // 수신 스레드 시작
            receiveThread = new Thread(ReceiveMessages);
            receiveThread.IsBackground = true;
            receiveThread.Start();

            LogDebug("서버 연결 성공!");

            // 연결 확인 메시지
            SendChatMessage($"{objectID} 연결됨!");
        }
        catch (Exception e)
        {
            LogDebug($"연결 실패: {e.Message}");
            isConnected = false;
            lastReconnectAttempt = Time.time;
        }
        finally
        {
            isReconnecting = false;
        }
    }

    void DisconnectFromServer()
    {
        isRunning = false;
        isConnected = false;

        if (receiveThread != null && receiveThread.IsAlive)
        {
            receiveThread.Join(1000);
        }

        if (stream != null)
        {
            try { stream.Close(); } catch { }
            stream = null;
        }

        if (client != null)
        {
            try { client.Close(); } catch { }
            client = null;
        }

        LogDebug("서버 연결 해제");
    }

    void ReceiveMessages()
    {
        byte[] buffer = new byte[4096];

        while (isRunning && client != null && stream != null)
        {
            try
            {
                int bytesRead = stream.Read(buffer, 0, buffer.Length);
                if (bytesRead > 0)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);

                    string[] messages = message.Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries);

                    foreach (string msg in messages)
                    {
                        if (!string.IsNullOrWhiteSpace(msg))
                        {
                            lock (queueLock)
                            {
                                messageQueue.Enqueue(msg);
                            }
                        }
                    }
                }
                else
                {
                    // 연결 종료
                    LogDebug("서버 연결 종료 감지 (bytesRead = 0)");
                    isConnected = false;
                    break;
                }
            }
            catch (Exception e)
            {
                if (isRunning)
                {
                    LogDebug($"수신 오류: {e.Message}");
                    isConnected = false;
                }
                break;
            }
        }

        LogDebug("수신 스레드 종료");
    }

    void ProcessMessageQueue()
    {
        lock (queueLock)
        {
            while (messageQueue.Count > 0)
            {
                string message = messageQueue.Dequeue();
                ProcessMessage(message);
            }
        }
    }

    void ProcessMessage(string message)
    {
        try
        {
            NetworkMessage msg = JsonUtility.FromJson<NetworkMessage>(message);

            if (msg == null) return;

            // 디버그 로그
            bool shouldLog = !filterPositionUpdates || msg.type != "position_update";
            if (debugMode && shouldLog)
            {
                LogDebug($"[{msg.type}] from {msg.objectId}");
            }

            // 자기 메시지 무시 (선택적)
            // if (msg.objectId == objectID) return;

            // 메시지 타입별 처리
            switch (msg.type)
            {
                case "position_update":
                    HandlePositionUpdate(msg);
                    break;

                case "color_change":
                    HandleColorChange(msg);
                    break;

                case "chat_message":
                    HandleChatMessage(msg);
                    break;
            }
        }
        catch (Exception e)
        {
            LogDebug($"메시지 처리 오류: {e.Message}\n메시지: {message}");
        }
    }

    void HandlePositionUpdate(NetworkMessage msg)
    {
        if (debugMode && !filterPositionUpdates)
        {
            LogDebug($"{msg.objectId} 위치: ({msg.x:F2}, {msg.y:F2}, {msg.z:F2})");
        }

        // 실제 게임에서는 해당 오브젝트를 찾아서 이동
        // GameObject targetObj = GameObject.Find(msg.objectId);
        // if (targetObj != null)
        //     targetObj.transform.position = new Vector3(msg.x, msg.y, msg.z);
    }

    void HandleColorChange(NetworkMessage msg)
    {
        // 핵심 기능: 색상 변경!
        if (objectRenderer != null)
        {
            Color newColor = new Color(msg.r, msg.g, msg.b);
            objectRenderer.material.color = newColor;

            isReceivingColorUpdate = true;

            LogDebug($"색상 변경: R={msg.r:F2}, G={msg.g:F2}, B={msg.b:F2}");

            // 0.5초 후 연결 상태 색상으로 복귀 허용
            Invoke("ResetColorUpdateFlag", 0.5f);
        }
    }

    void ResetColorUpdateFlag()
    {
        isReceivingColorUpdate = false;
    }

    void HandleChatMessage(NetworkMessage msg)
    {
        LogDebug($"[{msg.objectId}]: {msg.content}");
    }

    // ============================================
    // 메시지 전송
    // ============================================

    public void SendPositionUpdate()
    {
        if (!isConnected) return;

        NetworkMessage msg = new NetworkMessage
        {
            type = "position_update",
            objectId = objectID,
            x = transform.position.x,
            y = transform.position.y,
            z = transform.position.z,
            timestamp = GetTimestamp()
        };

        SendMessage(msg);
    }

    public void SendColorChange(Color color)
    {
        if (!isConnected)
        {
            LogDebug("연결 안 됨 - 색상 전송 불가");
            return;
        }

        NetworkMessage msg = new NetworkMessage
        {
            type = "color_change",
            objectId = objectID,
            r = color.r,
            g = color.g,
            b = color.b,
            timestamp = GetTimestamp()
        };

        if (objectRenderer != null)
        {
            objectRenderer.material.color = color;
        }

        SendMessage(msg);
        LogDebug($"색상 전송: R={color.r:F2}, G={color.g:F2}, B={color.b:F2}");
    }

    public void SendChatMessage(string text)
    {
        if (!isConnected) return;

        NetworkMessage msg = new NetworkMessage
        {
            type = "chat_message",
            objectId = objectID,
            content = text,
            timestamp = GetTimestamp()
        };

        SendMessage(msg);
        LogDebug($"채팅 전송: {text}");
    }

    void SendMessage(NetworkMessage msg)
    {
        if (!isConnected || stream == null) return;

        try
        {
            string json = JsonUtility.ToJson(msg);
            byte[] data = Encoding.UTF8.GetBytes(json + "\n");
            stream.Write(data, 0, data.Length);
        }
        catch (Exception e)
        {
            LogDebug($"전송 오류: {e.Message}");
            isConnected = false;
        }
    }

    // ============================================
    // 유틸리티
    // ============================================

    long GetTimestamp()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    void LogDebug(string message)
    {
        if (debugMode)
        {
            Debug.Log($"[NetworkTestObject - {objectID}] {message}");
        }
    }

    void OnDestroy()
    {
        DisconnectFromServer();
    }

    void OnApplicationQuit()
    {
        DisconnectFromServer();
    }

    // ============================================
    // GUI (디버그용)
    // ============================================

    void OnGUI()
    {
        if (!debugMode) return;

        GUIStyle style = new GUIStyle(GUI.skin.box);
        style.normal.textColor = isConnected ? Color.green : Color.red;
        style.fontSize = 14;
        style.alignment = TextAnchor.UpperLeft;

        string status = isConnected ? "연결됨" : "연결 안 됨";
        string info = $"{status}\n";
        info += $"서버: {serverIP}:{port}\n";
        info += $"오브젝트: {objectID}\n";
        info += $"위치: {transform.position}\n";

        if (!isConnected && autoReconnect)
        {
            float nextReconnect = reconnectInterval - (Time.time - lastReconnectAttempt);
            if (nextReconnect > 0)
            {
                info += $"\n재연결: {nextReconnect:F1}초 후";
            }
        }

        info += $"\n\nScene에서 드래그하여 이동";
        info += $"\n또는 코드로 SendColorChange() 호출";

        GUI.Box(new Rect(10, 10, 250, 180), info, style);
    }
}