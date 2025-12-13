// Copyright Dialogue Editor Team. All Rights Reserved.

using UnrealBuildTool;

public class DialogueEditor : ModuleRules
{
	public DialogueEditor(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"DialogueRuntime",
			"Json",
			"JsonUtilities"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore",
			"UnrealEd",
			"AssetTools",
			"ContentBrowser",
			"PropertyEditor",
			"EditorStyle",
			"Projects",
			"InputCore",
			"GameProjectGeneration",
			"SourceControl"
		});
	}
}
