// Copyright Dialogue Editor Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "DialogueTypes.h"
#include "DialogueGlobalVariables.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialogueVariableChanged, const FString&, VariableName);

/**
 * Base class for a dialogue variable
 */
UCLASS(BlueprintType, Abstract)
class DIALOGUERUNTIME_API UDialogueVariable : public UObject
{
	GENERATED_BODY()

public:
	/** Variable name in format Namespace.Variable */
	UPROPERTY(BlueprintReadOnly, Category = "Variable")
	FString VariableName;

	/** Called when the variable value changes */
	UPROPERTY(BlueprintAssignable, Category = "Variable")
	FOnDialogueVariableChanged OnVariableChanged;

	/** Get the containing global variables object */
	UDialogueGlobalVariables* GetGlobalVariables() const;

protected:
	UPROPERTY()
	UDialogueGlobalVariables* OwningGlobalVariables;

	friend class UDialogueGlobalVariables;
};

/**
 * Boolean dialogue variable
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueBoolVariable : public UDialogueVariable
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Variable")
	bool Value = false;

	UFUNCTION(BlueprintCallable, Category = "Variable")
	void SetValue(bool NewValue);

	UFUNCTION(BlueprintPure, Category = "Variable")
	bool GetValue() const { return Value; }

protected:
	/** Shadow stack for speculative execution */
	TArray<bool> ShadowStack;

	friend class UDialogueGlobalVariables;
};

/**
 * Integer dialogue variable
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueIntVariable : public UDialogueVariable
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Variable")
	int32 Value = 0;

	UFUNCTION(BlueprintCallable, Category = "Variable")
	void SetValue(int32 NewValue);

	UFUNCTION(BlueprintPure, Category = "Variable")
	int32 GetValue() const { return Value; }

	UFUNCTION(BlueprintCallable, Category = "Variable")
	void Add(int32 Amount) { SetValue(Value + Amount); }

	UFUNCTION(BlueprintCallable, Category = "Variable")
	void Subtract(int32 Amount) { SetValue(Value - Amount); }

protected:
	TArray<int32> ShadowStack;

	friend class UDialogueGlobalVariables;
};

/**
 * String dialogue variable
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueStringVariable : public UDialogueVariable
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Variable")
	FString Value;

	UFUNCTION(BlueprintCallable, Category = "Variable")
	void SetValue(const FString& NewValue);

	UFUNCTION(BlueprintPure, Category = "Variable")
	FString GetValue() const { return Value; }

protected:
	TArray<FString> ShadowStack;

	friend class UDialogueGlobalVariables;
};

/**
 * A namespace containing variables
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueVariableNamespace : public UObject
{
	GENERATED_BODY()

public:
	/** Namespace name */
	UPROPERTY(BlueprintReadOnly, Category = "Namespace")
	FString Name;

	/** Variables in this namespace */
	UPROPERTY(BlueprintReadOnly, Category = "Namespace")
	TMap<FString, UDialogueVariable*> Variables;

	/** Get a boolean variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueBoolVariable* GetBool(const FString& VarName) const;

	/** Get an integer variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueIntVariable* GetInt(const FString& VarName) const;

	/** Get a string variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueStringVariable* GetString(const FString& VarName) const;
};

/**
 * Container for all global variables
 */
UCLASS(BlueprintType)
class DIALOGUERUNTIME_API UDialogueGlobalVariables : public UObject
{
	GENERATED_BODY()

public:
	/** Get a namespace by name */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueVariableNamespace* GetNamespace(const FString& Name) const;

	/** Get a variable by full name (Namespace.Variable) */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	UDialogueVariable* GetVariable(const FString& FullName) const;

	/** Get a boolean variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	bool GetBool(const FString& FullName) const;

	/** Set a boolean variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	void SetBool(const FString& FullName, bool Value);

	/** Get an integer variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	int32 GetInt(const FString& FullName) const;

	/** Set an integer variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	void SetInt(const FString& FullName, int32 Value);

	/** Get a string variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	FString GetString(const FString& FullName) const;

	/** Set a string variable */
	UFUNCTION(BlueprintCallable, Category = "Variables")
	void SetString(const FString& FullName, const FString& Value);

	// ==================== SHADOW STATE ====================

	/** Push state for shadow operation */
	void PushState(int32 Level);

	/** Pop state after shadow operation */
	void PopState(int32 Level);

	/** Get current shadow level */
	int32 GetShadowLevel() const { return ShadowLevel; }

protected:
	/** All namespaces */
	UPROPERTY()
	TMap<FString, UDialogueVariableNamespace*> Namespaces;

	/** Current shadow level */
	UPROPERTY(Transient)
	int32 ShadowLevel = 0;

	/** Register a namespace */
	void RegisterNamespace(UDialogueVariableNamespace* Namespace);

	/** Parse full variable name into namespace and variable */
	static bool ParseVariableName(const FString& FullName, FString& OutNamespace, FString& OutVariable);

	friend class UDialogueDatabase;
};
