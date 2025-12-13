// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DialogueTypes.generated.h"

/**
 * 128-bit ID compatible with external dialogue editors
 */
USTRUCT(BlueprintType)
struct DIALOGUERUNTIME_API FDialogueId
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	int64 Low = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	int64 High = 0;

	FDialogueId() = default;
	FDialogueId(int64 InLow, int64 InHigh) : Low(InLow), High(InHigh) {}

	bool IsValid() const { return Low != 0 || High != 0; }
	
	bool operator==(const FDialogueId& Other) const
	{
		return Low == Other.Low && High == Other.High;
	}

	bool operator!=(const FDialogueId& Other) const
	{
		return !(*this == Other);
	}

	friend uint32 GetTypeHash(const FDialogueId& Id)
	{
		return HashCombine(GetTypeHash(Id.Low), GetTypeHash(Id.High));
	}

	FString ToString() const
	{
		return FString::Printf(TEXT("0x%016llX%016llX"), High, Low);
	}

	static FDialogueId FromString(const FString& Str)
	{
		FDialogueId Result;
		// Parse hex string
		FString Clean = Str.Replace(TEXT("0x"), TEXT(""));
		if (Clean.Len() >= 32)
		{
			FString HighStr = Clean.Left(16);
			FString LowStr = Clean.Right(16);
			Result.High = FCString::Strtoui64(*HighStr, nullptr, 16);
			Result.Low = FCString::Strtoui64(*LowStr, nullptr, 16);
		}
		return Result;
	}
};

/**
 * Reference to a dialogue object
 */
USTRUCT(BlueprintType)
struct DIALOGUERUNTIME_API FDialogueRef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FDialogueId Id;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	int32 CloneId = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	bool bReferenceBaseObject = true;

	bool IsValid() const { return Id.IsValid(); }

	int32 GetEffectiveCloneId() const
	{
		return bReferenceBaseObject ? 0 : CloneId;
	}
};

/**
 * Types of pausable flow nodes
 */
UENUM(BlueprintType, meta = (Bitflags))
enum class EDialoguePausableType : uint8
{
	None = 0,
	FlowFragment = 1 << 0,
	Dialogue = 1 << 1,
	DialogueFragment = 1 << 2,
	Hub = 1 << 3,
	Jump = 1 << 4,
	Condition = 1 << 5,
	Instruction = 1 << 6,
	Pin = 1 << 7
};
ENUM_CLASS_FLAGS(EDialoguePausableType);

/**
 * Variable types
 */
UENUM(BlueprintType)
enum class EDialogueVariableType : uint8
{
	Boolean,
	Integer,
	String
};

/**
 * A script fragment (condition or instruction)
 */
USTRUCT(BlueprintType)
struct DIALOGUERUNTIME_API FDialogueScript
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	FString Expression;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	bool bIsCondition = false;
};
