// TCPClient.cs
// Week 1: Basic TCP Client for Unity
// 위치: Assets/Scripts/Network/TCPClient.cs

using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEngine;

public class TCPClient : MonoBehaviour
{
    [Header("Connection Settings")]
    [SerializeField] private string serverIP = "127.0.0.1";
    [SerializeField] private int serverPort = 12793;
    [SerializeField] private bool autoConnect = true;

    [Header("Status")]
    [SerializeField] private bool isConnected = false;

    // TCP 클라이언트
    private TcpClient tcpClient;
    private NetworkStream stream;
    private Thread receiveThread;

    // 메시지 큐 (스레드 안전)
    private Queue<string> receivedMessages = new Queue<string>();
    private readonly object messageLock = new object();

    // 공개 프로퍼티
    public bool IsConnected => isConnected;
    public List<string> MessageHistory { get; private set; } = new List<string>();

    void Start()
    {
        if (autoConnect)
        {
            ConnectToServer();
        }
    }

    void Update()
    {
        // 메인 스레드에서 수신된 메시지 처리
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

    /// <summary>
    /// 서버에 연결
    /// </summary>
    public void ConnectToServer()
    {
        if (isConnected)
        {
            Debug.Log("[TCP Client] Already connected to server");
            return;
        }

        try
        {
            Debug.Log($"[TCP Client] Connecting to {serverIP}:{serverPort}...");

            tcpClient = new TcpClient();
            tcpClient.Connect(serverIP, serverPort);
            stream = tcpClient.GetStream();

            isConnected = true;
            Debug.Log("[TCP Client] Connected to server successfully!");

            // 수신 스레드 시작
            receiveThread = new Thread(ReceiveData);
            receiveThread.IsBackground = true;
            receiveThread.Start();
        }
        catch (Exception e)
        {
            Debug.LogError($"[TCP Client] Connection failed: {e.Message}");
            isConnected = false;
        }
    }

    /// <summary>
    /// 서버 연결 해제
    /// </summary>
    public void DisconnectFromServer()
    {
        if (!isConnected)
            return;

        Debug.Log("[TCP Client] Disconnecting from server...");

        isConnected = false;

        // 수신 스레드 종료
        if (receiveThread != null && receiveThread.IsAlive)
        {
            receiveThread.Abort();
            receiveThread = null;
        }

        // 스트림 및 클라이언트 종료
        try
        {
            stream?.Close();
            tcpClient?.Close();
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[TCP Client] Disconnect warning: {e.Message}");
        }

        stream = null;
        tcpClient = null;

        Debug.Log("[TCP Client] Disconnected");
    }

    /// <summary>
    /// 메시지 전송
    /// </summary>
    new public bool SendMessage(string message)
    {
        if (!isConnected || stream == null)
        {
            Debug.LogError("[TCP Client] Cannot send message: Not connected");
            return false;
        }

        try
        {
            // UTF-8 인코딩 + 개행 문자 추가
            byte[] data = Encoding.UTF8.GetBytes(message + "\n");
            stream.Write(data, 0, data.Length);
            stream.Flush();

            Debug.Log($"[TCP Client] Sent: {message} ({data.Length} bytes)");
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"[TCP Client] Failed to send message: {e.Message}");
            DisconnectFromServer();
            return false;
        }
    }

    /// <summary>
    /// 데이터 수신 (별도 스레드에서 실행)
    /// </summary>
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

                        // 마지막 메시지는 불완전할 수 있으므로 보관
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
                    // CPU 과부하 방지
                    Thread.Sleep(10);
                }
            }
            catch (Exception e)
            {
                if (isConnected)
                {
                    Debug.LogError($"[TCP Client] Receive error: {e.Message}");
                    isConnected = false;
                }
                break;
            }
        }
    }

    /// <summary>
    /// 수신된 메시지 처리 (메인 스레드에서 실행)
    /// </summary>
    private void ProcessReceivedMessages()
    {
        lock (messageLock)
        {
            while (receivedMessages.Count > 0)
            {
                string message = receivedMessages.Dequeue();

                // 메시지 히스토리에 추가
                MessageHistory.Add(message);

                // 최근 100개만 유지
                if (MessageHistory.Count > 100)
                {
                    MessageHistory.RemoveAt(0);
                }

                Debug.Log($"[TCP Client] Received: {message}");

                // 이벤트 발생 (필요시)
                OnMessageReceived?.Invoke(message);
            }
        }
    }

    // 메시지 수신 이벤트 (옵션)
    public event Action<string> OnMessageReceived;

    #region UI Helper Methods

    /// <summary>
    /// 테스트용: "Hello from Unity" 메시지 전송
    /// </summary>
    [ContextMenu("Send Test Message")]
    public void SendTestMessage()
    {
        SendMessage("Hello from Unity! Time: " + DateTime.Now.ToString("HH:mm:ss"));
    }

    /// <summary>
    /// Inspector에서 연결 버튼
    /// </summary>
    [ContextMenu("Connect")]
    public void Connect()
    {
        ConnectToServer();
    }

    /// <summary>
    /// Inspector에서 연결 해제 버튼
    /// </summary>
    [ContextMenu("Disconnect")]
    public void Disconnect()
    {
        DisconnectFromServer();
    }

    #endregion
}