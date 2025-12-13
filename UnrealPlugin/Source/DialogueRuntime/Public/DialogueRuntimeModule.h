// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

DECLARE_LOG_CATEGORY_EXTERN(LogDialogueRuntime, Log, All);

class FDialogueRuntimeModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	static inline FDialogueRuntimeModule& Get()
	{
		return FModuleManager::LoadModuleChecked<FDialogueRuntimeModule>("DialogueRuntime");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("DialogueRuntime");
	}
};
