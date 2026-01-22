// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "TCPClient.generated.h"

UCLASS()
class UNREAL_CLIENT_API ATCPClient : public AActor
{
	GENERATED_BODY()
	
public:	
	// Sets default values for this actor's properties
	ATCPClient();

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
		
public:	
	// Called every frame
	virtual void Tick(float DeltaTime) override;

public:

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    FString ServerIP = TEXT("127.0.0.1");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    int32 ServerPort = 12793;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "TCP Client")
    bool bAutoConnect = true;

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    bool ConnectToServer();

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    void DisconnectFromServer();

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    bool IsConnected() const;

    UFUNCTION(BlueprintCallable, Category = "TCP Client")
    bool SendMessage(const FString& Message);

    UPROPERTY(BlueprintReadOnly, Category = "TCP Client")
    TArray<FString> ReceivedMessages;

protected:

	FSocket* ClientSocket;
	ISocketSubsystem* SocketSubsystem;

	TArray<uint8> ReceiveBuffer;

	void ReceiveData();

	void LogMessage(const FString& Message, bool bIsError = false);
};
