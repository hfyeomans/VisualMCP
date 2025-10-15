import Foundation

/// Writes JSON responses to stdout
enum ResponseWriter {
    /// Write a success response to stdout
    /// - Parameters:
    ///   - requestId: The request ID from the command
    ///   - result: The capture result
    static func writeSuccess(requestId: String, result: CaptureResult) {
        let response = SuccessResponse(requestId: requestId, result: result)
        write(response)
    }

    /// Write an error response to stdout
    /// - Parameters:
    ///   - requestId: The request ID from the command (optional)
    ///   - code: Error code
    ///   - message: Error message
    ///   - details: Optional additional details
    static func writeError(
        requestId: String?,
        code: String,
        message: String,
        details: [String: String]? = nil
    ) {
        let errorDetail = ErrorDetail(code: code, message: message, details: details)
        let response = ErrorResponse(requestId: requestId, error: errorDetail)
        write(response)
    }

    /// Write an error from CaptureError
    /// - Parameters:
    ///   - requestId: The request ID from the command (optional)
    ///   - error: The CaptureError to convert
    static func writeError(requestId: String?, error: CaptureError) {
        writeError(
            requestId: requestId,
            code: error.code,
            message: error.message,
            details: error.details
        )
    }

    /// Write a ready signal to stdout
    static func writeReady() {
        let ready = ["ready": true]
        write(ready)
    }

    /// Internal function to write any encodable value to stdout
    private static func write<T: Encodable>(_ value: T) {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            let data = try encoder.encode(value)

            guard let jsonString = String(data: data, encoding: .utf8) else {
                Logger.error("Failed to convert JSON data to string")
                return
            }

            // Write to stdout with newline
            print(jsonString)

            // Flush stdout to ensure immediate delivery
            fflush(stdout)
        } catch {
            Logger.error("Failed to encode response: \(error)")
        }
    }
}
