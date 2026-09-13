import Foundation

/// The widget never speaks SSAP to the TV itself. It drives the same local HTTP
/// server the Electron remote already runs, so pairing, the stored client key and
/// the protocol stay in exactly one place — the widget is just another client.
///
/// That means the server has to be up: either the RemoteC app is running, or
/// `npm run server` is.
enum RemoteServer {
    static let host = "127.0.0.1"

    /// Must match `"port"` in config.json (3030 unless you changed it).
    static let port = 3030

    static func url(_ path: String) -> URL {
        URL(string: "http://\(host):\(port)\(path)")!
    }
}

/// Mirrors the object returned by `GET /api/status`. Every field is optional
/// because a half-connected TV omits some of them.
struct TVStatus: Decodable {
    var ip: String?
    var connected: Bool?
    var awaitingAuth: Bool?
    var keyError: Bool?

    var isConnected: Bool { connected == true }
}

/// `POST /api/...` routes answer `{ ok, result }`; `/api/audio` hides the mute
/// flag inside `result`.
private struct Envelope<T: Decodable>: Decodable {
    let ok: Bool?
    let result: T?
}

private struct AudioState: Decodable {
    let mute: Bool?
    let volume: Int?
}

enum RemoteClient {
    /// Ephemeral and short-timeout on purpose: a widget button that hangs for
    /// 60s on an unreachable server is worse than one that fails fast.
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 3
        config.timeoutIntervalForResource = 5
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()

    @discardableResult
    static func post(_ path: String) async -> Bool {
        var request = URLRequest(url: RemoteServer.url(path))
        request.httpMethod = "POST"
        do {
            let (_, response) = try await session.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    static func status() async -> TVStatus? {
        do {
            let (data, _) = try await session.data(from: RemoteServer.url("/api/status"))
            return try JSONDecoder().decode(TVStatus.self, from: data)
        } catch {
            return nil
        }
    }

    static func isMuted() async -> Bool {
        do {
            let (data, _) = try await session.data(from: RemoteServer.url("/api/audio"))
            let envelope = try JSONDecoder().decode(Envelope<AudioState>.self, from: data)
            return envelope.result?.mute ?? false
        } catch {
            return false
        }
    }
}
