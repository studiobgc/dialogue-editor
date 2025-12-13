# ArticyXImporter for Unreal - Architecture Analysis

This document analyzes the ArticyXImporterForUnreal plugin to understand key patterns for building our own dialogue tree editor with Unreal integration.

---

## Plugin Structure Overview

```
ArticyXImporter/
├── ArticyXImporter.uplugin          # Plugin descriptor
├── Source/
│   ├── ArticyRuntime/               # Runtime module (game-time code)
│   │   ├── ArticyRuntime.Build.cs
│   │   ├── Public/                  # Headers exposed to game code
│   │   │   ├── ArticyDatabase.h     # Central data access
│   │   │   ├── ArticyObject.h       # Base object class
│   │   │   ├── ArticyFlowPlayer.h   # Flow traversal component
│   │   │   ├── ArticyGlobalVariables.h
│   │   │   ├── ArticyExpressoScripts.h
│   │   │   ├── ArticyRef.h          # Reference to articy objects
│   │   │   └── Interfaces/          # 25 interface files
│   │   └── Private/                 # Implementation files
│   │
│   └── ArticyEditor/                # Editor-only module
│       ├── ArticyEditor.Build.cs
│       ├── Public/
│       │   ├── ArticyImportData.h   # Import data container
│       │   ├── ArticyJSONFactory.h  # JSON import factory
│       │   ├── ObjectDefinitionsImport.h
│       │   ├── PackagesImport.h
│       │   └── Customizations/      # Property customizations
│       └── Private/
│           ├── CodeGeneration/      # 20 files for generating C++ code
│           ├── Slate/               # Custom UI widgets
│           └── BuildToolParser/     # Build.cs file modification
└── Content/                         # Blueprint assets
```

---

## Key Architecture Patterns

### 1. Two-Module Design

| Module | Type | Purpose |
|--------|------|---------|
| **ArticyRuntime** | Runtime | Ships with game, provides flow player, database access, global variables |
| **ArticyEditor** | Editor | Import pipeline, code generation, asset creation, property customization |

**Why This Matters:**
- Runtime stays lightweight for shipped games
- Editor complexity doesn't bloat final build
- Clear separation of import vs execution logic

### 2. Data Model Hierarchy

```
UDataAsset
└── UArticyBaseObject              # Base for all articy objects
    ├── Subobjects (TMap<FArticyId, UArticyPrimitive*>)
    └── ArticyType

UArticyPrimitive                    # Simplest articy object
└── UArticyObject                   # Has parent/children, technical name
    └── UArticyNode (abstract)      # Base for flow nodes
        ├── UArticyFlowFragment
        ├── UArticyDialogue
        ├── UArticyDialogueFragment
        ├── UArticyHub
        └── UArticyJump

UArticyFlowPin                      # Input/Output pins
├── UArticyInputPin                 # Has conditions (IArticyConditionProvider)
└── UArticyOutputPin                # Has instructions (IArticyInstructionProvider)
```

### 3. Interface-Based Design

Articy uses **25 interfaces** to define capabilities:

| Interface | Purpose |
|-----------|---------|
| `IArticyFlowObject` | Can be traversed by FlowPlayer |
| `IArticyConditionProvider` | Can evaluate conditions |
| `IArticyInstructionProvider` | Can execute instructions |
| `IArticyInputPinsProvider` | Has input pins |
| `IArticyOutputPinsProvider` | Has output pins |
| `IArticyObjectWithText` | Has text property |
| `IArticyObjectWithSpeaker` | Has speaker reference |
| `IArticyObjectWithDisplayName` | Has display name |
| `IArticyReflectable` | Can be reflected for property access |

**Key Insight:** These interfaces allow querying without casting:
```cpp
// Blueprint-friendly interface calls work without knowing concrete type
if (auto* WithText = Cast<IArticyObjectWithText>(Object))
{
    FText DialogueText = WithText->GetText();
}
```

### 4. ID System

```cpp
USTRUCT(BlueprintType)
struct FArticyId
{
    UPROPERTY()
    uint64 Low = 0;   // Combined into 128-bit ID
    UPROPERTY()
    uint64 High = 0;
};

USTRUCT(BlueprintType)
struct FArticyRef
{
    FArticyId Id;
    bool bReferenceBaseObject = true;
    int32 CloneId = 0;  // For object cloning/instancing
};
```

**Why 128-bit IDs?**
- Globally unique across projects
- Stable across exports/reimports
- Supports cloning with clone IDs

---

## Import Pipeline

### Flow: Export → Import → Code Gen → Compile → Asset Gen

```
articy:draft X
      ↓ (Export .articyue file)
┌─────────────────────────────────────────────┐
│ UArticyJSONFactory                          │
│   ├── FactoryCanImport() - detect file type │
│   └── FactoryCreateFile() - trigger import  │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ UArticyArchiveReader                        │
│   └── Parse .articyue (zipped JSON bundle) │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ UArticyImportData                           │
│   ├── Settings (FAdiSettings)               │
│   ├── Project (FArticyProjectDef)           │
│   ├── GlobalVariables (FArticyGVInfo)       │
│   ├── ObjectDefinitions (FArticyObjectDefs) │
│   ├── PackageDefs (FArticyPackageDefs)      │
│   ├── UserMethods (FAIDUserMethods)         │
│   ├── Hierarchy (FADIHierarchy)             │
│   └── ScriptFragments                       │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ CodeGenerator                               │
│   ├── GlobalVarsGenerator                   │
│   ├── DatabaseGenerator                     │
│   ├── ObjectDefinitionsGenerator            │
│   ├── ExpressoScriptsGenerator              │
│   ├── InterfacesGenerator                   │
│   └── PackagesGenerator                     │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ Hot Reload / Compile                        │
│   └── Generate .h files in ArticyGenerated/ │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ Asset Generation                            │
│   ├── UArticyDatabase asset                 │
│   ├── UArticyPackage assets                 │
│   └── Individual object assets              │
└─────────────────────────────────────────────┘
```

### Code Generation Pattern

Generated files go to: `Source/<ProjectName>/ArticyGenerated/`

```cpp
// Example: Generated GlobalVariables class
// <ProjectName>GlobalVariables.h

UCLASS(BlueprintType)
class U<ProjectName>GlobalVariables : public UArticyGlobalVariables
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly)
    U<ProjectName>QuestVariables* Quest;  // Namespace
    
    UPROPERTY(BlueprintReadOnly)
    U<ProjectName>PlayerVariables* Player;
};

// Each namespace becomes a class with typed variables
UCLASS()
class U<ProjectName>QuestVariables : public UArticyBaseVariableSet
{
    UPROPERTY(BlueprintReadWrite)
    UArticyBool* MainQuestComplete;
    
    UPROPERTY(BlueprintReadWrite)
    UArticyInt* CurrentObjective;
};
```

---

## Flow Player System

The `UArticyFlowPlayer` is an **ActorComponent** that handles dialogue traversal:

### Key Concepts

1. **Pause Types** - Flow pauses on certain node types:
```cpp
UENUM(BlueprintType, meta = (Bitflags))
enum class EArticyPausableType : uint8
{
    FlowFragment,
    Dialogue,
    DialogueFragment,
    Hub,
    Jump,
    Condition,
    Instruction,
    Pin
};
```

2. **Branch Exploration** - Flow player explores ahead to find valid branches:
```cpp
USTRUCT(BlueprintType)
struct FArticyBranch
{
    TArray<TScriptInterface<IArticyFlowObject>> Path;
    bool bIsValid = true;  // All conditions passed
    int32 Index = -1;
};
```

3. **Shadow State** - Speculative execution without side effects:
```cpp
template<typename Lambda>
void UArticyFlowPlayer::ShadowedOperation(Lambda Operation) const
{
    ++ShadowLevel;
    GetGVs()->PushState(ShadowLevel);  // Save variable state
    
    Operation();  // Execute speculatively
    
    GetGVs()->PopState(ShadowLevel);   // Restore state
    --ShadowLevel;
}
```

4. **Events/Delegates**:
```cpp
UPROPERTY(BlueprintAssignable)
FOnPlayerPaused OnPlayerPaused;  // Called when flow pauses

UPROPERTY(BlueprintAssignable)
FOnBranchesUpdated OnBranchesUpdated;  // Called when branches change
```

---

## Database System

`UArticyDatabase` is a singleton providing object access:

```cpp
UCLASS(Config = Game)
class UArticyDatabase : public UDataAsset, public IShadowStateManager
{
    // Singleton access
    static UArticyDatabase* Get(const UObject* WorldContext);
    
    // Object retrieval
    UArticyObject* GetObject(FArticyId Id, int32 CloneId = 0);
    UArticyObject* GetObjectByName(FName TechnicalName, int32 CloneId = 0);
    TArray<UArticyObject*> GetObjectsOfClass(TSubclassOf<UArticyObject> Class);
    
    // Cloning system
    UArticyObject* CloneFrom(FArticyId Id, int32 NewCloneId = -1);
    
    // Package management
    void LoadPackage(FString PackageName);
    bool UnloadPackage(FString PackageName);
    
protected:
    TMap<FArticyId, UArticyCloneableObject*> LoadedObjectsById;
    TMap<FName, FArticyDatabaseObjectArray> LoadedObjectsByName;
};
```

---

## Expresso Script System

Articy's scripting language "Expresso" is transpiled to C++:

```cpp
// In articy:draft: player.health > 50 && hasItem("key")
// Becomes C++ in generated ExpressoScripts class:

bool EvaluateCondition_12345(UArticyGlobalVariables* GV, UObject* MethodProvider)
{
    return GV->Player->Health->Get() > 50 
        && IMyProjectMethodsProvider::Execute_hasItem(MethodProvider, TEXT("key"));
}
```

### Custom Script Methods

User-defined methods are exposed via generated interface:
```cpp
UINTERFACE()
class U<ProjectName>MethodsProvider : public UInterface { };

class I<ProjectName>MethodsProvider
{
    UFUNCTION(BlueprintNativeEvent)
    bool hasItem(const FString& ItemId);
    
    UFUNCTION(BlueprintNativeEvent)
    void giveReward(int32 Amount);
};
```

---

## Key Lessons for Our Implementation

### 1. Module Structure
- **Runtime module**: Flow player, database, variables, object types
- **Editor module**: Import, code generation, asset creation, UI customizations
- Keep runtime minimal for shipping

### 2. Data Model
- Use **UDataAsset** for persistent objects
- Implement **interface-based capabilities** (IObjectWithText, IObjectWithSpeaker, etc.)
- Use **128-bit IDs** for stability
- Support **cloning** for multiple dialogue instances

### 3. Import Pipeline
- Parse JSON export from editor tool
- **Generate C++ code** for project-specific types
- Trigger **hot reload** after code generation
- Generate **UAsset files** for runtime data

### 4. Flow System
- **ActorComponent** for flow player
- **Branch exploration** with shadow state
- **Delegates/Events** for Blueprint integration
- **Pause types** for granular control

### 5. Blueprint Integration
- Use `UFUNCTION(BlueprintCallable)` extensively
- `UPROPERTY(BlueprintReadOnly/BlueprintReadWrite)` for all data
- **TScriptInterface** for interface-based parameters
- Property customizations for editor UX

### 6. Export Format
We should create a similar JSON-based format:
```json
{
  "Project": { "Name": "...", "TechnicalName": "...", "Guid": "..." },
  "Settings": { ... },
  "GlobalVariables": [ { "Namespace": "...", "Variables": [...] } ],
  "ObjectDefinitions": { ... },
  "Packages": [ ... ],
  "Hierarchy": { ... }
}
```

---

## Files to Study Further

| File | Purpose |
|------|---------|
| `ArticyFlowPlayer.cpp` | Flow traversal logic |
| `ArticyDatabase.cpp` | Object storage/retrieval |
| `ArticyExpressoScripts.cpp` | Script evaluation |
| `CodeGenerator.cpp` | C++ code generation |
| `ArticyImportData.cpp` | JSON parsing |
| `ObjectDefinitionsImport.cpp` | Type definitions |
| `PackagesImport.cpp` | Asset creation |

---

## Recommended Implementation Order

1. **Phase 1: Desktop Editor (Tauri)**
   - Node-based graph editor
   - Data model matching articy structure
   - JSON export format

2. **Phase 2: Unreal Runtime Module**
   - `UDialogueDatabase` (like ArticyDatabase)
   - `UDialogueObject` hierarchy
   - `UDialogueFlowPlayer` component
   - Global variables system

3. **Phase 3: Unreal Editor Module**
   - JSON import factory
   - Code generation (if using project-specific types)
   - Asset generation
   - Property customizations

4. **Phase 4: Integration**
   - Automatic import on export
   - Blueprint integration
   - Voice/audio linking
