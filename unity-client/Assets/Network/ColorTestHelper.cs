using UnityEngine;

/// <summary>
/// NetworkTestObject 색상 테스트 도구
/// 
/// NetworkTestObject와 함께 사용하여 색상 동기화를 쉽게 테스트할 수 있습니다.
/// 
/// 사용법:
/// 1. NetworkTestObject가 있는 오브젝트에 추가
/// 2. Play 모드
/// 3. Inspector 버튼 클릭하거나 키보드 사용
/// </summary>
public class ColorTestHelper : MonoBehaviour
{
    [Header("연결")]
    [Tooltip("테스트할 NetworkTestObject (비어있으면 자동 검색)")]
    public NetworkTestObject networkObject;

    [Header("테스트 버튼 (Inspector)")]
    [Tooltip("체크하면 빨강 전송")]
    public bool sendRed = false;

    [Tooltip("체크하면 초록 전송")]
    public bool sendGreen = false;

    [Tooltip("체크하면 파랑 전송")]
    public bool sendBlue = false;

    [Tooltip("체크하면 랜덤 색상 전송")]
    public bool sendRandom = false;

    [Header("키보드 단축키")]
    [Tooltip("키보드 단축키 활성화 (Input System 오류 주의!)")]
    public bool enableKeyboardShortcuts = false;

    [Header("자동 테스트")]
    [Tooltip("자동으로 색상 변경")]
    public bool autoChangeColor = false;

    [Tooltip("자동 변경 간격 (초)")]
    [Range(0.5f, 10f)]
    public float autoChangeInterval = 2f;

    private float lastAutoChangeTime;

    void Start()
    {
        // NetworkTestObject 자동 검색
        if (networkObject == null)
        {
            networkObject = GetComponent<NetworkTestObject>();

            if (networkObject == null)
            {
                Debug.LogError("[ColorTestHelper] NetworkTestObject를 찾을 수 없습니다!");
            }
        }
    }

    void Update()
    {
        if (networkObject == null) return;

        // Inspector 버튼 처리
        HandleInspectorButtons();

        // 키보드 단축키 처리 (선택적)
        if (enableKeyboardShortcuts)
        {
            HandleKeyboardInput();
        }

        // 자동 색상 변경
        if (autoChangeColor)
        {
            if (Time.time - lastAutoChangeTime >= autoChangeInterval)
            {
                SendRandomColor();
                lastAutoChangeTime = Time.time;
            }
        }
    }

    void HandleInspectorButtons()
    {
        if (sendRed)
        {
            sendRed = false;
            SendColor(Color.red, "빨강");
        }

        if (sendGreen)
        {
            sendGreen = false;
            SendColor(Color.green, "초록");
        }

        if (sendBlue)
        {
            sendBlue = false;
            SendColor(Color.blue, "파랑");
        }

        if (sendRandom)
        {
            sendRandom = false;
            SendRandomColor();
        }
    }

    void HandleKeyboardInput()
    {
        // Input System 사용 중이면 주석 처리!
        // 또는 Player Settings에서 "Both" 선택

        /*
        if (Input.GetKeyDown(KeyCode.Alpha1)) SendColor(Color.red, "빨강");
        if (Input.GetKeyDown(KeyCode.Alpha2)) SendColor(Color.green, "초록");
        if (Input.GetKeyDown(KeyCode.Alpha3)) SendColor(Color.blue, "파랑");
        if (Input.GetKeyDown(KeyCode.Alpha4)) SendColor(Color.yellow, "노랑");
        if (Input.GetKeyDown(KeyCode.Alpha5)) SendColor(Color.cyan, "청록");
        if (Input.GetKeyDown(KeyCode.Alpha6)) SendColor(Color.magenta, "자홍");
        if (Input.GetKeyDown(KeyCode.Alpha7)) SendColor(Color.white, "흰색");
        if (Input.GetKeyDown(KeyCode.Alpha8)) SendColor(Color.black, "검정");
        if (Input.GetKeyDown(KeyCode.Alpha9)) SendRandomColor();
        */
    }

    public void SendColor(Color color, string name = "")
    {
        if (networkObject != null)
        {
            networkObject.SendColorChange(color);
            Debug.Log($"[ColorTestHelper] {name} 색상 전송: R={color.r:F2}, G={color.g:F2}, B={color.b:F2}");
        }
    }

    public void SendRandomColor()
    {
        Color randomColor = Random.ColorHSV(
            0f, 1f,  // Hue
            0.5f, 1f,  // Saturation (밝은 색상)
            0.5f, 1f   // Value (밝은 색상)
        );

        SendColor(randomColor, "랜덤");
    }

    // ============================================
    // 공개 메서드 (다른 스크립트에서 호출 가능)
    // ============================================

    public void SendRedColor() => SendColor(Color.red, "빨강");
    public void SendGreenColor() => SendColor(Color.green, "초록");
    public void SendBlueColor() => SendColor(Color.blue, "파랑");
    public void SendYellowColor() => SendColor(Color.yellow, "노랑");
    public void SendCyanColor() => SendColor(Color.cyan, "청록");
    public void SendMagentaColor() => SendColor(Color.magenta, "자홍");
    public void SendWhiteColor() => SendColor(Color.white, "흰색");
    public void SendBlackColor() => SendColor(Color.black, "검정");

    // ============================================
    // GUI (간단한 버튼)
    // ============================================

    void OnGUI()
    {
        if (networkObject == null) return;

        // 화면 오른쪽에 버튼 배치
        float x = Screen.width - 120;
        float y = 10;
        float width = 110;
        float height = 30;
        float spacing = 35;

        GUIStyle style = new GUIStyle(GUI.skin.button);
        style.fontSize = 14;

        if (GUI.Button(new Rect(x, y, width, height), "빨강", style))
            SendRedColor();

        if (GUI.Button(new Rect(x, y + spacing, width, height), "초록", style))
            SendGreenColor();

        if (GUI.Button(new Rect(x, y + spacing * 2, width, height), "파랑", style))
            SendBlueColor();

        if (GUI.Button(new Rect(x, y + spacing * 3, width, height), "노랑", style))
            SendYellowColor();

        if (GUI.Button(new Rect(x, y + spacing * 4, width, height), "랜덤", style))
            SendRandomColor();
    }
}