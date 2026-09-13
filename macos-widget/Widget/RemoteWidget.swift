import SwiftUI
import WidgetKit

struct RemoteEntry: TimelineEntry {
    let date: Date
    let status: TVStatus?
    let muted: Bool
}

/// The timeline only carries the LED and the mute tint. Everything else is a
/// button, so the widget has no reason to poll often: presses refresh it, and
/// the periodic reload is just a slow correction for changes made elsewhere.
struct RemoteProvider: TimelineProvider {
    func placeholder(in context: Context) -> RemoteEntry {
        RemoteEntry(date: Date(), status: nil, muted: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (RemoteEntry) -> Void) {
        Task { completion(await load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RemoteEntry>) -> Void) {
        Task {
            let entry = await load()
            let next = Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func load() async -> RemoteEntry {
        let status = await RemoteClient.status()
        let muted = status?.isConnected == true ? await RemoteClient.isMuted() : false
        return RemoteEntry(date: Date(), status: status, muted: muted)
    }
}

struct RemoteWidget: Widget {
    let kind = "RemoteCWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RemoteProvider()) { entry in
            RemoteWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    RemoteTheme.card
                }
        }
        .configurationDisplayName("שלט LG")
        .description("שליטה בטלוויזיה ישירות מהווידג׳ט. דורש שאפליקציית RemoteC תרוץ.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
