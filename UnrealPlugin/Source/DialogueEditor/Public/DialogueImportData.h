// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "DialogueImportData.generated.h"

/**
 * Settings for dialogue import
 */
USTRUCT(BlueprintType)
struct FDialogueImportSettings
{
	GENERATED_BODY()

	/** Create Blueprint-accessible global variables class */
	UPROPERTY(EditAnywhere, Category = "Import")
	bool bCreateGlobalVariablesBlueprint = true;

	/** Create Blueprint-accessible database class */
	UPROPERTY(EditAnywhere, Category = "Import")
	bool bCreateDatabaseBlueprint = true;

	/** Base folder for generated assets */
	UPROPERTY(EditAnywhere, Category = "Import")
	FString GeneratedAssetsFolder = TEXT("/Game/Dialogue/Generated");

	/** Overwrite existing assets on reimport */
	UPROPERTY(EditAnywhere, Category = "Import")
	bool bOverwriteOnReimport = true;
};

/**
 * Project definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueProjectDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Project")
	FString Name;

	UPROPERTY(VisibleAnywhere, Category = "Project")
	FString TechnicalName;

	UPROPERTY(VisibleAnywhere, Category = "Project")
	FString Guid;
};

/**
 * Variable definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueVariableDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Variable")
	FString Name;

	UPROPERTY(VisibleAnywhere, Category = "Variable")
	FString Type;

	UPROPERTY(VisibleAnywhere, Category = "Variable")
	FString DefaultValue;

	UPROPERTY(VisibleAnywhere, Category = "Variable")
	FString Description;
};

/**
 * Variable namespace definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueVariableNamespaceDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Namespace")
	FString Name;

	UPROPERTY(VisibleAnywhere, Category = "Namespace")
	FString Description;

	UPROPERTY(VisibleAnywhere, Category = "Namespace")
	TArray<FDialogueVariableDef> Variables;
};

/**
 * Character definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueCharacterDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Character")
	FString Id;

	UPROPERTY(VisibleAnywhere, Category = "Character")
	FString TechnicalName;

	UPROPERTY(VisibleAnywhere, Category = "Character")
	FString DisplayName;

	UPROPERTY(VisibleAnywhere, Category = "Character")
	FString Color;
};

/**
 * Object definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueObjectDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Object")
	FString Id;

	UPROPERTY(VisibleAnywhere, Category = "Object")
	FString TechnicalName;

	UPROPERTY(VisibleAnywhere, Category = "Object")
	FString Type;

	UPROPERTY(VisibleAnywhere, Category = "Object")
	TSharedPtr<FJsonObject> Properties;

	UPROPERTY(VisibleAnywhere, Category = "Object")
	TArray<FString> InputPinIds;

	UPROPERTY(VisibleAnywhere, Category = "Object")
	TArray<FString> OutputPinIds;
};

/**
 * Connection definition from import
 */
USTRUCT(BlueprintType)
struct FDialogueConnectionDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Connection")
	FString Id;

	UPROPERTY(VisibleAnywhere, Category = "Connection")
	FString SourceId;

	UPROPERTY(VisibleAnywhere, Category = "Connection")
	int32 SourcePin = 0;

	UPROPERTY(VisibleAnywhere, Category = "Connection")
	FString TargetId;

	UPROPERTY(VisibleAnywhere, Category = "Connection")
	int32 TargetPin = 0;
};

/**
 * Package definition from import
 */
USTRUCT(BlueprintType)
struct FDialoguePackageDef
{
	GENERATED_BODY()

	UPROPERTY(VisibleAnywhere, Category = "Package")
	FString Name;

	UPROPERTY(VisibleAnywhere, Category = "Package")
	bool bIsDefaultPackage = true;

	UPROPERTY(VisibleAnywhere, Category = "Package")
	TArray<FDialogueObjectDef> Objects;

	UPROPERTY(VisibleAnywhere, Category = "Package")
	TArray<FDialogueConnectionDef> Connections;
};

/**
 * Main import data asset containing all imported dialogue data
 */
UCLASS(BlueprintType)
class DIALOGUEEDITOR_API UDialogueImportData : public UDataAsset
{
	GENERATED_BODY()

public:
	/** Import settings */
	UPROPERTY(EditAnywhere, Category = "Import")
	FDialogueImportSettings Settings;

	/** Project definition */
	UPROPERTY(VisibleAnywhere, Category = "Project")
	FDialogueProjectDef Project;

	/** Global variables */
	UPROPERTY(VisibleAnywhere, Category = "Variables")
	TArray<FDialogueVariableNamespaceDef> GlobalVariables;

	/** Characters */
	UPROPERTY(VisibleAnywhere, Category = "Characters")
	TArray<FDialogueCharacterDef> Characters;

	/** Packages */
	UPROPERTY(VisibleAnywhere, Category = "Packages")
	TArray<FDialoguePackageDef> Packages;

	/** Source file path for reimport */
	UPROPERTY(VisibleAnywhere, Category = "Import")
	FString SourceFilePath;

	/** Import timestamp */
	UPROPERTY(VisibleAnywhere, Category = "Import")
	FDateTime ImportTimestamp;

	/** Import from JSON data */
	bool ImportFromJson(const TSharedPtr<FJsonObject>& JsonData);

	/** Get the source file for reimport */
	FString GetSourceFile() const { return SourceFilePath; }
};
