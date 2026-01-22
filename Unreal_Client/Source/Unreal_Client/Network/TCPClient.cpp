// Fill out your copyright notice in the Description page of Project Settings.


#include "TCPClient.h"
#include "Networking.h"

// Sets default values
ATCPClient::ATCPClient()
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	PrimaryActorTick.bCanEverTick = true;

	ClientSocket = nullptr;
	SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);

	ReceiveBuffer.SetNum(4096);
}

// Called when the game starts or when spawned
void ATCPClient::BeginPlay()
{
	Super::BeginPlay();
	
	if (bAutoConnect)
	{
		ConnectToServer();
	}
}

void ATCPClient::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	DisconnectFromServer();
	Super::EndPlay(EndPlayReason);
}

// Called every frame
void ATCPClient::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (IsConnected())
	{
		ReceiveData();
	}
}

bool ATCPClient::ConnectToServer()
{
	if (ClientSocket && ClientSocket->GetConnectionState() == SCS_Connected)
	{
		LogMessage(TEXT("Already connected to server"));
		return true;
	}

	DisconnectFromServer();

	FIPv4Address IPAddress;
	if (!FIPv4Address::Parse(ServerIP, IPAddress))
	{
		LogMessage(FString::Printf(TEXT("Invalid IP address: %s"), *ServerIP), true);
		return false;
	}

	TSharedRef<FInternetAddr> Addr = SocketSubsystem->CreateInternetAddr();
	Addr->SetIp(IPAddress.Value);
	Addr->SetPort(ServerPort);

	ClientSocket = SocketSubsystem->CreateSocket(NAME_Stream, TEXT("TCPClientSocket"), false);

	if (!ClientSocket)
	{
		LogMessage(TEXT("Failed to create socket"), true);
		return false;
	}

	ClientSocket->SetNonBlocking(true);

	LogMessage(FString::Printf(TEXT("Connecting to %s:%d..."), *ServerIP, ServerPort));

	if (ClientSocket->Connect(*Addr))
	{
		LogMessage(TEXT("Connected to server successfully!"));
		return true;
	}
	else
	{
		ESocketErrors LastError = SocketSubsystem->GetLastErrorCode();
		if (LastError == SE_EWOULDBLOCK || LastError == SE_EINPROGRESS)
		{
			LogMessage(TEXT("Connection in progress..."));
			return true;
		}
		else
		{
			LogMessage(FString::Printf(TEXT("Connection failed: %d"), (int32)LastError), true);
			DisconnectFromServer();
			return false;
		}
	}
}

void ATCPClient::DisconnectFromServer()
{
	if (ClientSocket)
	{
		LogMessage(TEXT("Disconnecting from server..."));

		ClientSocket->Close();
		SocketSubsystem->DestroySocket(ClientSocket);
		ClientSocket = nullptr;

		LogMessage(TEXT("Disconnected"));
	}
}

bool ATCPClient::IsConnected() const
{
	return ClientSocket && ClientSocket->GetConnectionState() == SCS_Connected;
}

bool ATCPClient::SendMessage(const FString& Message)
{
	if (!IsConnected())
	{
		LogMessage(TEXT("Cannot send message: Not connected"), true);
		return false;
	}

	FTCHARToUTF8 UTF8String(*Message);
	const uint8* Data = (const uint8*)UTF8String.Get();
	int32 DataSize = UTF8String.Length();

	TArray<uint8> SendData;
	SendData.Append(Data, DataSize);
	SendData.Add('\n');

	int32 BytesSent = 0;
	if (ClientSocket->Send(SendData.GetData(), SendData.Num(), BytesSent))
	{
		LogMessage(FString::Printf(TEXT("Sent: %s (%d bytes)"), *Message, BytesSent));
		return true;
	}
	else
	{
		ESocketErrors LastError = SocketSubsystem->GetLastErrorCode();
		LogMessage(FString::Printf(TEXT("Failed to send message: %d"), (int32)LastError), true);
		return false;
	}
}

void ATCPClient::ReceiveData()
{
	if (!ClientSocket)
		return;

	uint32 PendingDataSize = 0;

	if (ClientSocket->HasPendingData(PendingDataSize))
	{
		int32 BytesRead = 0;

		if (ClientSocket->Recv(ReceiveBuffer.GetData(), ReceiveBuffer.Num() - 1, BytesRead))
		{
			if (BytesRead > 0)
			{
				ReceiveBuffer[BytesRead] = 0;

				FString ReceivedMessage = UTF8_TO_TCHAR((const ANSICHAR*)ReceiveBuffer.GetData());

				ReceivedMessage.TrimEndInline();

				ReceivedMessages.Add(ReceivedMessage);
				LogMessage(FString::Printf(TEXT("Received: %s"), *ReceivedMessage));

				if (ReceivedMessages.Num() > 100)
				{
					ReceivedMessages.RemoveAt(0);
				}
			}
		}
	}
}

void ATCPClient::LogMessage(const FString& Message, bool bIsError)
{
	if (bIsError)
	{
		UE_LOG(LogTemp, Error, TEXT("[TCP Client] %s"), *Message);
	}
	else
	{
		UE_LOG(LogTemp, Log, TEXT("[TCP Client] %s"), *Message);
	}
}
