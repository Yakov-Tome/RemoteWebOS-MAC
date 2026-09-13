import AppIntents
import WidgetKit

/// One intent covers every plain key: the path is the payload, so the widget
/// layouts stay declarative and there is no intent-per-button boilerplate.
struct SendKeyIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Remote Key"
    static var description = IntentDescription("Sends a single key press to the LG TV.")
    static var isDiscoverable: Bool = false

    @Parameter(title: "Path")
    var path: String

    init() {}

    init(_ path: String) {
        self.path = path
    }

    func perform() async throws -> some IntentResult {
        await RemoteClient.post(path)
        return .result()
    }
}

/// Mute is the one key whose look depends on TV state, so it asks for a redraw.
struct ToggleMuteIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Mute"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        await RemoteClient.post("/api/mute/toggle")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

/// Same single key as the hardware remote: it turns the TV off when it is
/// reachable, and wakes it with Wake-on-LAN when it is not.
struct PowerIntent: AppIntent {
    static var title: LocalizedStringResource = "Power"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        let connected = await RemoteClient.status()?.isConnected ?? false
        await RemoteClient.post(connected ? "/api/power/off" : "/api/power/on")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
