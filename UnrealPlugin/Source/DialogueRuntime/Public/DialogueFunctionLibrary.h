// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "DialogueTypes.h"
#include "DialogueFunctionLibrary.generated.h"

class UDialogueDatabase;
class UDialogueObject;
class UDialogueNode;
class UDialogueCharacter;
class UDialogueGlobalVariables;

/**
 * Blueprint function library for dialogue system
 */
UCLASS()
class DIALOGUERUNTIME_API UDialogueFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// ==================== DATABASE ACCESS ====================

	/** Get the dialogue database */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (WorldContext = "WorldContext"))
	static UDialogueDatabase* GetDialogueDatabase(const UObject* WorldContext);

	/** Get an object by ID */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (WorldContext = "WorldContext", DeterminesOutputType = "Class"))
	static UDialogueObject* GetDialogueObject(const UObject* WorldContext, const FString& Id, TSubclassOf<UDialogueObject> Class = nullptr);

	/** Get an object by reference */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (WorldContext = "WorldContext", DeterminesOutputType = "Class"))
	static UDialogueObject* GetDialogueObjectFromRef(const UObject* WorldContext, const FDialogueRef& Ref, TSubclassOf<UDialogueObject> Class = nullptr);

	// ==================== GLOBAL VARIABLES ====================

	/** Get global variables */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static UDialogueGlobalVariables* GetGlobalVariables(const UObject* WorldContext);

	/** Get a boolean variable */
	UFUNCTION(BlueprintPure, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static bool GetBoolVariable(const UObject* WorldContext, const FString& FullName);

	/** Set a boolean variable */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static void SetBoolVariable(const UObject* WorldContext, const FString& FullName, bool Value);

	/** Get an integer variable */
	UFUNCTION(BlueprintPure, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static int32 GetIntVariable(const UObject* WorldContext, const FString& FullName);

	/** Set an integer variable */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static void SetIntVariable(const UObject* WorldContext, const FString& FullName, int32 Value);

	/** Get a string variable */
	UFUNCTION(BlueprintPure, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static FString GetStringVariable(const UObject* WorldContext, const FString& FullName);

	/** Set a string variable */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Variables", meta = (WorldContext = "WorldContext"))
	static void SetStringVariable(const UObject* WorldContext, const FString& FullName, const FString& Value);

	// ==================== ID UTILITIES ====================

	/** Create a dialogue ID from high/low values */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static FDialogueId MakeDialogueId(int64 Low, int64 High);

	/** Create a dialogue reference */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static FDialogueRef MakeDialogueRef(FDialogueId Id, int32 CloneId = 0);

	/** Check if a dialogue ID is valid */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static bool IsDialogueIdValid(const FDialogueId& Id);

	/** Check if a dialogue reference is valid */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static bool IsDialogueRefValid(const FDialogueRef& Ref);

	/** Convert dialogue ID to string */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static FString DialogueIdToString(const FDialogueId& Id);

	/** Parse dialogue ID from string */
	UFUNCTION(BlueprintPure, Category = "Dialogue|ID")
	static FDialogueId StringToDialogueId(const FString& Str);

	// ==================== INTERFACE QUERIES ====================

	/** Get text from an object that implements IDialogueObjectWithText */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Interfaces")
	static FText GetDialogueText(UDialogueObject* Object);

	/** Get speaker from an object that implements IDialogueObjectWithSpeaker */
	UFUNCTION(BlueprintCallable, Category = "Dialogue|Interfaces", meta = (WorldContext = "WorldContext"))
	static UDialogueCharacter* GetDialogueSpeaker(const UObject* WorldContext, UDialogueObject* Object);

	/** Check if object is a flow object */
	UFUNCTION(BlueprintPure, Category = "Dialogue|Interfaces")
	static bool IsFlowObject(UDialogueObject* Object);

	/** Get pausable type of a flow object */
	UFUNCTION(BlueprintPure, Category = "Dialogue|Interfaces")
	static EDialoguePausableType GetPausableType(UDialogueObject* Object);
};
