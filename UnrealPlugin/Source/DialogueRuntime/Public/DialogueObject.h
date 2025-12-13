// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "DialogueTypes.h"
#include "DialogueObject.generated.h"

class UDialogueDatabase;
class UDialogueFlowPlayer;

/**
 * Base class for all dialogue objects
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueObject : public UDataAsset
{
	GENERATED_BODY()

public:
	/** Unique identifier */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Dialogue")
	FString Id;

	/** Technical name for scripting */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Dialogue")
	FString TechnicalName;

	/** Parent object ID */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Dialogue")
	FString ParentId;

	/** Child object IDs */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Dialogue")
	TArray<FString> ChildIds;

	/** Get the parent object */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	UDialogueObject* GetParent() const;

	/** Get child objects */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	TArray<UDialogueObject*> GetChildren() const;

protected:
	/** Database reference for lookups */
	UPROPERTY(Transient)
	mutable TWeakObjectPtr<UDialogueDatabase> CachedDatabase;

	UDialogueDatabase* GetDatabase() const;
};

/**
 * Interface for objects that can be traversed by the flow player
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UDialogueFlowObject : public UInterface
{
	GENERATED_BODY()
};

class DIALOGUERUNTIME_API IDialogueFlowObject
{
	GENERATED_BODY()

public:
	/** Get the pausable type of this node */
	virtual EDialoguePausableType GetPausableType() const = 0;

	/** Explore branches from this node */
	virtual void Explore(UDialogueFlowPlayer* Player, TArray<struct FDialogueBranch>& OutBranches, int32 Depth) = 0;

	/** Execute any script on this node */
	virtual void Execute(class UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) {}
};

/**
 * Interface for objects with text
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UDialogueObjectWithText : public UInterface
{
	GENERATED_BODY()
};

class DIALOGUERUNTIME_API IDialogueObjectWithText
{
	GENERATED_BODY()

public:
	virtual FText GetText() const = 0;
	virtual FText GetMenuText() const { return FText::GetEmpty(); }
	virtual FText GetStageDirections() const { return FText::GetEmpty(); }
};

/**
 * Interface for objects with a speaker
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UDialogueObjectWithSpeaker : public UInterface
{
	GENERATED_BODY()
};

class DIALOGUERUNTIME_API IDialogueObjectWithSpeaker
{
	GENERATED_BODY()

public:
	virtual FString GetSpeakerId() const = 0;
	virtual class UDialogueCharacter* GetSpeaker() const = 0;
};

/**
 * Interface for condition providers
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UDialogueConditionProvider : public UInterface
{
	GENERATED_BODY()
};

class DIALOGUERUNTIME_API IDialogueConditionProvider
{
	GENERATED_BODY()

public:
	virtual bool Evaluate(class UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) = 0;
};

/**
 * Interface for instruction providers
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UDialogueInstructionProvider : public UInterface
{
	GENERATED_BODY()
};

class DIALOGUERUNTIME_API IDialogueInstructionProvider
{
	GENERATED_BODY()

public:
	virtual void Execute(class UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) = 0;
};
