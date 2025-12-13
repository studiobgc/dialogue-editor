// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Factories/Factory.h"
#include "EditorReimportHandler.h"
#include "DialogueJSONFactory.generated.h"

class UDialogueImportData;

/**
 * Factory for importing dialogue JSON files
 */
UCLASS()
class DIALOGUEEDITOR_API UDialogueJSONFactory : public UFactory, public FReimportHandler
{
	GENERATED_BODY()

public:
	UDialogueJSONFactory();

	// UFactory interface
	virtual bool FactoryCanImport(const FString& Filename) override;
	virtual UClass* ResolveSupportedClass() override;
	virtual UObject* FactoryCreateFile(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, const FString& Filename, const TCHAR* Parms, FFeedbackContext* Warn, bool& bOutOperationCanceled) override;
	virtual bool CanReimport(UObject* Obj, TArray<FString>& OutFilenames) override;
	virtual void SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths) override;
	virtual EReimportResult::Type Reimport(UObject* Obj) override;
	// End UFactory interface

private:
	/** Perform the actual import */
	bool ImportFromFile(const FString& Filename, UDialogueImportData* ImportData);

	/** Process imported data and generate assets */
	bool ProcessImportData(UDialogueImportData* ImportData);
};
