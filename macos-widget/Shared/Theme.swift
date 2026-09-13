import SwiftUI

/// Same graphite-and-red palette as the Electron remote, so the widget reads as
/// the same product rather than a second one.
enum RemoteTheme {
    static let cardTop = Color(red: 0.17, green: 0.19, blue: 0.22)
    static let cardBottom = Color(red: 0.09, green: 0.10, blue: 0.12)

    static let keyTop = Color(red: 0.19, green: 0.20, blue: 0.23)
    static let keyBottom = Color(red: 0.13, green: 0.14, blue: 0.17)
    static let legend = Color(red: 0.78, green: 0.81, blue: 0.85)
    static let muted = Color(red: 0.60, green: 0.64, blue: 0.69)

    static let powerRed = Color(red: 0.84, green: 0.29, blue: 0.29)
    static let powerGreen = Color(red: 0.31, green: 0.76, blue: 0.48)
    static let muteBlue = Color(red: 0.36, green: 0.61, blue: 1.0)
    static let warn = Color(red: 0.91, green: 0.69, blue: 0.30)

    static var card: LinearGradient {
        LinearGradient(colors: [cardTop, cardBottom], startPoint: .top, endPoint: .bottom)
    }

    static func key(_ tint: Color?) -> LinearGradient {
        if let tint {
            return LinearGradient(
                colors: [tint, tint.opacity(0.78)], startPoint: .top, endPoint: .bottom)
        }
        return LinearGradient(colors: [keyTop, keyBottom], startPoint: .top, endPoint: .bottom)
    }
}
