import SwiftUI

/// The widget cannot live on its own — macOS only offers widgets that ship
/// inside an app. This container is deliberately thin: it exists so the widget
/// can be installed, and so a failure has somewhere to be explained.
@main
struct RemoteCWidgetApp: App {
    var body: some Scene {
        WindowGroup("RemoteC Widget") {
            ContentView()
        }
        .windowResizability(.contentSize)
    }
}
