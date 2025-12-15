# AI Dialogue Generation Prompt

Use this prompt when asking an AI to generate dialogue trees for your game. Copy and paste everything below the line, filling in the `[BRACKETS]` with your specific details.

---

## PROMPT TO COPY:

```
You are a professional game narrative designer. Generate a complete dialogue tree in JSON format that can be directly imported into a dialogue editor.

## GAME CONTEXT
- **Game Title**: [YOUR GAME NAME]
- **Genre**: [e.g., RPG, Visual Novel, Adventure, etc.]
- **Tone**: [e.g., dark fantasy, comedic, serious, whimsical]
- **Setting**: [Brief description of world/time period]

## THIS SCENE
- **Scene Name**: [e.g., "Tavern Introduction", "Boss Confrontation"]
- **Location**: [Where does this take place?]
- **Context**: [What just happened? What's the player trying to do?]
- **Player Goal**: [What should the player accomplish in this dialogue?]

## CHARACTERS IN THIS SCENE
[List each character with:]
- Name:
- Role: [protagonist/NPC/antagonist]
- Personality: [2-3 key traits]
- Voice: [How do they speak? Formal, casual, accent?]
- Color: [Hex color for their dialogue, e.g., #4a90e2]

## BRANCHING REQUIREMENTS
- **Minimum branches**: [e.g., 3 different paths]
- **Should include**: [e.g., persuasion option, combat option, stealth option]
- **Variables to track**: [e.g., relationship points, quest flags, inventory checks]
- **Conditions needed**: [e.g., "if player has sword", "if charisma > 10"]

## OUTPUT FORMAT
Generate valid JSON matching this exact schema:

{
  "version": "1.0",
  "metadata": {
    "title": "Scene Title",
    "description": "Brief description",
    "author": "AI Generated",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "characters": [
    {
      "id": "char_uniqueid",
      "name": "Character Name",
      "color": "#hexcolor",
      "description": "Brief character description"
    }
  ],
  "variables": {
    "namespace": {
      "variableName": defaultValue
    }
  },
  "acts": [
    {
      "id": "act_1",
      "name": "Act Name",
      "scenes": [
        {
          "id": "scene_1", 
          "name": "Scene Name",
          "location": "Location Name",
          "conversations": [
            {
              "id": "conv_1",
              "name": "Conversation Name",
              "startNodeId": "node_1",
              "nodes": [
                {
                  "id": "node_1",
                  "type": "dialogueFragment",
                  "speaker": "char_uniqueid",
                  "text": "What the character says",
                  "menuText": "Short version for choice menus (optional)",
                  "stageDirections": "[Action/emotion notes] (optional)",
                  "outputs": [
                    { "label": "Choice text (optional)", "targetNodeId": "node_2" }
                  ]
                },
                {
                  "id": "node_condition",
                  "type": "condition",
                  "condition": "Game.playerHasSword == true",
                  "outputs": [
                    { "label": "True", "targetNodeId": "node_hassword" },
                    { "label": "False", "targetNodeId": "node_nosword" }
                  ]
                },
                {
                  "id": "node_instruction",
                  "type": "instruction",
                  "instruction": "Game.questStarted = true",
                  "outputs": [
                    { "targetNodeId": "node_next" }
                  ]
                },
                {
                  "id": "node_hub",
                  "type": "hub",
                  "outputs": [
                    { "label": "Option A", "targetNodeId": "node_a" },
                    { "label": "Option B", "targetNodeId": "node_b" },
                    { "label": "Option C", "targetNodeId": "node_c" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

## NODE TYPES
- **dialogueFragment**: Character speaks (requires speaker, text)
- **hub**: Player choice point (multiple outputs with labels)
- **condition**: Branch based on game state (requires condition expression)
- **instruction**: Set game variables (requires instruction expression)
- **jump**: Jump to another node (use targetNodeId)

## RULES
1. Every node must have a unique ID
2. Every node must have at least one output (except ending nodes)
3. Use character IDs (not names) in speaker field
4. Condition expressions use format: Namespace.Variable == value
5. Instruction expressions use format: Namespace.Variable = value
6. Hub nodes should have 2-5 meaningful choices
7. Include stage directions for important emotions/actions
8. menuText should be short (under 50 chars) for UI display

## GENERATE NOW
Create a complete, branching dialogue tree with:
- At least [X] dialogue nodes
- At least [X] player choice points
- At least [X] different endings/outcomes
- Appropriate conditions and instructions for game state

Output ONLY valid JSON, no explanations or markdown.
```

---

## EXAMPLE FILLED PROMPT:

```
You are a professional game narrative designer. Generate a complete dialogue tree in JSON format.

## GAME CONTEXT
- **Game Title**: Shadows of Thornwood
- **Genre**: Dark Fantasy RPG
- **Tone**: Grim, morally ambiguous
- **Setting**: Medieval kingdom plagued by corruption

## THIS SCENE
- **Scene Name**: The Informant
- **Location**: Backroom of the Rusted Tankard tavern
- **Context**: Player is investigating the missing merchant guild shipments
- **Player Goal**: Get information about who's behind the thefts

## CHARACTERS IN THIS SCENE
- Name: Vex
  Role: NPC informant
  Personality: Paranoid, greedy, knows too much
  Voice: Whispers, lots of pauses, street slang
  Color: #7c3aed

- Name: Player
  Role: Protagonist
  Personality: Determined investigator
  Voice: Can be threatening, persuasive, or cunning
  Color: #3b82f6

## BRANCHING REQUIREMENTS
- **Minimum branches**: 3 different approaches
- **Should include**: Bribe option, threaten option, persuade option
- **Variables to track**: Game.gold, Game.vexTrust, Game.knowsThiefIdentity
- **Conditions needed**: Check if player has 50+ gold for bribe

## GENERATE NOW
Create a complete, branching dialogue tree with:
- At least 15 dialogue nodes
- At least 3 player choice points  
- At least 2 different outcomes (gets info vs doesn't)
- Appropriate conditions and instructions
```

---

## TIPS FOR BEST RESULTS

1. **Be specific about tone** - "sarcastic medieval knight" is better than "funny"
2. **Give relationship context** - Does the NPC trust the player? Are they enemies?
3. **Define failure states** - What happens if the player makes wrong choices?
4. **Include emotional beats** - Not just information exchange
5. **Set word count expectations** - "Short punchy lines" vs "verbose monologues"
