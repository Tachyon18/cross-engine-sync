// Fill out your copyright notice in the Description page of Project Settings.


#include "NetworkTestActor.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/StaticMeshActor.h"
#include "TCPClientJSON.h"

// Sets default values
ANetworkTestActor::ANetworkTestActor()
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	PrimaryActorTick.bCanEverTick = true;

}

// Called when the game starts or when spawned
void ANetworkTestActor::BeginPlay()
{
	Super::BeginPlay();
	
    LogMessage(TEXT("========================================"));
    LogMessage(TEXT("Network Test Actor Started!"));
    LogMessage(TEXT("========================================"));

    // 1. TCP 클라이언트 찾기
    InitializeTCPClient();

    // 2. 타겟 큐브 찾기
    if (bAutoFindCube)
    {
        TargetCube = FindNetworkCube();
    }
    else if (ManualCube)
    {
        TargetCube = ManualCube;
        LogMessage(FString::Printf(TEXT("Using manually assigned cube: %s"), *TargetCube->GetName()));
    }

    if (!TargetCube)
    {
        LogMessage(TEXT("No target cube found! Create a cube and add tag 'NetworkCube'"), true);
    }

    // 3. 이벤트 바인딩
    BindEvents();

    // 4. 초기 테스트 메시지
    if (bAutoTest && bTestChat && TCPClient)
    {
        FTimerHandle TimerHandle;
        GetWorldTimerManager().SetTimer(TimerHandle, [this]()
            {
                SendTestChat(TEXT("Hello from Network Test Actor!"));
            }, 1.0f, false);
    }
}

// Called every frame
void ANetworkTestActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

    if (!bAutoTest || !TCPClient)
        return;

    // 연결 상태 업데이트
    bIsConnected = TCPClient->IsConnected();

    if (!bIsConnected)
        return;

    // 위치 동기화 테스트
    if (bTestPositionSync)
    {
        UpdatePositionSync(DeltaTime);
    }

    // 색상 변경 테스트
    if (bTestColorChange)
    {
        UpdateColorChange(DeltaTime);
    }
}


// ???????????????????????????????????????????????????????????????
// 메시지 전송 (블루프린트 호출 가능)
// ???????????????????????????????????????????????????????????????

void ANetworkTestActor::SendTestPosition()
{
    if (!TCPClient || !TargetCube)
        return;

    FVector Position = TargetCube->GetActorLocation();
    FRotator Rotation = TargetCube->GetActorRotation();

    TCPClient->SendPositionUpdate(ObjectIDToSync, Position, Rotation);
    MessagesSent++;

    // 가끔 로그 출력 (매번 출력하면 너무 많음)
    if (MessagesSent % 50 == 0)
    {
        LogMessage(FString::Printf(TEXT("Sent %d position updates"), MessagesSent));
    }
}

void ANetworkTestActor::SendTestColor()
{
    if (!TCPClient)
        return;

    FLinearColor Color = GetNextTestColor();
    TCPClient->SendColorChange(ObjectIDToSync, Color);
    MessagesSent++;

    LogMessage(FString::Printf(TEXT("Sent color change: R=%.0f G=%.0f B=%.0f"),
        Color.R * 255, Color.G * 255, Color.B * 255));
}

void ANetworkTestActor::SendTestChat(const FString& Message)
{
    if (!TCPClient)
        return;

    TCPClient->SendChatMessage(Message);
    MessagesSent++;

    LogMessage(FString::Printf(TEXT("Sent chat: %s"), *Message));
}

void ANetworkTestActor::TogglePositionSync()
{
    bTestPositionSync = !bTestPositionSync;
    LogMessage(FString::Printf(TEXT("Position sync: %s"),
        bTestPositionSync ? TEXT("ON") : TEXT("OFF")));
}

AActor* ANetworkTestActor::FindNetworkCube()
{
    // Tag로 큐브 찾기
    TArray<AActor*> FoundActors;
    UGameplayStatics::GetAllActorsWithTag(GetWorld(), CubeTag, FoundActors);

    if (FoundActors.Num() > 0)
    {
        LogMessage(FString::Printf(TEXT("Found cube with tag '%s': %s"),
            *CubeTag.ToString(), *FoundActors[0]->GetName()));
        return FoundActors[0];
    }

    // Tag가 없으면 이름으로 찾기 (StaticMeshActor)
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GetWorld(), AStaticMeshActor::StaticClass(), AllActors);

    for (AActor* Actor : AllActors)
    {
        FString ActorName = Actor->GetName();
        if (ActorName.Contains(TEXT("Cube"), ESearchCase::IgnoreCase, ESearchDir::FromStart))
        {
            LogMessage(FString::Printf(TEXT("Found cube by name: %s (Consider adding tag '%s')"),
                *ActorName, *CubeTag.ToString()));
            return Actor;
        }
    }

    return nullptr;
}

// ???????????????????????????????????????????????????????????????
// 이벤트 핸들러
// ???????????????????????????????????????????????????????????????

void ANetworkTestActor::OnPositionReceived(FPositionUpdateData Data)
{
    MessagesReceived++;
    LastReceivedMessage = FString::Printf(TEXT("Position: %.1f, %.1f, %.1f"),
        Data.position.x, Data.position.y, Data.position.z);

    // 받은 위치로 큐브 이동 (자신이 보낸 것이 아닌 경우만)
    if (TargetCube && Data.objectId == ObjectIDToSync)
    {
		FVector NewPosition = Data.position.ToFVector();
        FRotator NewRotation = FRotator::MakeFromEuler(FVector(
            Data.rotation.x,
            Data.rotation.y,
			Data.rotation.z));

        TargetCube->SetActorLocation(NewPosition);
        TargetCube->SetActorRotation(NewRotation);

        // 가끔 로그 출력
        if (MessagesReceived % 50 == 0)
        {
            LogMessage(FString::Printf(TEXT("Received %d updates"), MessagesReceived));
        }
    }
}

void ANetworkTestActor::OnColorReceived(FColorChangeData Data)
{
    MessagesReceived++;
    LastReceivedMessage = FString::Printf(TEXT("Color: %d, %d, %d"),
        Data.color.r, Data.color.g, Data.color.b);

    LogMessage(FString::Printf(TEXT("Received color change for %s"), *Data.objectId));

    // 받은 색상으로 큐브 색상 변경
    if (TargetCube && Data.objectId == ObjectIDToSync)
    {
        FLinearColor Color = Data.color.ToLinearColor();

        LogMessage(FString::Printf(TEXT("Cube is Available")));

        UStaticMeshComponent* MeshComp = TargetCube->FindComponentByClass<UStaticMeshComponent>();
        if (MeshComp)
        {
            LogMessage(FString::Printf(TEXT("Found StaticMeshComponent!")));

            // 다이나믹 머티리얼 생성 및 색상 설정
            UMaterialInterface* Material = MeshComp->GetMaterial(0);
            if (Material)
            {
                LogMessage(FString::Printf(TEXT("Changing color to R=%.0f G=%.0f B=%.0f"),
                    Color.R * 255, Color.G * 255, Color.B * 255));

                UMaterialInstanceDynamic* DynMaterial = UMaterialInstanceDynamic::Create(Material, this);
                if (DynMaterial)
                {
                    // 여러 파라미터 이름 시도
                    DynMaterial->SetVectorParameterValue(TEXT("BaseColor"), Color);
                    DynMaterial->SetVectorParameterValue(TEXT("Color"), Color);
                    DynMaterial->SetVectorParameterValue(TEXT("Tint"), Color);

                    MeshComp->SetMaterial(0, DynMaterial);
                    LogMessage(TEXT("Color changed successfully!"));
                }
            }
            else
            {
                LogMessage(TEXT("Material is null!"), true);
            }
        }
        else
        {
            LogMessage(TEXT("StaticMeshComponent not found!"), true);

            // 모든 컴포넌트 출력해보기
            TArray<UActorComponent*> Components;
            TargetCube->GetComponents(Components);
            LogMessage(FString::Printf(TEXT("TargetCube has %d components:"), Components.Num()));
            for (UActorComponent* Comp : Components)
            {
                LogMessage(FString::Printf(TEXT("  - %s"), *Comp->GetClass()->GetName()));
            }
        }
    }
}

void ANetworkTestActor::OnChatReceived(const FString& ClientId, const FString& Message)
{
    MessagesReceived++;
    LastReceivedMessage = FString::Printf(TEXT("Chat: %s"), *Message);

    LogMessage(FString::Printf(TEXT(" [%s]: %s"), *ClientId, *Message));
}

void ANetworkTestActor::InitializeTCPClient()
{
    // TCPClientJSON 찾기
    TArray<AActor*> FoundActors;
    UGameplayStatics::GetAllActorsOfClass(GetWorld(), ATCPClientJSON::StaticClass(), FoundActors);

    if (FoundActors.Num() > 0)
    {
        TCPClient = Cast<ATCPClientJSON>(FoundActors[0]);
        LogMessage(FString::Printf(TEXT("Found TCP Client: %s"), *TCPClient->GetName()));
    }
    else
    {
        LogMessage(TEXT("TCP Client not found! Add TCPClientJSON to the level."), true);
    }
}

void ANetworkTestActor::BindEvents()
{
    if (!TCPClient)
    {
        LogMessage(TEXT("Cannot bind events: TCP Client is null"), true);
        return;
    }

    // 이벤트 바인딩
    TCPClient->OnPositionUpdateReceived.AddDynamic(this, &ANetworkTestActor::OnPositionReceived);
    TCPClient->OnColorChangeReceived.AddDynamic(this, &ANetworkTestActor::OnColorReceived);
    TCPClient->OnChatMessageReceived.AddDynamic(this, &ANetworkTestActor::OnChatReceived);

    LogMessage(TEXT("Events bound successfully!"));
}

// ???????????????????????????????????????????????????????????????
// 테스트 업데이트
// ???????????????????????????????????????????????????????????????

void ANetworkTestActor::UpdatePositionSync(float DeltaTime)
{
    if (!TargetCube)
        return;

    PositionTimer += DeltaTime;

    if (PositionTimer >= PositionUpdateInterval)
    {
        PositionTimer = 0.0f;
        SendTestPosition();
    }
}

void ANetworkTestActor::UpdateColorChange(float DeltaTime)
{
    ColorTimer += DeltaTime;

    if (ColorTimer >= ColorChangeInterval)
    {
        ColorTimer = 0.0f;
        SendTestColor();
    }
}

// ???????????????????????????????????????????????????????????????
// 유틸리티
// ???????????????????????????????????????????????????????????????

FLinearColor ANetworkTestActor::GetNextTestColor()
{
    // 5가지 색상 순환
    const TArray<FLinearColor> Colors = {
        FLinearColor::Red,
        FLinearColor::Green,
        FLinearColor::Blue,
        FLinearColor::Yellow,
        FLinearColor(1.0f, 0.0f, 1.0f)  // Magenta
    };

    CurrentColorIndex = (CurrentColorIndex + 1) % Colors.Num();
    return Colors[CurrentColorIndex];
}

void ANetworkTestActor::LogMessage(const FString& Message, bool bWarning)
{
    if (bWarning)
    {
        UE_LOG(LogTemp, Warning, TEXT("[Network Test] %s"), *Message);
    }
    else
    {
        UE_LOG(LogTemp, Log, TEXT("[Network Test] %s"), *Message);
    }
}