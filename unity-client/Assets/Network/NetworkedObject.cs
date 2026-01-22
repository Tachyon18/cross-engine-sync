// NetworkedObject.cs
// Week 2: 네트워크로 동기화되는 오브젝트
// 위치: Assets/Scripts/Network/NetworkedObject.cs

using UnityEngine;

[RequireComponent(typeof(MeshRenderer))]
public class NetworkedObject : MonoBehaviour
{
    [Header("Settings")]
    [SerializeField] private string objectId = "cube_001";
    [SerializeField] private bool sendUpdates = true;  // 이 오브젝트가 위치를 전송할지
    [SerializeField] private bool receiveUpdates = true;  // 다른 클라이언트의 위치를 받을지

    [Header("Update Settings")]
    [SerializeField] private float sendInterval = 0.1f;  // 초당 10번 전송
    [SerializeField] private float smoothTime = 0.1f;    // 위치 보간 시간

    [Header("References")]
    [SerializeField] private TCPClientJSON tcpClient;

    // 내부 상태
    private Vector3 targetPosition;
    private Vector3 positionVelocity;
    private MeshRenderer meshRenderer;
    private float lastSendTime;
    private Vector3 lastSentPosition;
    private Color lastSentColor;

    void Start()
    {
        meshRenderer = GetComponent<MeshRenderer>();
        targetPosition = transform.position;
        lastSentPosition = transform.position;
        lastSentColor = meshRenderer.material.color;

        // TCP 클라이언트 찾기
        if (tcpClient == null)
        {
            tcpClient = FindFirstObjectByType<TCPClientJSON>();
        }

        if (tcpClient != null)
        {
            // 이벤트 구독
            tcpClient.OnPositionUpdateReceived += HandlePositionUpdate;
            tcpClient.OnColorChangeReceived += HandleColorChange;
        }
        else
        {
            Debug.LogWarning($"[NetworkedObject] TCP Client not found for {objectId}");
        }
    }

    void OnDestroy()
    {
        if (tcpClient != null)
        {
            tcpClient.OnPositionUpdateReceived -= HandlePositionUpdate;
            tcpClient.OnColorChangeReceived -= HandleColorChange;
        }
    }

    void Update()
    {
        // 위치 업데이트 전송
        if (sendUpdates && tcpClient != null && tcpClient.IsConnected)
        {
            // 위치나 색상이 변경되었는지 확인
            bool positionChanged = Vector3.Distance(transform.position, lastSentPosition) > 0.01f;
            bool colorChanged = meshRenderer.material.color != lastSentColor;

            if (Time.time - lastSendTime >= sendInterval && positionChanged)
            {
                SendPositionUpdate();
                lastSendTime = Time.time;
            }

            if (colorChanged)
            {
                SendColorUpdate();
            }
        }

        // 수신한 위치로 부드럽게 이동
        if (receiveUpdates && Vector3.Distance(transform.position, targetPosition) > 0.01f)
        {
            transform.position = Vector3.SmoothDamp(
                transform.position,
                targetPosition,
                ref positionVelocity,
                smoothTime
            );
        }
    }

    // 위치 업데이트 전송
    private void SendPositionUpdate()
    {
        if (tcpClient.SendPositionUpdate(objectId, transform.position, transform.eulerAngles))
        {
            lastSentPosition = transform.position;
        }
    }

    // 색상 업데이트 전송
    private void SendColorUpdate()
    {
        Color currentColor = meshRenderer.material.color;
        if (tcpClient.SendColorChange(objectId, currentColor))
        {
            lastSentColor = currentColor;
        }
    }

    // 위치 업데이트 수신 처리
    private void HandlePositionUpdate(PositionUpdateData data)
    {
        if (data.objectId == objectId && receiveUpdates)
        {
            targetPosition = data.position.ToVector3();
            // 회전도 적용하고 싶다면:
            // transform.eulerAngles = data.rotation.ToVector3();

            Debug.Log($"[NetworkedObject] {objectId} position updated: {targetPosition}");
        }
    }

    // 색상 변경 수신 처리
    private void HandleColorChange(ColorChangeData data)
    {
        if (data.objectId == objectId && receiveUpdates)
        {
            Color newColor = data.color.ToColor();
            meshRenderer.material.color = newColor;
            lastSentColor = newColor;

            Debug.Log($"[NetworkedObject] {objectId} color changed: {newColor}");
        }
    }

    #region Public Methods (UI 버튼 등에서 호출)

    public void SetRandomColor()
    {
        Color randomColor = new Color(
            Random.value,
            Random.value,
            Random.value,
            1f
        );

        meshRenderer.material.color = randomColor;
    }

    public void TeleportRandom()
    {
        Vector3 randomPos = new Vector3(
            Random.Range(-10f, 10f),
            Random.Range(0f, 5f),
            Random.Range(-10f, 10f)
        );

        transform.position = randomPos;
    }

    #endregion

    // Gizmo로 objectId 표시
    void OnDrawGizmos()
    {
#if UNITY_EDITOR
        UnityEditor.Handles.Label(transform.position + Vector3.up * 2, objectId);
#endif
    }
}