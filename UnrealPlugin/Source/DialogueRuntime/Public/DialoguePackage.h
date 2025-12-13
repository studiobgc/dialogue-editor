// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "DialoguePackage.generated.h"

class UDialogueObject;

/**
 * A package containing dialogue objects (imported from editor)
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialoguePackage : public UDataAsset
{
	GENERATED_BODY()

public:
	/** Package name */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Package")
	FString Name;

	/** Package description */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Package")
	FString Description;

	/** Is this a default package (loaded automatically) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Package")
	bool bIsDefaultPackage = true;

	/** All objects in this package */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Package")
	TArray<UDialogueObject*> Objects;

	/** Get all objects of a specific type */
	template<typename T>
	TArray<T*> GetObjectsOfType() const
	{
		TArray<T*> Result;
		for (UDialogueObject* Obj : Objects)
		{
			if (T* Typed = Cast<T>(Obj))
			{
				Result.Add(Typed);
			}
		}
		return Result;
	}

	/** Get object count */
	UFUNCTION(BlueprintPure, Category = "Package")
	int32 GetObjectCount() const { return Objects.Num(); }
};
