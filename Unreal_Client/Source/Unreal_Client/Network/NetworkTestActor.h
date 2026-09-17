// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NetworkStruct.h"
#include "NetworkTestActor.generated.h"

UCLASS()
class UNREAL_CLIENT_API ANetworkTestActor : public AActor
{
	GENERATED_BODY()
	
public:	
	// Sets default values for this actor's properties
	ANetworkTestActor();

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;

public:	
	// Called every frame
	virtual void Tick(float DeltaTime) override;

public:

    // ???????????????????????????????????????????????????????????
    // 설정 (Inspector에서 수정 가능)
    // ???????????????????????????????????????????????????????????

// 테스트 모드 선택
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test")
    bool bAutoTest = true;  // 자동 테스트 활성화

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Mode")
    bool bTestPositionSync = true;  // 위치 동기화 테스트

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Mode")
    bool bTestColorChange = true;   // 색상 변경 테스트

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Mode")
    bool bTestChat = true;          // 채팅 테스트

    // 전송 설정
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Settings")
    float PositionUpdateInterval = 1.0f;  // 위치 업데이트 간격 (초)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Settings")
    float ColorChangeInterval = 2.0f;     // 색상 변경 간격 (초)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Settings")
    FString ObjectIDToSync = TEXT("test_cube");  // 동기화할 오브젝트 ID

    // 큐브 찾기 설정
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Cube")
    FName CubeTag = TEXT("NetworkCube");  // 큐브를 찾을 Tag (큐브에 설정!)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Cube")
    bool bAutoFindCube = true;  // 자동으로 큐브 찾기

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network Test|Cube")
    AActor* ManualCube = nullptr;  // 수동으로 큐브 지정 (드래그 가능)

    // ???????????????????????????????????????????????????????????
    // 상태 표시 (Inspector에서 확인만 가능)
    // ???????????????????????????????????????????????????????????

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Network Test|Status")
    bool bIsConnected = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Network Test|Status")
    int32 MessagesSent = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Network Test|Status")
    int32 MessagesReceived = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Network Test|Status")
    FString LastReceivedMessage = TEXT("None");

    // ???????????????????????????????????????????????????????????
    // 블루프린트에서 호출 가능한 함수
    // ???????????????????????????????????????????????????????????

    UFUNCTION(BlueprintCallable, Category = "Network Test")
    void SendTestPosition();

    UFUNCTION(BlueprintCallable, Category = "Network Test")
    void SendTestColor();

    UFUNCTION(BlueprintCallable, Category = "Network Test")
    void SendTestChat(const FString& Message);

    UFUNCTION(BlueprintCallable, Category = "Network Test")
    void TogglePositionSync();

    UFUNCTION(BlueprintCallable, Category = "Network Test")
    AActor* FindNetworkCube();

protected:
    // TCP 클라이언트 참조
    UPROPERTY()
    class ATCPClientJSON* TCPClient;

    // 동기화할 큐브
    UPROPERTY()
    AActor* TargetCube;

    // 타이머
    float PositionTimer = 0.0f;
    float ColorTimer = 0.0f;

    // 현재 색상 인덱스
    int32 CurrentColorIndex = 0;

    // 이벤트 핸들러
    UFUNCTION()
    void OnPositionReceived(FPositionUpdateData Data);

    UFUNCTION()
    void OnColorReceived(FColorChangeData Data);

    UFUNCTION()
    void OnChatReceived(const FString& ClientId, const FString& Message);

    // 초기화
    void InitializeTCPClient();
    void BindEvents();

    // 테스트 함수
    void UpdatePositionSync(float DeltaTime);
    void UpdateColorChange(float DeltaTime);

    // 유틸리티
    FLinearColor GetNextTestColor();
    void LogMessage(const FString& Message, bool bWarning = false);
};
