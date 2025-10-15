import Foundation

/// Errors that can occur during capture operations
enum CaptureError: Error, Sendable {
    case permissionDenied(instructions: String)
    case permissionCheckFailed
    case userCancelled
    case timeout
    case invalidCommand(String)
    case invalidOptions(String)
    case invalidRegion
    case displayNotFound
    case windowNotFound
    case captureFailed(reason: String)
    case conversionFailed(reason: String)
    case fileWriteError(reason: String)
    case internalError(reason: String)

    /// Machine-readable error code for TypeScript integration
    var code: String {
        switch self {
        case .permissionDenied: return "PERMISSION_DENIED"
        case .permissionCheckFailed: return "PERMISSION_CHECK_FAILED"
        case .userCancelled: return "USER_CANCELLED"
        case .timeout: return "TIMEOUT"
        case .invalidCommand: return "INVALID_COMMAND"
        case .invalidOptions: return "INVALID_OPTIONS"
        case .invalidRegion: return "INVALID_REGION"
        case .displayNotFound: return "DISPLAY_NOT_FOUND"
        case .windowNotFound: return "WINDOW_NOT_FOUND"
        case .captureFailed: return "CAPTURE_FAILED"
        case .conversionFailed: return "ENCODING_FAILED"
        case .fileWriteError: return "FILE_WRITE_ERROR"
        case .internalError: return "INTERNAL_ERROR"
        }
    }

    /// Human-readable error message
    var message: String {
        switch self {
        case .permissionDenied(let instructions):
            return "Screen Recording permission not granted. \(instructions)"
        case .permissionCheckFailed:
            return "Unable to check Screen Recording permission status"
        case .userCancelled:
            return "User cancelled the capture operation"
        case .timeout:
            return "Capture operation timed out"
        case .invalidCommand(let command):
            return "Invalid command: \(command)"
        case .invalidOptions(let reason):
            return "Invalid command options: \(reason)"
        case .invalidRegion:
            return "Invalid region coordinates specified"
        case .displayNotFound:
            return "Specified display not found"
        case .windowNotFound:
            return "Specified window not found"
        case .captureFailed(let reason):
            return "Capture failed: \(reason)"
        case .conversionFailed(let reason):
            return "Image encoding failed: \(reason)"
        case .fileWriteError(let reason):
            return "Failed to write output file: \(reason)"
        case .internalError(let reason):
            return "Internal error: \(reason)"
        }
    }

    /// Optional additional details
    var details: [String: String]? {
        switch self {
        case .permissionDenied:
            return [
                "permissionStatus": "denied",
                "instructions": "Open System Settings > Privacy & Security > Screen Recording"
            ]
        default:
            return nil
        }
    }
}
