// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialoguePackageAssetTypeActions.h"
#include "DialoguePackage.h"

UClass* FDialoguePackageAssetTypeActions::GetSupportedClass() const
{
	return UDialoguePackage::StaticClass();
}
