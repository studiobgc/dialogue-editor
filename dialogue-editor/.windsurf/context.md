# Dialogue Editor - Windsurf Context

This file helps Cascade maintain context about the current project state.

## Current Project: Dinner Party Labyrinth

### Game Concept
- **Genre**: Social combat roguelike
- **Premise**: Endless apartment dinner party where you fight by speaking
- **Tone**: Elaine May sharp comedy, shame-based, then uncanny
- **Core Loop**: Isaac mechanics reskinned as social navigation

### Characters
| ID | Name | Color | Role |
|----|------|-------|------|
| char_p | YOU | #B8C0FF | Player protagonist |
| char_host | Mara | #E0E0E0 | The host, curates everything |
| char_partner | Eli | #C7F9CC | Mara's partner, enforcer |
| char_guest1 | Dana | #FFD6A5 | Observer, enjoys friction |

### Game Variables
- `Game.tension` - Rises when truth enters uninvited
- `Game.suspicion` - When they notice you're playing a game
- `Game.rapport_mara` - Dangerous leash - the more she likes you...
- `Game.roomMood` - Social temperature (polite, managed, knife_in_velvet)

### Room Moods
- `polite` - Opening gambit
- `managed` - Working to keep it together
- `tight_smile` - You've made a mistake
- `knife_in_velvet` - They've decided something
- `spark` - Someone's about to fight
- `curious` - Dangerous but interesting

### Four Stances (Player Choices)
1. **PERSUADE** - Make them like you so they let you go
2. **HONEST** - Tell truth, hope for respect
3. **FIGHT** - Wound elegantly for respect
4. **STEALTH** - Disappear before noticed

### Act Structure
- **Act 1**: The Arrival (15-20 min) - 3 scenes
- **Act 2**: The Main Course (25-35 min) - 4 scenes  
- **Act 3**: Dessert & Departure (20-30 min) - 4 scenes

### Current Progress
- [x] Act 1, Scene 1: The First Course (imported)
- [ ] Act 1, Scene 2: The Kitchen
- [ ] Act 1, Scene 3: The Hallway Decision
- [ ] Act 2+

---

## MCP Integration

The dialogue editor connects to Cascade via MCP server on `ws://localhost:9999`.

### Available Tools
- `get_graph_state` - See all nodes/characters
- `get_selected_nodes` - What's selected in editor
- `edit_node_text` - Rewrite dialogue
- `add_dialogue_node` - Add new lines
- `add_hub_node` - Add player choices
- `connect_nodes` - Wire nodes together
- `add_character` - New characters

### Auto-Save
- Saves every 30 seconds
- Saves on MCP command execution
- Saves on tab switch/page unload
- Data stored in localStorage

---

## Quick Reference

To edit dialogue, I can say things like:
- "Make Mara's line more passive-aggressive"
- "Add Dana saying something observant after node_4"
- "Create a branch with 3 player options"

The editor will live-reload without page refresh.
