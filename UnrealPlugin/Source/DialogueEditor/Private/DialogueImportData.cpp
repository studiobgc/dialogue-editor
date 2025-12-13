// Copyright Dialogue Editor Team. All Rights Reserved.

#include "DialogueImportData.h"
#include "DialogueEditorModule.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

bool UDialogueImportData::ImportFromJson(const TSharedPtr<FJsonObject>& JsonData)
{
	if (!JsonData.IsValid())
	{
		return false;
	}

	// Parse format version
	FString FormatVersion;
	JsonData->TryGetStringField(TEXT("formatVersion"), FormatVersion);
	UE_LOG(LogDialogueEditor, Log, TEXT("Importing dialogue format version: %s"), *FormatVersion);

	// Parse project info
	if (const TSharedPtr<FJsonObject>* ProjectObj = nullptr; JsonData->TryGetObjectField(TEXT("project"), ProjectObj))
	{
		(*ProjectObj)->TryGetStringField(TEXT("name"), Project.Name);
		(*ProjectObj)->TryGetStringField(TEXT("technicalName"), Project.TechnicalName);
		(*ProjectObj)->TryGetStringField(TEXT("guid"), Project.Guid);
	}

	// Parse global variables
	GlobalVariables.Empty();
	if (const TArray<TSharedPtr<FJsonValue>>* VariablesArray = nullptr; JsonData->TryGetArrayField(TEXT("globalVariables"), VariablesArray))
	{
		for (const TSharedPtr<FJsonValue>& NamespaceValue : *VariablesArray)
		{
			const TSharedPtr<FJsonObject>* NamespaceObj = nullptr;
			if (!NamespaceValue->TryGetObject(NamespaceObj))
			{
				continue;
			}

			FDialogueVariableNamespaceDef Namespace;
			(*NamespaceObj)->TryGetStringField(TEXT("name"), Namespace.Name);
			(*NamespaceObj)->TryGetStringField(TEXT("description"), Namespace.Description);

			if (const TArray<TSharedPtr<FJsonValue>>* VarsArray = nullptr; (*NamespaceObj)->TryGetArrayField(TEXT("variables"), VarsArray))
			{
				for (const TSharedPtr<FJsonValue>& VarValue : *VarsArray)
				{
					const TSharedPtr<FJsonObject>* VarObj = nullptr;
					if (!VarValue->TryGetObject(VarObj))
					{
						continue;
					}

					FDialogueVariableDef Variable;
					(*VarObj)->TryGetStringField(TEXT("name"), Variable.Name);
					(*VarObj)->TryGetStringField(TEXT("type"), Variable.Type);
					(*VarObj)->TryGetStringField(TEXT("description"), Variable.Description);

					// Get default value as string
					if (const TSharedPtr<FJsonValue>* DefaultValue = nullptr; (*VarObj)->TryGetField(TEXT("defaultValue"), *DefaultValue))
					{
						if ((*DefaultValue)->Type == EJson::Boolean)
						{
							Variable.DefaultValue = (*DefaultValue)->AsBool() ? TEXT("true") : TEXT("false");
						}
						else if ((*DefaultValue)->Type == EJson::Number)
						{
							Variable.DefaultValue = FString::Printf(TEXT("%d"), (int32)(*DefaultValue)->AsNumber());
						}
						else if ((*DefaultValue)->Type == EJson::String)
						{
							Variable.DefaultValue = (*DefaultValue)->AsString();
						}
					}

					Namespace.Variables.Add(Variable);
				}
			}

			GlobalVariables.Add(Namespace);
		}
	}

	// Parse characters
	Characters.Empty();
	if (const TArray<TSharedPtr<FJsonValue>>* CharactersArray = nullptr; JsonData->TryGetArrayField(TEXT("characters"), CharactersArray))
	{
		for (const TSharedPtr<FJsonValue>& CharValue : *CharactersArray)
		{
			const TSharedPtr<FJsonObject>* CharObj = nullptr;
			if (!CharValue->TryGetObject(CharObj))
			{
				continue;
			}

			FDialogueCharacterDef Character;
			(*CharObj)->TryGetStringField(TEXT("id"), Character.Id);
			(*CharObj)->TryGetStringField(TEXT("technicalName"), Character.TechnicalName);
			(*CharObj)->TryGetStringField(TEXT("displayName"), Character.DisplayName);
			(*CharObj)->TryGetStringField(TEXT("color"), Character.Color);

			Characters.Add(Character);
		}
	}

	// Parse packages
	Packages.Empty();
	if (const TArray<TSharedPtr<FJsonValue>>* PackagesArray = nullptr; JsonData->TryGetArrayField(TEXT("packages"), PackagesArray))
	{
		for (const TSharedPtr<FJsonValue>& PackageValue : *PackagesArray)
		{
			const TSharedPtr<FJsonObject>* PackageObj = nullptr;
			if (!PackageValue->TryGetObject(PackageObj))
			{
				continue;
			}

			FDialoguePackageDef Package;
			(*PackageObj)->TryGetStringField(TEXT("name"), Package.Name);
			(*PackageObj)->TryGetBoolField(TEXT("isDefaultPackage"), Package.bIsDefaultPackage);

			// Parse objects
			if (const TArray<TSharedPtr<FJsonValue>>* ObjectsArray = nullptr; (*PackageObj)->TryGetArrayField(TEXT("objects"), ObjectsArray))
			{
				for (const TSharedPtr<FJsonValue>& ObjValue : *ObjectsArray)
				{
					const TSharedPtr<FJsonObject>* ObjObj = nullptr;
					if (!ObjValue->TryGetObject(ObjObj))
					{
						continue;
					}

					FDialogueObjectDef Object;
					(*ObjObj)->TryGetStringField(TEXT("id"), Object.Id);
					(*ObjObj)->TryGetStringField(TEXT("technicalName"), Object.TechnicalName);
					(*ObjObj)->TryGetStringField(TEXT("type"), Object.Type);

					// Store properties as-is for later processing
					if (const TSharedPtr<FJsonObject>* PropsObj = nullptr; (*ObjObj)->TryGetObjectField(TEXT("properties"), PropsObj))
					{
						Object.Properties = *PropsObj;
					}

					// Parse input pins
					if (const TArray<TSharedPtr<FJsonValue>>* InputPinsArray = nullptr; (*ObjObj)->TryGetArrayField(TEXT("inputPins"), InputPinsArray))
					{
						for (const TSharedPtr<FJsonValue>& PinValue : *InputPinsArray)
						{
							const TSharedPtr<FJsonObject>* PinObj = nullptr;
							if (PinValue->TryGetObject(PinObj))
							{
								FString PinId;
								if ((*PinObj)->TryGetStringField(TEXT("id"), PinId))
								{
									Object.InputPinIds.Add(PinId);
								}
							}
						}
					}

					// Parse output pins
					if (const TArray<TSharedPtr<FJsonValue>>* OutputPinsArray = nullptr; (*ObjObj)->TryGetArrayField(TEXT("outputPins"), OutputPinsArray))
					{
						for (const TSharedPtr<FJsonValue>& PinValue : *OutputPinsArray)
						{
							const TSharedPtr<FJsonObject>* PinObj = nullptr;
							if (PinValue->TryGetObject(PinObj))
							{
								FString PinId;
								if ((*PinObj)->TryGetStringField(TEXT("id"), PinId))
								{
									Object.OutputPinIds.Add(PinId);
								}
							}
						}
					}

					Package.Objects.Add(Object);
				}
			}

			// Parse connections
			if (const TArray<TSharedPtr<FJsonValue>>* ConnectionsArray = nullptr; (*PackageObj)->TryGetArrayField(TEXT("connections"), ConnectionsArray))
			{
				for (const TSharedPtr<FJsonValue>& ConnValue : *ConnectionsArray)
				{
					const TSharedPtr<FJsonObject>* ConnObj = nullptr;
					if (!ConnValue->TryGetObject(ConnObj))
					{
						continue;
					}

					FDialogueConnectionDef Connection;
					(*ConnObj)->TryGetStringField(TEXT("id"), Connection.Id);
					(*ConnObj)->TryGetStringField(TEXT("sourceId"), Connection.SourceId);
					(*ConnObj)->TryGetNumberField(TEXT("sourcePin"), Connection.SourcePin);
					(*ConnObj)->TryGetStringField(TEXT("targetId"), Connection.TargetId);
					(*ConnObj)->TryGetNumberField(TEXT("targetPin"), Connection.TargetPin);

					Package.Connections.Add(Connection);
				}
			}

			Packages.Add(Package);
		}
	}

	UE_LOG(LogDialogueEditor, Log, TEXT("Imported project '%s': %d namespaces, %d characters, %d packages"),
		*Project.Name, GlobalVariables.Num(), Characters.Num(), Packages.Num());

	return true;
}
