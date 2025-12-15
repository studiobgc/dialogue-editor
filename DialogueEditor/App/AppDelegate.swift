import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    
    var mainWindowController: MainWindowController?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create and show the main window
        mainWindowController = MainWindowController()
        mainWindowController?.showWindow(nil)
        
        // Configure app appearance for De Palma aesthetic
        NSApp.appearance = NSAppearance(named: .darkAqua)
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Cleanup
    }
    
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
