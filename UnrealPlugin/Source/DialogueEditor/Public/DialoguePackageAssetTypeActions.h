// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "AssetTypeActions_Base.h"

/**
 * Asset type actions for UDialoguePackage
 */
class DIALOGUEEDITOR_API FDialoguePackageAssetTypeActions : public FAssetTypeActions_Base
{
public:
	virtual FText GetName() const override { return NSLOCTEXT("AssetTypeActions", "DialoguePackage", "Dialogue Package"); }
	virtual FColor GetTypeColor() const override { return FColor(100, 200, 100); }
	virtual UClass* GetSupportedClass() const override;
	virtual uint32 GetCategories() override { return EAssetTypeCategories::Misc; }
};
