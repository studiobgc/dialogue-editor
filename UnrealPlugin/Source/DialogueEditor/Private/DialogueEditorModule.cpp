// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueEditorModule.h"
#include "AssetToolsModule.h"
#include "IAssetTools.h"
#include "DialogueDatabaseAssetTypeActions.h"
#include "DialoguePackageAssetTypeActions.h"

DEFINE_LOG_CATEGORY(LogDialogueEditor);

#define LOCTEXT_NAMESPACE "FDialogueEditorModule"

void FDialogueEditorModule::StartupModule()
{
	UE_LOG(LogDialogueEditor, Log, TEXT("DialogueEditor module started"));

	RegisterAssetTypeActions();
}

void FDialogueEditorModule::ShutdownModule()
{
	UE_LOG(LogDialogueEditor, Log, TEXT("DialogueEditor module shutdown"));

	UnregisterAssetTypeActions();
}

void FDialogueEditorModule::RegisterAssetTypeActions()
{
	IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();

	// Register asset type actions
	RegisteredAssetTypeActions.Add(MakeShareable(new FDialogueDatabaseAssetTypeActions()));
	RegisteredAssetTypeActions.Add(MakeShareable(new FDialoguePackageAssetTypeActions()));

	for (TSharedRef<IAssetTypeActions>& Action : RegisteredAssetTypeActions)
	{
		AssetTools.RegisterAssetTypeActions(Action);
	}
}

void FDialogueEditorModule::UnregisterAssetTypeActions()
{
	if (FModuleManager::Get().IsModuleLoaded("AssetTools"))
	{
		IAssetTools& AssetTools = FModuleManager::GetModuleChecked<FAssetToolsModule>("AssetTools").Get();
		
		for (TSharedRef<IAssetTypeActions>& Action : RegisteredAssetTypeActions)
		{
			AssetTools.UnregisterAssetTypeActions(Action);
		}
	}
	
	RegisteredAssetTypeActions.Empty();
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FDialogueEditorModule, DialogueEditor)
