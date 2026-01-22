// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "NetworkStruct.h"
#include "TCPClientJSON.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPositionUpdateReceived, const FPositionUpdateData, Data);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnColorChangeReceived, const FColorChangeData, Data);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnChatMessageReceived, const FString&, ClientId, const FString&, Message);

UCLASS()
class UNREAL_CLIENT_API ATCPClientJSON : public AActor
{
	GENERATED_BODY()
	
public:	
	// Sets default values for this actor's properties
	ATCPClientJSON();

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

public:	
	// Called every frame
	virtual void Tick(float DeltaTime) override;
   
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    FString ServerIP = TEXT("127.0.0.1");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    int32 ServerPort = 12793;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    bool bAutoConnect = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    FString ClientIdentifier = TEXT("unreal_client");

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    bool ConnectToServer();

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    void DisconnectFromServer();

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    bool IsConnected() const;

    UFUNCTION(BlueprintCallable, Category = "TCP Client|Messages")
    bool SendPositionUpdate(const FString& ObjectId, FVector Position, FRotator Rotation);

    UFUNCTION(BlueprintCallable, Category = "TCP Client|Messages")
    bool SendColorChange(const FString& ObjectId, FLinearColor Color);

    UFUNCTION(BlueprintCallable, Category = "TCP Client|Messages")
    bool SendChatMessage(const FString& Message);

    UFUNCTION(BlueprintCallable, Category = "TCP Client|Messages")
    bool SendCustomMessage(const FString& MessageType, const FString& JsonData);

    UPROPERTY(BlueprintAssignable, Category = "TCP Client|Events")
    FOnPositionUpdateReceived OnPositionUpdateReceived;

    UPROPERTY(BlueprintAssignable, Category = "TCP Client|Events")
    FOnColorChangeReceived OnColorChangeReceived;

    UPROPERTY(BlueprintAssignable, Category = "TCP Client|Events")
    FOnChatMessageReceived OnChatMessageReceived;

protected:

    FSocket* ClientSocket;
    ISocketSubsystem* SocketSubsystem;

    TArray<uint8> ReceiveBuffer;
    FString MessageBuffer;

    void ReceiveData();
    void ProcessMessage(const FString& JsonString);

    FString CreateJsonMessage(const FString& Type, const FString& DataJson);

    bool ParsePositionUpdate(const TSharedPtr<FJsonObject>& DataObject, FPositionUpdateData& OutData);
    bool ParseColorChange(const TSharedPtr<FJsonObject>& DataObject, FColorChangeData& OutData);

    void LogMessage(const FString& Message, bool bIsError = false);

    int64 GetCurrentTimestamp() const;
};
