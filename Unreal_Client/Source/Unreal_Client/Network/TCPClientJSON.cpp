// Fill out your copyright notice in the Description page of Project Settings.


#include "TCPClientJSON.h"
#include "Networking.h"
#include "Json.h"
#include "JsonUtilities.h"

// Sets default values
ATCPClientJSON::ATCPClientJSON()
{
 	// Set this actor to call Tick() every frame.  You can turn this off to improve performance if you don't need it.
	PrimaryActorTick.bCanEverTick = true;

    ClientSocket = nullptr;
    SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);

    ReceiveBuffer.SetNum(4096);

}

// Called when the game starts or when spawned
void ATCPClientJSON::BeginPlay()
{
	Super::BeginPlay();
	
    if (bAutoConnect)
    {
        ConnectToServer();
    }
}

void ATCPClientJSON::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    DisconnectFromServer();
    Super::EndPlay(EndPlayReason);
}

// Called every frame
void ATCPClientJSON::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

    if (IsConnected())
    {
        ReceiveData();
    }
}

bool ATCPClientJSON::ConnectToServer()
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

void ATCPClientJSON::DisconnectFromServer()
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

bool ATCPClientJSON::IsConnected() const
{
    return ClientSocket && ClientSocket->GetConnectionState() == SCS_Connected;
}

bool ATCPClientJSON::SendPositionUpdate(const FString& ObjectId, FVector Position, FRotator Rotation)
{
    FString DataJson = FString::Printf(TEXT(
        "\"objectId\": \"%s\","
        "\"position\": { \"x\": %.2f, \"y\": %.2f, \"z\": %.2f },"
        "\"rotation\": { \"x\": %.2f, \"y\": %.2f, \"z\": %.2f }"
    ),
        *ObjectId,
        Position.X, Position.Y, Position.Z,
        Rotation.Roll, Rotation.Pitch, Rotation.Yaw
    );

    FString JsonMessage = CreateJsonMessage(TEXT("position_update"), DataJson);

    if (!IsConnected())
    {
        LogMessage(TEXT("Cannot send message: Not connected"), true);
        return false;
    }

    FTCHARToUTF8 UTF8String(*JsonMessage);
    TArray<uint8> SendData;
    SendData.Append((uint8*)UTF8String.Get(), UTF8String.Length());
    SendData.Add('\n');

    int32 BytesSent = 0;
    if (ClientSocket->Send(SendData.GetData(), SendData.Num(), BytesSent))
    {
        LogMessage(FString::Printf(TEXT("Sent position update for %s"), *ObjectId));
        return true;
    }

    return false;
}

bool ATCPClientJSON::SendColorChange(const FString& ObjectId, FLinearColor Color)
{
    FNetworkColor NetColor(Color);

    FString DataJson = FString::Printf(TEXT(
        "\"objectId\": \"%s\","
        "\"color\": { \"r\": %d, \"g\": %d, \"b\": %d, \"a\": %d }"
    ),
        *ObjectId,
        NetColor.r, NetColor.g, NetColor.b, NetColor.a
    );

    FString JsonMessage = CreateJsonMessage(TEXT("color_change"), DataJson);

    if (!IsConnected())
    {
        LogMessage(TEXT("Cannot send message: Not connected"), true);
        return false;
    }

    FTCHARToUTF8 UTF8String(*JsonMessage);
    TArray<uint8> SendData;
    SendData.Append((uint8*)UTF8String.Get(), UTF8String.Length());
    SendData.Add('\n');

    int32 BytesSent = 0;
    if (ClientSocket->Send(SendData.GetData(), SendData.Num(), BytesSent))
    {
        LogMessage(FString::Printf(TEXT("Sent color change for %s"), *ObjectId));
        return true;
    }

    return false;
}

bool ATCPClientJSON::SendChatMessage(const FString& Message)
{
    FString DataJson = FString::Printf(TEXT("\"message\": \"%s\""), *Message);
    FString JsonMessage = CreateJsonMessage(TEXT("chat_message"), DataJson);

    if (!IsConnected())
    {
        LogMessage(TEXT("Cannot send message: Not connected"), true);
        return false;
    }

    FTCHARToUTF8 UTF8String(*JsonMessage);
    TArray<uint8> SendData;
    SendData.Append((uint8*)UTF8String.Get(), UTF8String.Length());
    SendData.Add('\n');

    int32 BytesSent = 0;
    if (ClientSocket->Send(SendData.GetData(), SendData.Num(), BytesSent))
    {
        LogMessage(FString::Printf(TEXT("Sent chat: %s"), *Message));
        return true;
    }

    return false;
}

bool ATCPClientJSON::SendCustomMessage(const FString& MessageType, const FString& JsonData)
{
    FString JsonMessage = CreateJsonMessage(MessageType, JsonData);

    if (!IsConnected())
    {
        LogMessage(TEXT("Cannot send message: Not connected"), true);
        return false;
    }

    FTCHARToUTF8 UTF8String(*JsonMessage);
    TArray<uint8> SendData;
    SendData.Append((uint8*)UTF8String.Get(), UTF8String.Length());
    SendData.Add('\n');

    int32 BytesSent = 0;
    return ClientSocket->Send(SendData.GetData(), SendData.Num(), BytesSent);
}

FString ATCPClientJSON::CreateJsonMessage(const FString& Type, const FString& DataJson)
{
    return FString::Printf(TEXT(
        "{"
        "\"type\": \"%s\","
        "\"timestamp\": %lld,"
        "\"clientId\": \"%s\","
        "\"data\": { %s }"
        "}"
    ),
        *Type,
        GetCurrentTimestamp(),
        *ClientIdentifier,
        *DataJson
    );
}

void ATCPClientJSON::ReceiveData()
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
                FString ReceivedData = UTF8_TO_TCHAR((const ANSICHAR*)ReceiveBuffer.GetData());

                MessageBuffer += ReceivedData;

                TArray<FString> Messages;
                MessageBuffer.ParseIntoArray(Messages, TEXT("\n"), false);

                if (MessageBuffer.EndsWith(TEXT("\n")))
                {
                    MessageBuffer.Empty();
                }
                else if (Messages.Num() > 0)
                {
                    MessageBuffer = Messages.Last();
                    Messages.RemoveAt(Messages.Num() - 1);
                }

                for (const FString& Message : Messages)
                {
                    if (!Message.IsEmpty())
                    {
                        ProcessMessage(Message);
                    }
                }
            }
        }
    }
}

void ATCPClientJSON::ProcessMessage(const FString& JsonString)
{
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);

    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        LogMessage(TEXT("Failed to parse JSON"), true);
        return;
    }

    FString MessageType = JsonObject->GetStringField(TEXT("type"));

    LogMessage(FString::Printf(TEXT("Received: %s"), *MessageType));

    const TSharedPtr<FJsonObject>* DataObject;
    if (!JsonObject->TryGetObjectField(TEXT("data"), DataObject))
    {
        return;
    }

    if (MessageType == TEXT("position_update"))
    {
        FPositionUpdateData Data;
        if (ParsePositionUpdate(*DataObject, Data))
        {
            OnPositionUpdateReceived.Broadcast(Data);
        }
    }
    else if (MessageType == TEXT("color_change"))
    {
        FColorChangeData Data;
        if (ParseColorChange(*DataObject, Data))
        {
            OnColorChangeReceived.Broadcast(Data);
        }
    }
    else if (MessageType == TEXT("chat_message"))
    {
        FString ClientId = JsonObject->GetStringField(TEXT("clientId"));
        FString Message = (*DataObject)->GetStringField(TEXT("message"));
        OnChatMessageReceived.Broadcast(ClientId, Message);
    }
}

bool ATCPClientJSON::ParsePositionUpdate(const TSharedPtr<FJsonObject>& DataObject, FPositionUpdateData& OutData)
{
    OutData.objectId = DataObject->GetStringField(TEXT("objectId"));

    const TSharedPtr<FJsonObject>* PosObj;
    if (DataObject->TryGetObjectField(TEXT("position"), PosObj))
    {
        OutData.position.x = (*PosObj)->GetNumberField(TEXT("x"));
        OutData.position.y = (*PosObj)->GetNumberField(TEXT("y"));
        OutData.position.z = (*PosObj)->GetNumberField(TEXT("z"));
    }

    const TSharedPtr<FJsonObject>* RotObj;
    if (DataObject->TryGetObjectField(TEXT("rotation"), RotObj))
    {
        OutData.rotation.x = (*RotObj)->GetNumberField(TEXT("x"));
        OutData.rotation.y = (*RotObj)->GetNumberField(TEXT("y"));
        OutData.rotation.z = (*RotObj)->GetNumberField(TEXT("z"));
    }

    return true;
}

bool ATCPClientJSON::ParseColorChange(const TSharedPtr<FJsonObject>& DataObject, FColorChangeData& OutData)
{
    OutData.objectId = DataObject->GetStringField(TEXT("objectId"));

    const TSharedPtr<FJsonObject>* ColorObj;
    if (DataObject->TryGetObjectField(TEXT("color"), ColorObj))
    {
        OutData.color.r = (*ColorObj)->GetIntegerField(TEXT("r"));
        OutData.color.g = (*ColorObj)->GetIntegerField(TEXT("g"));
        OutData.color.b = (*ColorObj)->GetIntegerField(TEXT("b"));
        OutData.color.a = (*ColorObj)->GetIntegerField(TEXT("a"));
    }

    return true;
}

void ATCPClientJSON::LogMessage(const FString& Message, bool bIsError)
{
    if (bIsError)
    {
        UE_LOG(LogTemp, Error, TEXT("[TCP Client JSON] %s"), *Message);
    }
    else
    {
        UE_LOG(LogTemp, Log, TEXT("[TCP Client JSON] %s"), *Message);
    }
}

int64 ATCPClientJSON::GetCurrentTimestamp() const
{
    return FDateTime::UtcNow().ToUnixTimestamp() * 1000;
}