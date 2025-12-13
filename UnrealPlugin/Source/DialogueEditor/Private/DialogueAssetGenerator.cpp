// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueAssetGenerator.h"
#include "DialogueImportData.h"
#include "DialogueDatabase.h"
#include "DialoguePackage.h"
#include "DialogueNode.h"
#include "DialoguePin.h"
#include "DialogueCharacter.h"
#include "DialogueEditorModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#include "FileHelpers.h"

FDialogueAssetGenerator::FDialogueAssetGenerator()
{
	GeneratedAssetsBasePath = TEXT("/Game/Dialogue/Generated");
}

bool FDialogueAssetGenerator::GenerateAssets(UDialogueImportData* ImportData)
{
	if (!ImportData)
	{
		return false;
	}

	GeneratedAssetsBasePath = ImportData->Settings.GeneratedAssetsFolder;
	ObjectsById.Empty();
	GeneratedPackages.Empty();

	// Generate characters first
	for (const FDialogueCharacterDef& CharDef : ImportData->Characters)
	{
		UDialogueCharacter* Character = GenerateCharacter(CharDef);
		if (Character)
		{
			ObjectsById.Add(CharDef.Id, Character);
		}
	}

	// Generate packages and their objects
	for (const FDialoguePackageDef& PackageDef : ImportData->Packages)
	{
		UDialoguePackage* Package = GeneratePackage(PackageDef, ImportData);
		if (Package)
		{
			GeneratedPackages.Add(Package);

			// Process connections for this package
			ProcessConnections(PackageDef.Connections, Package);
		}
	}

	// Generate the database
	if (!GenerateDatabase(ImportData))
	{
		UE_LOG(LogDialogueEditor, Error, TEXT("Failed to generate dialogue database"));
		return false;
	}

	UE_LOG(LogDialogueEditor, Log, TEXT("Generated %d packages with %d objects"),
		GeneratedPackages.Num(), ObjectsById.Num());

	return true;
}

bool FDialogueAssetGenerator::GenerateDatabase(UDialogueImportData* ImportData)
{
	FString AssetPath = GetAssetPath(ImportData->Project.TechnicalName + TEXT("Database"));
	UPackage* Package = CreateAssetPackage(AssetPath);
	if (!Package)
	{
		return false;
	}

	FString AssetName = FPackageName::GetShortName(AssetPath);
	GeneratedDatabase = NewObject<UDialogueDatabase>(Package, *AssetName, RF_Public | RF_Standalone);

	if (!GeneratedDatabase)
	{
		return false;
	}

	// Add packages to database
	// Note: The actual implementation would set up the ImportedPackages map
	
	return SaveAsset(GeneratedDatabase);
}

UDialoguePackage* FDialogueAssetGenerator::GeneratePackage(const FDialoguePackageDef& PackageDef, UDialogueImportData* ImportData)
{
	FString AssetPath = GetAssetPath(PackageDef.Name + TEXT("Package"), TEXT("Packages"));
	UPackage* Package = CreateAssetPackage(AssetPath);
	if (!Package)
	{
		return nullptr;
	}

	FString AssetName = FPackageName::GetShortName(AssetPath);
	UDialoguePackage* DialoguePackage = NewObject<UDialoguePackage>(Package, *AssetName, RF_Public | RF_Standalone);

	if (!DialoguePackage)
	{
		return nullptr;
	}

	DialoguePackage->Name = PackageDef.Name;
	DialoguePackage->bIsDefaultPackage = PackageDef.bIsDefaultPackage;

	// Generate objects in this package
	for (const FDialogueObjectDef& ObjectDef : PackageDef.Objects)
	{
		UDialogueObject* Object = GenerateObject(ObjectDef, DialoguePackage);
		if (Object)
		{
			DialoguePackage->Objects.Add(Object);
			ObjectsById.Add(ObjectDef.Id, Object);
		}
	}

	SaveAsset(DialoguePackage);
	return DialoguePackage;
}

UDialogueObject* FDialogueAssetGenerator::GenerateObject(const FDialogueObjectDef& ObjectDef, UDialoguePackage* Package)
{
	if (!Package)
	{
		return nullptr;
	}

	UDialogueObject* Object = nullptr;

	// Create appropriate node type based on Type string
	if (ObjectDef.Type == TEXT("Dialogue"))
	{
		UDialogueDialogue* Dialogue = NewObject<UDialogueDialogue>(Package);
		
		// Parse properties from JSON
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				FString SpeakerId;
				if ((*Data)->TryGetStringField(TEXT("speaker"), SpeakerId))
				{
					Dialogue->SpeakerId = SpeakerId;
				}

				FString Text;
				if ((*Data)->TryGetStringField(TEXT("text"), Text))
				{
					Dialogue->Text = FText::FromString(Text);
				}

				FString MenuText;
				if ((*Data)->TryGetStringField(TEXT("menuText"), MenuText))
				{
					Dialogue->MenuText = FText::FromString(MenuText);
				}

				bool bAutoTransition = false;
				if ((*Data)->TryGetBoolField(TEXT("autoTransition"), bAutoTransition))
				{
					Dialogue->bAutoTransition = bAutoTransition;
				}
			}
		}

		Object = Dialogue;
	}
	else if (ObjectDef.Type == TEXT("DialogueFragment"))
	{
		UDialogueFragment* Fragment = NewObject<UDialogueFragment>(Package);
		
		// Parse properties similar to Dialogue
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				FString SpeakerId;
				if ((*Data)->TryGetStringField(TEXT("speaker"), SpeakerId))
				{
					Fragment->SpeakerId = SpeakerId;
				}

				FString Text;
				if ((*Data)->TryGetStringField(TEXT("text"), Text))
				{
					Fragment->Text = FText::FromString(Text);
				}
			}
		}

		Object = Fragment;
	}
	else if (ObjectDef.Type == TEXT("Hub"))
	{
		UDialogueHub* Hub = NewObject<UDialogueHub>(Package);
		Object = Hub;
	}
	else if (ObjectDef.Type == TEXT("Condition"))
	{
		UDialogueCondition* Condition = NewObject<UDialogueCondition>(Package);
		
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				if (const TSharedPtr<FJsonObject>* Script = nullptr; (*Data)->TryGetObjectField(TEXT("script"), Script))
				{
					FString Expression;
					if ((*Script)->TryGetStringField(TEXT("expression"), Expression))
					{
						Condition->Script.Expression = Expression;
						Condition->Script.bIsCondition = true;
					}
				}
			}
		}

		Object = Condition;
	}
	else if (ObjectDef.Type == TEXT("Instruction"))
	{
		UDialogueInstruction* Instruction = NewObject<UDialogueInstruction>(Package);
		
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				if (const TSharedPtr<FJsonObject>* Script = nullptr; (*Data)->TryGetObjectField(TEXT("script"), Script))
				{
					FString Expression;
					if ((*Script)->TryGetStringField(TEXT("expression"), Expression))
					{
						Instruction->Script.Expression = Expression;
						Instruction->Script.bIsCondition = false;
					}
				}
			}
		}

		Object = Instruction;
	}
	else if (ObjectDef.Type == TEXT("Jump"))
	{
		UDialogueJump* Jump = NewObject<UDialogueJump>(Package);
		
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				FString TargetId;
				if ((*Data)->TryGetStringField(TEXT("targetNodeId"), TargetId))
				{
					Jump->TargetNodeId = TargetId;
				}

				int32 TargetPin = 0;
				if ((*Data)->TryGetNumberField(TEXT("targetPinIndex"), TargetPin))
				{
					Jump->TargetPinIndex = TargetPin;
				}
			}
		}

		Object = Jump;
	}
	else if (ObjectDef.Type == TEXT("FlowFragment"))
	{
		UDialogueFlowFragment* FlowFragment = NewObject<UDialogueFlowFragment>(Package);
		
		if (ObjectDef.Properties.IsValid())
		{
			const TSharedPtr<FJsonObject>& Props = ObjectDef.Properties;
			if (const TSharedPtr<FJsonObject>* Data = nullptr; Props->TryGetObjectField(TEXT("data"), Data))
			{
				FString DisplayName;
				if ((*Data)->TryGetStringField(TEXT("displayName"), DisplayName))
				{
					FlowFragment->DisplayName = DisplayName;
				}
			}
		}

		Object = FlowFragment;
	}
	else
	{
		// Unknown type, create basic object
		Object = NewObject<UDialogueObject>(Package);
	}

	if (Object)
	{
		Object->Id = ObjectDef.Id;
		Object->TechnicalName = ObjectDef.TechnicalName;

		// Create pins for nodes
		if (UDialogueNode* Node = Cast<UDialogueNode>(Object))
		{
			// Create input pins
			for (int32 i = 0; i < ObjectDef.InputPinIds.Num(); ++i)
			{
				UDialogueInputPin* Pin = NewObject<UDialogueInputPin>(Node);
				Pin->Id = ObjectDef.InputPinIds[i];
				Pin->OwnerId = Node->Id;
				Pin->Index = i;
				Node->InputPins.Add(Pin);
			}

			// Create output pins
			for (int32 i = 0; i < ObjectDef.OutputPinIds.Num(); ++i)
			{
				UDialogueOutputPin* Pin = NewObject<UDialogueOutputPin>(Node);
				Pin->Id = ObjectDef.OutputPinIds[i];
				Pin->OwnerId = Node->Id;
				Pin->Index = i;
				Node->OutputPins.Add(Pin);
			}
		}
	}

	return Object;
}

UDialogueCharacter* FDialogueAssetGenerator::GenerateCharacter(const FDialogueCharacterDef& CharacterDef)
{
	FString AssetPath = GetAssetPath(CharacterDef.TechnicalName, TEXT("Characters"));
	UPackage* Package = CreateAssetPackage(AssetPath);
	if (!Package)
	{
		return nullptr;
	}

	FString AssetName = FPackageName::GetShortName(AssetPath);
	UDialogueCharacter* Character = NewObject<UDialogueCharacter>(Package, *AssetName, RF_Public | RF_Standalone);

	if (!Character)
	{
		return nullptr;
	}

	Character->Id = CharacterDef.Id;
	Character->TechnicalName = CharacterDef.TechnicalName;
	Character->DisplayName = FText::FromString(CharacterDef.DisplayName);

	// Parse color from hex string
	if (!CharacterDef.Color.IsEmpty())
	{
		FColor ParsedColor = FColor::FromHex(CharacterDef.Color);
		Character->Color = FLinearColor(ParsedColor);
	}

	SaveAsset(Character);
	return Character;
}

void FDialogueAssetGenerator::ProcessConnections(const TArray<FDialogueConnectionDef>& Connections, UDialoguePackage* Package)
{
	for (const FDialogueConnectionDef& ConnDef : Connections)
	{
		UDialogueObject** SourcePtr = ObjectsById.Find(ConnDef.SourceId);
		UDialogueObject** TargetPtr = ObjectsById.Find(ConnDef.TargetId);

		if (!SourcePtr || !TargetPtr)
		{
			continue;
		}

		UDialogueNode* SourceNode = Cast<UDialogueNode>(*SourcePtr);
		UDialogueNode* TargetNode = Cast<UDialogueNode>(*TargetPtr);

		if (!SourceNode || !TargetNode)
		{
			continue;
		}

		// Get output pin from source
		if (ConnDef.SourcePin < SourceNode->OutputPins.Num())
		{
			UDialogueOutputPin* OutputPin = SourceNode->OutputPins[ConnDef.SourcePin];
			if (OutputPin)
			{
				// Create connection
				UDialogueConnection* Connection = NewObject<UDialogueConnection>(OutputPin);
				Connection->TargetNodeId = ConnDef.TargetId;
				Connection->TargetPinIndex = ConnDef.TargetPin;
				OutputPin->Connections.Add(Connection);
			}
		}
	}
}

FString FDialogueAssetGenerator::GetAssetPath(const FString& AssetName, const FString& SubFolder) const
{
	if (SubFolder.IsEmpty())
	{
		return FString::Printf(TEXT("%s/%s"), *GeneratedAssetsBasePath, *AssetName);
	}
	return FString::Printf(TEXT("%s/%s/%s"), *GeneratedAssetsBasePath, *SubFolder, *AssetName);
}

UPackage* FDialogueAssetGenerator::CreateAssetPackage(const FString& AssetPath)
{
	FString PackagePath = FPackageName::ObjectPathToPackageName(AssetPath);
	UPackage* Package = CreatePackage(*PackagePath);
	
	if (Package)
	{
		Package->FullyLoad();
		Package->SetDirtyFlag(true);
	}
	
	return Package;
}

bool FDialogueAssetGenerator::SaveAsset(UObject* Asset)
{
	if (!Asset)
	{
		return false;
	}

	UPackage* Package = Asset->GetOutermost();
	if (!Package)
	{
		return false;
	}

	Package->MarkPackageDirty();

	FString PackageFilename = FPackageName::LongPackageNameToFilename(Package->GetName(), FPackageName::GetAssetPackageExtension());
	
	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	
	FSavePackageResultStruct Result = UPackage::Save(Package, Asset, *PackageFilename, SaveArgs);
	
	if (Result.Result == ESavePackageResult::Success)
	{
		// Notify asset registry
		FAssetRegistryModule::AssetCreated(Asset);
		return true;
	}

	UE_LOG(LogDialogueEditor, Warning, TEXT("Failed to save asset: %s"), *Asset->GetName());
	return false;
}
