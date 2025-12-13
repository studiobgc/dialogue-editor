// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueRuntimeModule.h"

DEFINE_LOG_CATEGORY(LogDialogueRuntime);

#define LOCTEXT_NAMESPACE "FDialogueRuntimeModule"

void FDialogueRuntimeModule::StartupModule()
{
	UE_LOG(LogDialogueRuntime, Log, TEXT("DialogueRuntime module started"));
}

void FDialogueRuntimeModule::ShutdownModule()
{
	UE_LOG(LogDialogueRuntime, Log, TEXT("DialogueRuntime module shutdown"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FDialogueRuntimeModule, DialogueRuntime)
