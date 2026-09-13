import AppIntents
import SwiftUI
import WidgetKit

/// A single round key. Generic over the intent so one view serves plain keys,
/// mute and power without a wrapper type per button.
struct RemoteKey<I: AppIntent>: View {
    let intent: I
    var symbol: String? = nil
    var label: String? = nil
    var tint: Color? = nil
    var foreground: Color = RemoteTheme.legend
    var symbolSize: CGFloat = 13
    var labelSize: CGFloat = 8.5

    var body: some View {
        Button(intent: intent) {
            ZStack {
                Circle()
                    .fill(RemoteTheme.key(tint))
                    .overlay(Circle().strokeBorder(.white.opacity(0.09), lineWidth: 0.5))
                if let symbol {
                    Image(systemName: symbol)
                        .font(.system(size: symbolSize, weight: .semibold))
                        .foregroundStyle(foreground)
                } else if let label {
                    Text(label)
                        .font(.system(size: labelSize, weight: .bold))
                        .foregroundStyle(foreground)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

/// Keeps the directional cross readable by leaving its corners empty.
private struct Blank: View {
    var body: some View { Color.clear }
}

private enum Key {
    static func send(_ path: String) -> SendKeyIntent { SendKeyIntent(path) }
}

struct StatusHeader: View {
    let entry: RemoteEntry
    var showsText: Bool = true

    private var ledColor: Color {
        guard let status = entry.status else { return RemoteTheme.powerRed }
        if status.keyError == true { return RemoteTheme.powerRed }
        return status.isConnected ? RemoteTheme.powerGreen : RemoteTheme.warn
    }

    private var text: String {
        guard let status = entry.status else { return "השרת לא זמין" }
        if status.keyError == true { return "שמירת מפתח נכשלה" }
        if status.isConnected { return "מחובר" }
        if status.awaitingAuth == true { return "אשר בטלוויזיה" }
        return "מחפש טלוויזיה"
    }

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(ledColor)
                .frame(width: 6, height: 6)
            if showsText {
                Text(text)
                    .font(.system(size: 9.5, weight: .medium))
                    .foregroundStyle(RemoteTheme.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            Text("LG")
                .font(.system(size: 9, weight: .bold))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.32))
        }
    }
}

struct RemoteWidgetView: View {
    let entry: RemoteEntry

    @Environment(\.widgetFamily) private var family

    private var powerTint: Color {
        (entry.status?.isConnected ?? false) ? RemoteTheme.powerRed : RemoteTheme.powerGreen
    }

    private var muteTint: Color? { entry.muted ? RemoteTheme.muteBlue : nil }

    private var powerKey: some View {
        RemoteKey(intent: PowerIntent(), symbol: "power", tint: powerTint, foreground: .white)
    }

    private var muteKey: some View {
        RemoteKey(
            intent: ToggleMuteIntent(),
            symbol: "speaker.slash.fill",
            tint: muteTint,
            foreground: entry.muted ? .white : RemoteTheme.legend)
    }

    private var okKey: some View {
        RemoteKey(intent: Key.send("/api/button/ENTER"), label: "OK", labelSize: 11)
    }

    var body: some View {
        VStack(spacing: 7) {
            StatusHeader(entry: entry, showsText: family != .systemSmall)
            switch family {
            case .systemSmall: small
            case .systemLarge: large
            default: medium
            }
        }
    }

    /// Nine keys: power, mute, volume and the full cross — the set you use
    /// without looking at the screen.
    private var small: some View {
        Grid(horizontalSpacing: 5, verticalSpacing: 5) {
            GridRow {
                RemoteKey(intent: Key.send("/api/volume/up"), label: "VOL+")
                RemoteKey(intent: Key.send("/api/button/UP"), symbol: "chevron.up")
                powerKey
            }
            GridRow {
                RemoteKey(intent: Key.send("/api/button/LEFT"), symbol: "chevron.left")
                okKey
                RemoteKey(intent: Key.send("/api/button/RIGHT"), symbol: "chevron.right")
            }
            GridRow {
                RemoteKey(intent: Key.send("/api/volume/down"), label: "VOL−")
                RemoteKey(intent: Key.send("/api/button/DOWN"), symbol: "chevron.down")
                muteKey
            }
        }
    }

    /// The navigation cross keeps its own block so it still reads as a D-pad;
    /// everything else sits in a second grid beside it.
    private var medium: some View {
        HStack(spacing: 10) {
            Grid(horizontalSpacing: 5, verticalSpacing: 5) {
                GridRow {
                    Blank()
                    RemoteKey(intent: Key.send("/api/button/UP"), symbol: "chevron.up")
                    Blank()
                }
                GridRow {
                    RemoteKey(intent: Key.send("/api/button/LEFT"), symbol: "chevron.left")
                    okKey
                    RemoteKey(intent: Key.send("/api/button/RIGHT"), symbol: "chevron.right")
                }
                GridRow {
                    Blank()
                    RemoteKey(intent: Key.send("/api/button/DOWN"), symbol: "chevron.down")
                    Blank()
                }
            }
            Grid(horizontalSpacing: 5, verticalSpacing: 5) {
                GridRow {
                    RemoteKey(intent: Key.send("/api/volume/up"), label: "VOL+")
                    RemoteKey(intent: Key.send("/api/channel/up"), label: "CH+")
                    powerKey
                }
                GridRow {
                    muteKey
                    RemoteKey(intent: Key.send("/api/media/pause"), symbol: "playpause.fill")
                    RemoteKey(intent: Key.send("/api/button/BACK"), symbol: "arrow.uturn.backward")
                }
                GridRow {
                    RemoteKey(intent: Key.send("/api/volume/down"), label: "VOL−")
                    RemoteKey(intent: Key.send("/api/channel/down"), label: "CH−")
                    RemoteKey(intent: Key.send("/api/button/HOME"), symbol: "house.fill")
                }
            }
        }
    }

    /// Everything the compact remote has, plus the media transport row.
    private var large: some View {
        Grid(horizontalSpacing: 6, verticalSpacing: 6) {
            GridRow {
                powerKey
                RemoteKey(intent: Key.send("/api/volume/up"), label: "VOL+")
                RemoteKey(intent: Key.send("/api/button/UP"), symbol: "chevron.up")
                RemoteKey(intent: Key.send("/api/channel/up"), label: "CH+")
                muteKey
            }
            GridRow {
                RemoteKey(intent: Key.send("/api/button/BACK"), symbol: "arrow.uturn.backward")
                RemoteKey(intent: Key.send("/api/button/LEFT"), symbol: "chevron.left")
                okKey
                RemoteKey(intent: Key.send("/api/button/RIGHT"), symbol: "chevron.right")
                RemoteKey(intent: Key.send("/api/button/HOME"), symbol: "house.fill")
            }
            GridRow {
                RemoteKey(intent: Key.send("/api/button/EXIT"), label: "EXIT")
                RemoteKey(intent: Key.send("/api/volume/down"), label: "VOL−")
                RemoteKey(intent: Key.send("/api/button/DOWN"), symbol: "chevron.down")
                RemoteKey(intent: Key.send("/api/channel/down"), label: "CH−")
                RemoteKey(intent: Key.send("/api/button/INFO"), label: "INFO")
            }
            GridRow {
                RemoteKey(intent: Key.send("/api/media/rewind"), symbol: "backward.fill")
                RemoteKey(intent: Key.send("/api/media/play"), symbol: "play.fill")
                RemoteKey(intent: Key.send("/api/media/pause"), symbol: "pause.fill")
                RemoteKey(intent: Key.send("/api/media/stop"), symbol: "stop.fill")
                RemoteKey(intent: Key.send("/api/media/forward"), symbol: "forward.fill")
            }
        }
    }
}
