// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "DialogueTypes.h"
#include "DialogueFlowPlayer.generated.h"

class UDialogueNode;
class UDialogueDatabase;
class UDialogueGlobalVariables;
class IDialogueFlowObject;

/**
 * Represents a branch in the dialogue flow
 */
USTRUCT(BlueprintType)
struct DIALOGUERUNTIME_API FDialogueBranch
{
	GENERATED_BODY()

	/** The path of nodes in this branch */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Branch")
	TArray<UDialogueNode*> Path;

	/** Whether this branch is valid (all conditions passed) */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Branch")
	bool bIsValid = true;

	/** Branch index */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Branch")
	int32 Index = -1;

	/** Get the target node (last in path) */
	UDialogueNode* GetTarget() const
	{
		return Path.Num() > 0 ? Path.Last() : nullptr;
	}
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialoguePlayerPaused, UDialogueNode*, PausedOn);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialogueBranchesUpdated, const TArray<FDialogueBranch>&, AvailableBranches);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDialogueShadowOpStart);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDialogueShadowOpEnd);

/**
 * Flow player component for traversing dialogue graphs
 */
UCLASS(BlueprintType, ClassGroup = "Dialogue", meta = (BlueprintSpawnableComponent))
class DIALOGUERUNTIME_API UDialogueFlowPlayer : public UActorComponent
{
	GENERATED_BODY()

public:
	UDialogueFlowPlayer();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	// ==================== SETUP ====================

	/** Which node types to pause on (bitmask) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Setup", meta = (Bitmask, BitmaskEnum = "/Script/DialogueRuntime.EDialoguePausableType"))
	uint8 PauseOn = (1 << (uint8)EDialoguePausableType::DialogueFragment) |
	                (1 << (uint8)EDialoguePausableType::Dialogue) |
	                (1 << (uint8)EDialoguePausableType::FlowFragment);

	/** The starting node reference */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Setup")
	FDialogueRef StartOn;

	/** Override global variables (null = use default) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Setup")
	UDialogueGlobalVariables* OverrideGlobalVariables;

	/** User methods provider object */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Setup")
	UObject* UserMethodsProvider;

	/** Ignore invalid branches in available branches */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Setup")
	bool bIgnoreInvalidBranches = true;

	/** Maximum exploration depth */
	UPROPERTY(EditAnywhere, Category = "Setup", meta = (ClampMin = 1))
	int32 ExploreLimit = 128;

	/** Maximum shadow levels */
	UPROPERTY(EditAnywhere, Category = "Setup")
	uint8 ShadowLevelLimit = 10;

	// ==================== FLOW CONTROL ====================

	/** Set the start node */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void SetStartNode(FDialogueRef NewStartNode);

	/** Set the start node by ID */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void SetStartNodeById(const FString& NodeId);

	/** Set cursor to a node */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void SetCursorTo(UDialogueNode* Node);

	/** Get the current cursor position */
	UFUNCTION(BlueprintPure, Category = "Flow")
	UDialogueNode* GetCursor() const { return Cursor; }

	/** Play a branch by index */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void Play(int32 BranchIndex = 0);

	/** Play a specific branch */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void PlayBranch(const FDialogueBranch& Branch);

	/** Finish the current paused object (execute output pin) */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void FinishCurrentPausedObject(int32 PinIndex = 0);

	/** Update available branches from current position */
	UFUNCTION(BlueprintCallable, Category = "Flow")
	void UpdateAvailableBranches();

	/** Get currently available branches */
	UFUNCTION(BlueprintPure, Category = "Flow")
	const TArray<FDialogueBranch>& GetAvailableBranches() const { return AvailableBranches; }

	/** Check if should pause on a node type */
	UFUNCTION(BlueprintPure, Category = "Flow")
	bool ShouldPauseOn(UDialogueNode* Node) const;

	// ==================== GLOBAL VARIABLES ====================

	/** Get the global variables for this flow player */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueGlobalVariables* GetGlobalVariables() const;

	/** Get the methods provider */
	UFUNCTION(BlueprintPure, Category = "Setup")
	UObject* GetMethodsProvider() const;

	// ==================== SHADOW STATE ====================

	/** Get current shadow level */
	uint32 GetShadowLevel() const { return ShadowLevel; }

	/** Execute an operation in shadow state */
	template<typename Lambda>
	void ShadowedOperation(Lambda Operation) const;

	// ==================== EVENTS ====================

	/** Called when the player pauses on a node */
	UPROPERTY(BlueprintAssignable, Category = "Events")
	FOnDialoguePlayerPaused OnPlayerPaused;

	/** Called when available branches change */
	UPROPERTY(BlueprintAssignable, Category = "Events")
	FOnDialogueBranchesUpdated OnBranchesUpdated;

	/** Called when shadow operation starts */
	UPROPERTY(BlueprintAssignable, Category = "Events")
	FOnDialogueShadowOpStart OnShadowOpStart;

	/** Called when shadow operation ends */
	UPROPERTY(BlueprintAssignable, Category = "Events")
	FOnDialogueShadowOpEnd OnShadowOpEnd;

protected:
	/** Current position in the flow */
	UPROPERTY(Transient)
	UDialogueNode* Cursor = nullptr;

	/** Available branches from current position */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flow")
	TArray<FDialogueBranch> AvailableBranches;

	/** Current shadow level */
	UPROPERTY(Transient, VisibleAnywhere, Category = "Debug")
	mutable uint32 ShadowLevel = 0;

private:
	/** Get the database */
	UDialogueDatabase* GetDatabase() const;

	/** Set cursor to start node */
	void SetCursorToStartNode();

	/** Fast forward to next pause point */
	bool FastForwardToPause();

	/** Internal branch update */
	void UpdateAvailableBranchesInternal(bool bIsStartup);

	/** Explore branches from a node */
	TArray<FDialogueBranch> Explore(IDialogueFlowObject* Node, bool bShadowed, int32 Depth, bool bIncludeCurrent = true);
};

// Template implementation
template<typename Lambda>
void UDialogueFlowPlayer::ShadowedOperation(Lambda Operation) const
{
	if (!GetGlobalVariables())
	{
		UE_LOG(LogTemp, Warning, TEXT("FlowPlayer cannot get GlobalVariables!"));
		return;
	}

	if (ShadowLevel >= ShadowLevelLimit)
	{
		UE_LOG(LogTemp, Warning, TEXT("Too many nested ShadowedOperations, possible infinite loop!"));
		return;
	}

	// Push shadow state
	++ShadowLevel;

	// Notify
	GetGlobalVariables()->PushState(ShadowLevel);
	const_cast<UDialogueFlowPlayer*>(this)->OnShadowOpStart.Broadcast();

	// Execute operation
	Operation();

	// Pop shadow state
	const_cast<UDialogueFlowPlayer*>(this)->OnShadowOpEnd.Broadcast();
	GetGlobalVariables()->PopState(ShadowLevel);

	if (ShadowLevel > 0)
	{
		--ShadowLevel;
	}
}
