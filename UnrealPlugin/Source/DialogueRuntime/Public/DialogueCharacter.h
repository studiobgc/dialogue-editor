// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DialogueObject.h"
#include "DialogueCharacter.generated.h"

/**
 * Represents a character/speaker in dialogue
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueCharacter : public UDialogueObject
{
	GENERATED_BODY()

public:
	/** Display name shown in dialogue */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Character")
	FText DisplayName;

	/** Color associated with this character */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Character")
	FLinearColor Color = FLinearColor::White;

	/** Preview image/portrait */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Character")
	TSoftObjectPtr<UTexture2D> PreviewImage;

	/** Voice/audio asset reference */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Character")
	TSoftObjectPtr<USoundBase> VoiceAsset;

	/** Get the display name as string */
	UFUNCTION(BlueprintPure, Category = "Character")
	FString GetDisplayNameString() const { return DisplayName.ToString(); }

	/** Get the color as FColor */
	UFUNCTION(BlueprintPure, Category = "Character")
	FColor GetColorAsColor() const { return Color.ToFColor(true); }

	/** Get the preview image (loads if needed) */
	UFUNCTION(BlueprintCallable, Category = "Character")
	UTexture2D* GetPreviewImage() const;
};
