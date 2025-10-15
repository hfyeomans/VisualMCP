import Foundation

/// Response type enum for pattern matching
enum ResponseType: Sendable {
    case success(requestId: String, result: CaptureResult)
    case error(requestId: String?, code: String, message: String, details: [String: String]?)
}

/// Success response
struct SuccessResponse: Codable, Sendable {
    let success: Bool
    let requestId: String
    let result: CaptureResult

    init(requestId: String, result: CaptureResult) {
        self.success = true
        self.requestId = requestId
        self.result = result
    }
}

/// Error response
struct ErrorResponse: Codable, Sendable {
    let success: Bool
    let requestId: String?
    let error: ErrorDetail

    init(requestId: String?, error: ErrorDetail) {
        self.success = false
        self.requestId = requestId
        self.error = error
    }
}

/// Error detail structure
struct ErrorDetail: Codable, Sendable {
    let code: String
    let message: String
    let details: [String: String]?
}

/// Capture result matching TypeScript NativeCaptureResult
struct CaptureResult: Codable, Sendable {
    let filepath: String
    let width: Int
    let height: Int
    let format: String
    let size: Int
    let timestamp: String
    let metadata: CaptureMetadata?
}

/// Capture metadata
struct CaptureMetadata: Codable, Sendable {
    let displayId: UInt32?
    let windowTitle: String?
    let appName: String?
    let platform: String
    let wasInteractive: Bool?

    init(
        displayId: UInt32? = nil,
        windowTitle: String? = nil,
        appName: String? = nil,
        platform: String = "macos",
        wasInteractive: Bool? = nil
    ) {
        self.displayId = displayId
        self.windowTitle = windowTitle
        self.appName = appName
        self.platform = platform
        self.wasInteractive = wasInteractive
    }
}
