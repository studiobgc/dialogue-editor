// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

DECLARE_LOG_CATEGORY_EXTERN(LogDialogueEditor, Log, All);

class FDialogueEditorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	static inline FDialogueEditorModule& Get()
	{
		return FModuleManager::LoadModuleChecked<FDialogueEditorModule>("DialogueEditor");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("DialogueEditor");
	}

private:
	void RegisterAssetTypeActions();
	void UnregisterAssetTypeActions();

	TArray<TSharedRef<class IAssetTypeActions>> RegisteredAssetTypeActions;
};
