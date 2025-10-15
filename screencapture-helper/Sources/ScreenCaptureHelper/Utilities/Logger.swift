import Foundation

/// Logger that writes to stderr only (stdout reserved for JSON responses)
enum Logger {
    /// Log levels
    enum Level: String {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARN"
        case error = "ERROR"
    }

    /// Current log level (can be set via environment variable)
    static let currentLevel: Level = {
        if let envLevel = ProcessInfo.processInfo.environment["LOG_LEVEL"] {
            switch envLevel.uppercased() {
            case "DEBUG": return .debug
            case "INFO": return .info
            case "WARN", "WARNING": return .warning
            case "ERROR": return .error
            default: return .warning
            }
        }
        return .warning
    }()

    /// Log a debug message
    static func debug(_ message: String) {
        log(level: .debug, message: message)
    }

    /// Log an info message
    static func info(_ message: String) {
        log(level: .info, message: message)
    }

    /// Log a warning message
    static func warning(_ message: String) {
        log(level: .warning, message: message)
    }

    /// Log an error message
    static func error(_ message: String) {
        log(level: .error, message: message)
    }

    /// Internal logging function
    private static func log(level: Level, message: String) {
        // Only log if level is enabled
        guard shouldLog(level: level) else { return }

        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logMessage = "[\(timestamp)] [\(level.rawValue)] \(message)\n"

        // Write to stderr
        if let data = logMessage.data(using: .utf8) {
            FileHandle.standardError.write(data)
        }
    }

    /// Check if level should be logged
    private static func shouldLog(level: Level) -> Bool {
        let levels: [Level] = [.debug, .info, .warning, .error]
        guard let currentIndex = levels.firstIndex(of: currentLevel),
              let messageIndex = levels.firstIndex(of: level) else {
            return false
        }
        return messageIndex >= currentIndex
    }
}
