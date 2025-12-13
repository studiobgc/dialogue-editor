// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueJSONFactory.h"
#include "DialogueImportData.h"
#include "DialogueAssetGenerator.h"
#include "DialogueEditorModule.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "EditorFramework/AssetImportData.h"

#define LOCTEXT_NAMESPACE "DialogueJSONFactory"

UDialogueJSONFactory::UDialogueJSONFactory()
{
	bCreateNew = false;
	bEditorImport = true;
	bEditAfterNew = true;
	SupportedClass = UDialogueImportData::StaticClass();

	Formats.Add(TEXT("json;Dialogue JSON File"));
	Formats.Add(TEXT("dialogue;Dialogue Export File"));
}

bool UDialogueJSONFactory::FactoryCanImport(const FString& Filename)
{
	const FString Extension = FPaths::GetExtension(Filename);
	return Extension.Equals(TEXT("json"), ESearchCase::IgnoreCase) ||
	       Extension.Equals(TEXT("dialogue"), ESearchCase::IgnoreCase);
}

UClass* UDialogueJSONFactory::ResolveSupportedClass()
{
	return UDialogueImportData::StaticClass();
}

UObject* UDialogueJSONFactory::FactoryCreateFile(
	UClass* InClass,
	UObject* InParent,
	FName InName,
	EObjectFlags Flags,
	const FString& Filename,
	const TCHAR* Parms,
	FFeedbackContext* Warn,
	bool& bOutOperationCanceled)
{
	UDialogueImportData* ImportData = NewObject<UDialogueImportData>(InParent, InName, Flags);

	if (!ImportFromFile(Filename, ImportData))
	{
		UE_LOG(LogDialogueEditor, Error, TEXT("Failed to import dialogue from: %s"), *Filename);
		bOutOperationCanceled = true;
		return nullptr;
	}

	ImportData->SourceFilePath = Filename;
	ImportData->ImportTimestamp = FDateTime::Now();

	// Process and generate assets
	if (!ProcessImportData(ImportData))
	{
		UE_LOG(LogDialogueEditor, Warning, TEXT("Asset generation had issues for: %s"), *Filename);
	}

	UE_LOG(LogDialogueEditor, Log, TEXT("Successfully imported dialogue from: %s"), *Filename);

	return ImportData;
}

bool UDialogueJSONFactory::ImportFromFile(const FString& Filename, UDialogueImportData* ImportData)
{
	if (!ImportData)
	{
		return false;
	}

	// Read file content
	FString FileContent;
	if (!FFileHelper::LoadFileToString(FileContent, *Filename))
	{
		UE_LOG(LogDialogueEditor, Error, TEXT("Failed to read file: %s"), *Filename);
		return false;
	}

	// Parse JSON
	TSharedPtr<FJsonObject> JsonObject;
	TSharedRef<TJsonReader<>> JsonReader = TJsonReaderFactory<>::Create(FileContent);

	if (!FJsonSerializer::Deserialize(JsonReader, JsonObject) || !JsonObject.IsValid())
	{
		UE_LOG(LogDialogueEditor, Error, TEXT("Failed to parse JSON from: %s"), *Filename);
		return false;
	}

	// Import the data
	return ImportData->ImportFromJson(JsonObject);
}

bool UDialogueJSONFactory::ProcessImportData(UDialogueImportData* ImportData)
{
	if (!ImportData)
	{
		return false;
	}

	FDialogueAssetGenerator Generator;
	return Generator.GenerateAssets(ImportData);
}

bool UDialogueJSONFactory::CanReimport(UObject* Obj, TArray<FString>& OutFilenames)
{
	UDialogueImportData* ImportData = Cast<UDialogueImportData>(Obj);
	if (ImportData && !ImportData->SourceFilePath.IsEmpty())
	{
		OutFilenames.Add(ImportData->SourceFilePath);
		return true;
	}
	return false;
}

void UDialogueJSONFactory::SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths)
{
	UDialogueImportData* ImportData = Cast<UDialogueImportData>(Obj);
	if (ImportData && NewReimportPaths.Num() > 0)
	{
		ImportData->SourceFilePath = NewReimportPaths[0];
	}
}

EReimportResult::Type UDialogueJSONFactory::Reimport(UObject* Obj)
{
	UDialogueImportData* ImportData = Cast<UDialogueImportData>(Obj);
	if (!ImportData)
	{
		return EReimportResult::Failed;
	}

	const FString& Filename = ImportData->SourceFilePath;
	if (Filename.IsEmpty() || !FPaths::FileExists(Filename))
	{
		UE_LOG(LogDialogueEditor, Error, TEXT("Source file not found for reimport: %s"), *Filename);
		return EReimportResult::Failed;
	}

	if (!ImportFromFile(Filename, ImportData))
	{
		return EReimportResult::Failed;
	}

	ImportData->ImportTimestamp = FDateTime::Now();

	if (!ProcessImportData(ImportData))
	{
		return EReimportResult::Succeeded; // Partial success
	}

	return EReimportResult::Succeeded;
}

#undef LOCTEXT_NAMESPACE
