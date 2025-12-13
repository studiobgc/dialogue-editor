// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DialogueObject.h"
#include "DialoguePin.generated.h"

class UDialogueConnection;
class UDialogueNode;

/**
 * Base class for dialogue pins
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialoguePin : public UDialogueObject, public IDialogueFlowObject
{
	GENERATED_BODY()

public:
	/** Pin text/script */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Pin")
	FString Text;

	/** Owner node ID */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Pin")
	FString OwnerId;

	/** Pin index */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Pin")
	int32 Index = 0;

	/** Get the owner node */
	UFUNCTION(BlueprintCallable, Category = "Pin")
	UDialogueNode* GetOwner() const;

	// IDialogueFlowObject
	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Pin; }
	virtual void Explore(UDialogueFlowPlayer* Player, TArray<FDialogueBranch>& OutBranches, int32 Depth) override {}
};

/**
 * Input pin with condition
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueInputPin : public UDialoguePin, public IDialogueConditionProvider
{
	GENERATED_BODY()

public:
	/** Script to evaluate */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	FDialogueScript Script;

	// IDialogueConditionProvider
	virtual bool Evaluate(UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) override;

	virtual void Explore(UDialogueFlowPlayer* Player, TArray<FDialogueBranch>& OutBranches, int32 Depth) override;
};

/**
 * Output pin with instruction
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueOutputPin : public UDialoguePin, public IDialogueInstructionProvider
{
	GENERATED_BODY()

public:
	/** Connections from this pin */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Connections")
	TArray<UDialogueConnection*> Connections;

	/** Script to execute */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	FDialogueScript Script;

	/** Optional label */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Pin")
	FString Label;

	// IDialogueInstructionProvider
	virtual void Execute(UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) override;

	virtual void Explore(UDialogueFlowPlayer* Player, TArray<FDialogueBranch>& OutBranches, int32 Depth) override;
};

/**
 * Connection between pins
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueConnection : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Connection")
	FString TargetNodeId;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Connection")
	int32 TargetPinIndex = 0;

	UFUNCTION(BlueprintCallable, Category = "Connection")
	UDialogueNode* GetTargetNode() const;

	UFUNCTION(BlueprintCallable, Category = "Connection")
	UDialogueInputPin* GetTargetPin() const;
};
