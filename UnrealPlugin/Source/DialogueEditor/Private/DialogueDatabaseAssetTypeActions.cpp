// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueDatabaseAssetTypeActions.h"
#include "DialogueDatabase.h"

UClass* FDialogueDatabaseAssetTypeActions::GetSupportedClass() const
{
	return UDialogueDatabase::StaticClass();
}
