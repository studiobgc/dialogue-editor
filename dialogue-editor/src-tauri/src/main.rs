#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod graph;
mod commands;
mod validation;
mod export;

use commands::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Graph operations
            new_graph,
            load_graph,
            save_graph,
            get_graph,
            
            // Node operations
            add_node,
            remove_node,
            update_node,
            clone_node,
            
            // Connection operations
            add_connection,
            remove_connection,
            
            // Validation
            validate_graph,
            
            // Export
            export_for_unreal,
            export_json,
            
            // Variables
            add_variable_namespace,
            add_variable,
            
            // Characters
            add_character,
            update_character,
            remove_character,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
