
using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEngine;

#region Message Data Structures

[Serializable]
public class Vector3Data
{
    public float x;
    public float y;
    public float z;

    public Vector3Data() { }
    public Vector3Data(Vector3 v)
    {
        x = v.x;
        y = v.y;
        z = v.z;
    }

    public Vector3 ToVector3() => new Vector3(x, y, z);
}

[Serializable]
public class ColorData
{
    public int r;
    public int g;
    public int b;
    public int a;

    public ColorData() { }
    public ColorData(Color c)
    {
        r = Mathf.RoundToInt(c.r * 255);
        g = Mathf.RoundToInt(c.g * 255);
        b = Mathf.RoundToInt(c.b * 255);
        a = Mathf.RoundToInt(c.a * 255);
    }

    public Color ToColor() => new Color(r / 255f, g / 255f, b / 255f, a / 255f);
}

// 위치 업데이트 데이터
[Serializable]
public class PositionUpdateData
{
    public string objectId;
    public Vector3Data position;
    public Vector3Data rotation;
}

// 색상 변경 데이터
[Serializable]
public class ColorChangeData
{
    public string objectId;
    public ColorData color;
}

// 채팅 메시지 데이터
[Serializable]
public class ChatMessageData
{
    public string message;
}

// 위치 업데이트 메시지 (전체)
[Serializable]
public class PositionUpdateMessage
{
    public string type;
    public long timestamp;
    public string clientId;
    public PositionUpdateData data;
}

// 색상 변경 메시지 (전체)
[Serializable]
public class ColorChangeMessage
{
    public string type;
    public long timestamp;
    public string clientId;
    public ColorChangeData data;
}

// 채팅 메시지 (전체)
[Serializable]
public class ChatMessage
{
    public string type;
    public long timestamp;
    public string clientId;
    public ChatMessageData data;
}

#endregion

public class TCPClientJSON : MonoBehaviour
{
    [Header("Connection Settings")]
    [SerializeField] private string serverIP = "127.0.0.1";
    [SerializeField] private int serverPort = 12793;
    [SerializeField] private bool autoConnect = true;
    [SerializeField] private string clientIdentifier = "unity_client";

    [Header("Status")]
    [SerializeField] private bool isConnected = false;

    // TCP 클라이언트
    private TcpClient tcpClient;
    private NetworkStream stream;
    private Thread receiveThread;

    // 메시지 큐 (스레드 안전)
    private Queue<string> receivedMessages = new Queue<string>();
    private readonly object messageLock = new object();

    // 이벤트
    public event Action<PositionUpdateData> OnPositionUpdateReceived;
    public event Action<ColorChangeData> OnColorChangeReceived;
    public event Action<string, string> OnChatMessageReceived;  // (clientId, message)

    // 공개 프로퍼티
    public bool IsConnected => isConnected;

    void Start()
    {
        if (autoConnect)
        {
            ConnectToServer();
        }
    }

    void Update()
    {
        ProcessReceivedMessages();
    }

    void OnDestroy()
    {
        DisconnectFromServer();
    }

    void OnApplicationQuit()
    {
        DisconnectFromServer();
    }

    #region Connection Management

    public void ConnectToServer()
    {
        if (isConnected)
        {
            Debug.Log("[TCP JSON] Already connected to server");
            return;
        }

        try
        {
            Debug.Log($"[TCP JSON] Connecting to {serverIP}:{serverPort}...");

            tcpClient = new TcpClient();
            tcpClient.Connect(serverIP, serverPort);
            stream = tcpClient.GetStream();

            isConnected = true;
            Debug.Log("[TCP JSON] Connected to server successfully!");

            // 수신 스레드 시작
            receiveThread = new Thread(ReceiveData);
            receiveThread.IsBackground = true;
            receiveThread.Start();
        }
        catch (Exception e)
        {
            Debug.LogError($"[TCP JSON] Connection failed: {e.Message}");
            isConnected = false;
        }
    }

    public void DisconnectFromServer()
    {
        if (!isConnected)
            return;

        Debug.Log("[TCP JSON] Disconnecting from server...");

        isConnected = false;

        if (receiveThread != null && receiveThread.IsAlive)
        {
            receiveThread.Abort();
            receiveThread = null;
        }

        try
        {
            stream?.Close();
            tcpClient?.Close();
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[TCP JSON] Disconnect warning: {e.Message}");
        }

        stream = null;
        tcpClient = null;

        Debug.Log("[TCP JSON] Disconnected");
    }

    #endregion

    #region Send Messages

    public bool SendPositionUpdate(string objectId, Vector3 position, Vector3 rotation)
    {
        var message = new PositionUpdateMessage
        {
            type = "position_update",
            timestamp = GetCurrentTimestamp(),
            clientId = clientIdentifier,
            data = new PositionUpdateData
            {
                objectId = objectId,
                position = new Vector3Data(position),
                rotation = new Vector3Data(rotation)
            }
        };

        return SendMessage(message);
    }

    public bool SendColorChange(string objectId, Color color)
    {
        var message = new ColorChangeMessage
        {
            type = "color_change",
            timestamp = GetCurrentTimestamp(),
            clientId = clientIdentifier,
            data = new ColorChangeData
            {
                objectId = objectId,
                color = new ColorData(color)
            }
        };

        return SendMessage(message);
    }

    public bool SendChatMessage(string text)
    {
        var message = new ChatMessage
        {
            type = "chat_message",
            timestamp = GetCurrentTimestamp(),
            clientId = clientIdentifier,
            data = new ChatMessageData
            {
                message = text
            }
        };

        return SendMessage(message);
    }

    private bool SendMessage(object message)
    {
        if (!isConnected || stream == null)
        {
            Debug.LogError("[TCP JSON] Cannot send message: Not connected");
            return false;
        }

        try
        {
            string json = JsonUtility.ToJson(message);
            byte[] data = Encoding.UTF8.GetBytes(json + "\n");

            stream.Write(data, 0, data.Length);
            stream.Flush();

            Debug.Log($"[TCP JSON] Sent: {message.GetType().Name}");
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"[TCP JSON] Failed to send message: {e.Message}");
            DisconnectFromServer();
            return false;
        }
    }

    #endregion

    #region Receive Messages

    private void ReceiveData()
    {
        byte[] buffer = new byte[4096];
        StringBuilder messageBuilder = new StringBuilder();

        while (isConnected && stream != null)
        {
            try
            {
                if (stream.DataAvailable)
                {
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);

                    if (bytesRead > 0)
                    {
                        string data = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                        messageBuilder.Append(data);

                        // 개행 문자로 메시지 분리
                        string fullData = messageBuilder.ToString();
                        string[] messages = fullData.Split('\n');

                        for (int i = 0; i < messages.Length - 1; i++)
                        {
                            string msg = messages[i].Trim();
                            if (!string.IsNullOrEmpty(msg))
                            {
                                lock (messageLock)
                                {
                                    receivedMessages.Enqueue(msg);
                                }
                            }
                        }

                        // 마지막 불완전한 메시지 보관
                        messageBuilder.Clear();
                        messageBuilder.Append(messages[messages.Length - 1]);
                    }
                }
                else
                {
                    Thread.Sleep(10);
                }
            }
            catch (Exception e)
            {
                if (isConnected)
                {
                    Debug.LogError($"[TCP JSON] Receive error: {e.Message}");
                    isConnected = false;
                }
                break;
            }
        }
    }

    private void ProcessReceivedMessages()
    {
        lock (messageLock)
        {
            while (receivedMessages.Count > 0)
            {
                string jsonMessage = receivedMessages.Dequeue();
                ProcessMessage(jsonMessage);
            }
        }
    }

    private void ProcessMessage(string json)
    {
        try
        {
            // 먼저 type 필드만 파싱
            NetworkMessage baseMessage = JsonUtility.FromJson<NetworkMessage>(json);

            Debug.Log($"[TCP JSON] Received: {baseMessage.type}");

            // 타입에 따라 처리
            switch (baseMessage.type)
            {
                case "position_update":
                    var posMsg = JsonUtility.FromJson<PositionUpdateMessage>(json);
                    OnPositionUpdateReceived?.Invoke(posMsg.data);
                    break;

                case "color_change":
                    var colorMsg = JsonUtility.FromJson<ColorChangeMessage>(json);
                    OnColorChangeReceived?.Invoke(colorMsg.data);
                    break;

                case "chat_message":
                    var chatMsg = JsonUtility.FromJson<ChatMessage>(json);
                    OnChatMessageReceived?.Invoke(chatMsg.clientId, chatMsg.data.message);
                    Debug.Log($"[{chatMsg.clientId}]: {chatMsg.data.message}");
                    break;

                case "server_message":
                    // 서버 메시지는 로그만 출력
                    Debug.Log($"Server message received");
                    break;

                default:
                    Debug.LogWarning($"[TCP JSON] Unknown message type: {baseMessage.type}");
                    break;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[TCP JSON] Failed to parse message: {e.Message}");
            Debug.LogError($"JSON: {json.Substring(0, Mathf.Min(100, json.Length))}...");
        }
    }

    #endregion

    #region Helper Methods

    private long GetCurrentTimestamp()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    #endregion

    #region Test Methods (Context Menu)

    [ContextMenu("Send Test Position")]
    public void SendTestPosition()
    {
        Vector3 randomPos = new Vector3(
            UnityEngine.Random.Range(-10f, 10f),
            UnityEngine.Random.Range(0f, 5f),
            UnityEngine.Random.Range(-10f, 10f)
        );

        SendPositionUpdate("test_cube", randomPos, Vector3.zero);
    }

    [ContextMenu("Send Test Color")]
    public void SendTestColor()
    {
        Color randomColor = new Color(
            UnityEngine.Random.value,
            UnityEngine.Random.value,
            UnityEngine.Random.value,
            1f
        );

        SendColorChange("test_cube", randomColor);
    }

    [ContextMenu("Send Test Chat")]
    public void SendTestChat()
    {
        SendChatMessage("Hello from Unity! Time: " + DateTime.Now.ToString("HH:mm:ss"));
    }

    #endregion
}