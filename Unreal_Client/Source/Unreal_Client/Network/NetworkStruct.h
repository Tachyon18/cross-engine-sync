// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NetworkStruct.generated.h"

// Create variable names in Camel style for compatibility with Json and c# styles

USTRUCT(BlueprintType)
struct FNetworkVector3
{
    GENERATED_BODY()

public:

    UPROPERTY(BlueprintReadWrite)
    float x = 0.0f;

    UPROPERTY(BlueprintReadWrite)
    float y = 0.0f;

    UPROPERTY(BlueprintReadWrite)
    float z = 0.0f;

    FNetworkVector3() {}
    FNetworkVector3(float InX, float InY, float InZ) : x(InX), y(InY), z(InZ) {}
    FNetworkVector3(const FVector& Vec) : x(Vec.X), y(Vec.Y), z(Vec.Z) {}

    FVector ToFVector() const { return FVector(x, y, z); }
};

USTRUCT(BlueprintType)
struct FNetworkColor
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadWrite)
    int32 r = 255;

    UPROPERTY(BlueprintReadWrite)
    int32 g = 255;

    UPROPERTY(BlueprintReadWrite)
    int32 b = 255;

    UPROPERTY(BlueprintReadWrite)
    int32 a = 255;

    FNetworkColor() {}
    FNetworkColor(int32 InR, int32 InG, int32 InB, int32 InA = 255)
        : r(InR), g(InG), b(InB), a(InA) {
    }
    FNetworkColor(const FLinearColor& Color)
        : r(FMath::RoundToInt(Color.R * 255))
        , g(FMath::RoundToInt(Color.G * 255))
        , b(FMath::RoundToInt(Color.B * 255))
        , a(FMath::RoundToInt(Color.A * 255)) {
    }

    FLinearColor ToLinearColor() const
    {
        return FLinearColor(r / 255.0f, g / 255.0f, b / 255.0f, a / 255.0f);
    }
};

USTRUCT(BlueprintType)
struct FPositionUpdateData
{
    GENERATED_BODY()

public:

    UPROPERTY(BlueprintReadWrite)
    FString objectId;

    UPROPERTY(BlueprintReadWrite)
    FNetworkVector3 position;

    UPROPERTY(BlueprintReadWrite)
    FNetworkVector3 rotation;
};

USTRUCT(BlueprintType)
struct FColorChangeData
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadWrite)
    FString objectId;

    UPROPERTY(BlueprintReadWrite)
    FNetworkColor color;
};

USTRUCT(BlueprintType)
struct FChatMessageData
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadWrite)
    FString message;
};

USTRUCT(BlueprintType)
struct FNetworkMessage
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadWrite)
    FString type;

    UPROPERTY(BlueprintReadWrite)
    int64 timestamp = 0;

    UPROPERTY(BlueprintReadWrite)
    FString clientId;

};

UCLASS()
class UNREAL_CLIENT_API ANetworkStruct : public AActor
{
	GENERATED_BODY()
	
public:	
	// Sets default values for this actor's properties
	ANetworkStruct();

protected:
	// Called when the game starts or when spawned
	virtual void BeginPlay() override;

public:	
	// Called every frame
	virtual void Tick(float DeltaTime) override;

};
