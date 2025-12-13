// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DialogueObject.h"
#include "DialogueNode.generated.h"

class UDialoguePin;
class UDialogueInputPin;
class UDialogueOutputPin;

/**
 * Base class for all flow nodes
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueNode : public UDialogueObject, public IDialogueFlowObject
{
	GENERATED_BODY()

public:
	/** Input pins */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flow")
	TArray<UDialogueInputPin*> InputPins;

	/** Output pins */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flow")
	TArray<UDialogueOutputPin*> OutputPins;

	// IDialogueFlowObject interface
	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::None; }
	virtual void Explore(UDialogueFlowPlayer* Player, TArray<FDialogueBranch>& OutBranches, int32 Depth) override;
};

/**
 * A dialogue node containing text
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueDialogue : public UDialogueNode, public IDialogueObjectWithText, public IDialogueObjectWithSpeaker
{
	GENERATED_BODY()

public:
	/** Speaker ID */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FString SpeakerId;

	/** Dialogue text */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText Text;

	/** Menu text (for choices) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText MenuText;

	/** Stage directions */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText StageDirections;

	/** Auto transition to next node */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	bool bAutoTransition = false;

	// IDialogueFlowObject
	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Dialogue; }

	// IDialogueObjectWithText
	virtual FText GetText() const override { return Text; }
	virtual FText GetMenuText() const override { return MenuText; }
	virtual FText GetStageDirections() const override { return StageDirections; }

	// IDialogueObjectWithSpeaker
	virtual FString GetSpeakerId() const override { return SpeakerId; }
	virtual UDialogueCharacter* GetSpeaker() const override;
};

/**
 * A dialogue fragment (child of dialogue)
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueFragment : public UDialogueDialogue
{
	GENERATED_BODY()

public:
	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::DialogueFragment; }
};

/**
 * A flow fragment (container for dialogue)
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueFlowFragment : public UDialogueNode
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flow")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flow")
	FText Description;

	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::FlowFragment; }
};

/**
 * A hub node (branch point)
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueHub : public UDialogueNode
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flow")
	FString DisplayName;

	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Hub; }
};

/**
 * A condition node
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueCondition : public UDialogueNode, public IDialogueConditionProvider
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	FDialogueScript Script;

	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Condition; }

	// IDialogueConditionProvider
	virtual bool Evaluate(UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) override;
};

/**
 * An instruction node
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueInstruction : public UDialogueNode, public IDialogueInstructionProvider
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Script")
	FDialogueScript Script;

	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Instruction; }

	// IDialogueInstructionProvider
	virtual void Execute(UDialogueGlobalVariables* GV = nullptr, UObject* MethodProvider = nullptr) override;
};

/**
 * A jump node
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueJump : public UDialogueNode
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Jump")
	FString TargetNodeId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Jump")
	int32 TargetPinIndex = 0;

	virtual EDialoguePausableType GetPausableType() const override { return EDialoguePausableType::Jump; }

	UFUNCTION(BlueprintCallable, Category = "Jump")
	UDialogueNode* GetTargetNode() const;

	UFUNCTION(BlueprintCallable, Category = "Jump")
	UDialoguePin* GetTargetPin() const;

	virtual void Explore(UDialogueFlowPlayer* Player, TArray<FDialogueBranch>& OutBranches, int32 Depth) override;
};
