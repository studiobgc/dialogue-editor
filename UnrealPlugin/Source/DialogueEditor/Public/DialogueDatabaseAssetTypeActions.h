// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "AssetTypeActions_Base.h"

/**
 * Asset type actions for UDialogueDatabase
 */
class DIALOGUEEDITOR_API FDialogueDatabaseAssetTypeActions : public FAssetTypeActions_Base
{
public:
	virtual FText GetName() const override { return NSLOCTEXT("AssetTypeActions", "DialogueDatabase", "Dialogue Database"); }
	virtual FColor GetTypeColor() const override { return FColor(100, 100, 200); }
	virtual UClass* GetSupportedClass() const override;
	virtual uint32 GetCategories() override { return EAssetTypeCategories::Misc; }
};
