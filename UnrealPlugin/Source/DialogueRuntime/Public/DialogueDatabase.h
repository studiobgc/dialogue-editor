// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "DialogueTypes.h"
#include "DialogueDatabase.generated.h"

class UDialogueObject;
class UDialogueNode;
class UDialogueCharacter;
class UDialoguePackage;
class UDialogueGlobalVariables;

/**
 * Central database for accessing all dialogue objects
 */
UCLASS(BlueprintType, Config = Game)
class DIALOGUERUNTIME_API UDialogueDatabase : public UDataAsset
{
	GENERATED_BODY()

public:
	UDialogueDatabase();

	/** Get the database instance for the current world */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (WorldContext = "WorldContext"))
	static UDialogueDatabase* Get(const UObject* WorldContext);

	/** Initialize the database */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	void Initialize();

	/** Deinitialize the database */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	void Deinitialize();

	// ==================== OBJECT ACCESS ====================

	/** Get an object by ID */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (DeterminesOutputType = "Class"))
	UDialogueObject* GetObject(const FString& Id, TSubclassOf<UDialogueObject> Class = nullptr) const;

	/** Get an object by technical name */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (DeterminesOutputType = "Class"))
	UDialogueObject* GetObjectByName(const FString& TechnicalName, TSubclassOf<UDialogueObject> Class = nullptr) const;

	/** Get all objects of a specific class */
	UFUNCTION(BlueprintCallable, Category = "Dialogue", meta = (DeterminesOutputType = "Class"))
	TArray<UDialogueObject*> GetObjectsOfClass(TSubclassOf<UDialogueObject> Class) const;

	/** Get all objects */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	TArray<UDialogueObject*> GetAllObjects() const;

	// ==================== CHARACTERS ====================

	/** Get a character by ID */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	UDialogueCharacter* GetCharacter(const FString& Id) const;

	/** Get a character by technical name */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	UDialogueCharacter* GetCharacterByName(const FString& TechnicalName) const;

	/** Get all characters */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	TArray<UDialogueCharacter*> GetAllCharacters() const;

	// ==================== GLOBAL VARIABLES ====================

	/** Get the global variables instance */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	UDialogueGlobalVariables* GetGlobalVariables() const;

	// ==================== PACKAGES ====================

	/** Load a package by name */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	void LoadPackage(const FString& PackageName);

	/** Unload a package by name */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	bool UnloadPackage(const FString& PackageName);

	/** Load all default packages */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	void LoadDefaultPackages();

	/** Get loaded package names */
	UFUNCTION(BlueprintCallable, Category = "Dialogue")
	TArray<FString> GetLoadedPackageNames() const;

	// ==================== SHADOW STATE (for flow player) ====================

	/** Push a shadow state (for speculative execution) */
	void PushState(int32 Level);

	/** Pop a shadow state */
	void PopState(int32 Level);

	/** Get current shadow level */
	int32 GetShadowLevel() const { return ShadowLevel; }

	/** Check if in shadow state */
	UFUNCTION(BlueprintPure, Category = "Dialogue")
	bool IsInShadowState() const { return ShadowLevel > 0; }

protected:
	/** Imported packages */
	UPROPERTY(VisibleAnywhere, Category = "Dialogue")
	TMap<FString, UDialoguePackage*> ImportedPackages;

	/** Currently loaded packages */
	UPROPERTY(VisibleAnywhere, Transient, Category = "Dialogue")
	TArray<FString> LoadedPackageNames;

	/** Objects indexed by ID */
	UPROPERTY(Transient)
	TMap<FString, UDialogueObject*> ObjectsById;

	/** Objects indexed by technical name */
	UPROPERTY(Transient)
	TMap<FString, UDialogueObject*> ObjectsByName;

	/** Characters */
	UPROPERTY(VisibleAnywhere, Category = "Dialogue")
	TArray<UDialogueCharacter*> Characters;

	/** Global variables instance */
	UPROPERTY(Transient)
	mutable UDialogueGlobalVariables* CachedGlobalVariables;

	/** Global variables class to instantiate */
	UPROPERTY(Config, VisibleAnywhere, Category = "Dialogue")
	TSubclassOf<UDialogueGlobalVariables> GlobalVariablesClass;

	/** Is initialized */
	UPROPERTY(Transient)
	bool bIsInitialized = false;

	/** Current shadow level */
	UPROPERTY(Transient)
	int32 ShadowLevel = 0;

private:
	/** Static instances per world */
	static TMap<TWeakObjectPtr<UWorld>, TWeakObjectPtr<UDialogueDatabase>> WorldInstances;

	/** Persistent instance (for games that persist across levels) */
	static TWeakObjectPtr<UDialogueDatabase> PersistentInstance;

	/** Get or create the database for a world */
	static UDialogueDatabase* GetOrCreateForWorld(UWorld* World);
};
