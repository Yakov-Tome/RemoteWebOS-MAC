import SwiftUI

struct ContentView: View {
    @State private var status: TVStatus?
    @State private var checked = false

    private var serverUp: Bool { status != nil }

    private var headline: String {
        guard let status else { return "השרת המקומי לא זמין" }
        if status.keyError == true { return "שמירת מפתח החיבור נכשלה" }
        if status.isConnected { return "מחובר לטלוויזיה · \(status.ip ?? "")" }
        if status.awaitingAuth == true { return "ממתין לאישור על מסך הטלוויזיה" }
        return "מחפש את הטלוויזיה · \(status.ip ?? "")"
    }

    private var ledColor: Color {
        guard let status else { return RemoteTheme.powerRed }
        if status.keyError == true { return RemoteTheme.powerRed }
        return status.isConnected ? RemoteTheme.powerGreen : RemoteTheme.warn
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Circle()
                    .fill(checked ? ledColor : RemoteTheme.muted)
                    .frame(width: 9, height: 9)
                Text(checked ? headline : "בודק...")
                    .font(.system(size: 13, weight: .medium))
                Spacer()
                Button("רענן") { Task { await refresh() } }
            }

            Divider()

            VStack(alignment: .leading, spacing: 9) {
                Text("איך מוסיפים את הווידג׳ט")
                    .font(.system(size: 13, weight: .semibold))
                step(1, "ודא שאפליקציית RemoteC פועלת — הווידג׳ט מדבר עם השרת שלה על "
                    + "\(RemoteServer.host):\(RemoteServer.port).")
                step(2, "לחץ ימני על שולחן העבודה ובחר \"עריכת ווידג׳טים\", או פתח את מרכז ההתראות.")
                step(3, "חפש \"RemoteC\" ובחר גודל: קטן, בינוני או גדול.")
            }

            if !serverUp && checked {
                Text("בלי השרת הכפתורים בווידג׳ט לא יעשו דבר. הפעל את RemoteC, "
                    + "או הרץ npm run server בתיקיית הפרויקט.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(22)
        .frame(width: 420)
        .environment(\.layoutDirection, .rightToLeft)
        .task { await refresh() }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Text("\(number).")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(text)
                .font(.system(size: 12))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func refresh() async {
        status = await RemoteClient.status()
        checked = true
    }
}
