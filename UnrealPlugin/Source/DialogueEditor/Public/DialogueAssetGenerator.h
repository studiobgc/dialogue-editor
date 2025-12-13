// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UDialogueImportData;
class UDialogueDatabase;
class UDialoguePackage;
class UDialogueObject;
class UDialogueNode;
class UDialogueCharacter;
struct FDialoguePackageDef;
struct FDialogueObjectDef;
struct FDialogueConnectionDef;
struct FDialogueCharacterDef;

/**
 * Generates Unreal assets from imported dialogue data
 */
class DIALOGUEEDITOR_API FDialogueAssetGenerator
{
public:
	FDialogueAssetGenerator();

	/** Generate all assets from import data */
	bool GenerateAssets(UDialogueImportData* ImportData);

	/** Get generated database */
	UDialogueDatabase* GetGeneratedDatabase() const { return GeneratedDatabase; }

	/** Get generated packages */
	const TArray<UDialoguePackage*>& GetGeneratedPackages() const { return GeneratedPackages; }

private:
	/** Generate the database asset */
	bool GenerateDatabase(UDialogueImportData* ImportData);

	/** Generate a package asset */
	UDialoguePackage* GeneratePackage(const FDialoguePackageDef& PackageDef, UDialogueImportData* ImportData);

	/** Generate a dialogue object */
	UDialogueObject* GenerateObject(const FDialogueObjectDef& ObjectDef, UDialoguePackage* Package);

	/** Generate a character */
	UDialogueCharacter* GenerateCharacter(const FDialogueCharacterDef& CharacterDef);

	/** Connect objects based on connection definitions */
	void ProcessConnections(const TArray<FDialogueConnectionDef>& Connections, UDialoguePackage* Package);

	/** Get the asset save path */
	FString GetAssetPath(const FString& AssetName, const FString& SubFolder = TEXT("")) const;

	/** Create or find a package for asset creation */
	UPackage* CreateAssetPackage(const FString& AssetPath);

	/** Save an asset */
	bool SaveAsset(UObject* Asset);

private:
	/** Base path for generated assets */
	FString GeneratedAssetsBasePath;

	/** Generated database */
	UDialogueDatabase* GeneratedDatabase = nullptr;

	/** Generated packages */
	TArray<UDialoguePackage*> GeneratedPackages;

	/** Object lookup by ID */
	TMap<FString, UDialogueObject*> ObjectsById;
};
