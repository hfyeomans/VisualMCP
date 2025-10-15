import Foundation

/// Manages stdin/stdout communication
actor StdioManager {
    private let inputHandle: FileHandle
    private let outputHandle: FileHandle

    init(
        inputHandle: FileHandle = .standardInput,
        outputHandle: FileHandle = .standardOutput
    ) {
        self.inputHandle = inputHandle
        self.outputHandle = outputHandle
    }

    /// Read a single line from stdin
    /// - Returns: The line as a string, or nil if EOF
    func readLine() async -> String? {
        // Read until newline or EOF
        let data = inputHandle.availableData
        guard !data.isEmpty else {
            return nil
        }

        guard let line = String(data: data, encoding: .utf8) else {
            Logger.error("Failed to decode stdin data as UTF-8")
            return nil
        }

        return line.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Read all lines from stdin as an async sequence
    /// - Returns: An async sequence of lines
    func readLines() -> AsyncStream<String> {
        AsyncStream { continuation in
            Task {
                while let line = await self.readLine() {
                    if !line.isEmpty {
                        continuation.yield(line)
                    }
                }
                continuation.finish()
            }
        }
    }

    /// Write a response using ResponseWriter
    /// - Parameter response: The ResponseType to write
    func writeResponse(_ response: ResponseType) {
        switch response {
        case .success(let requestId, let result):
            ResponseWriter.writeSuccess(requestId: requestId, result: result)

        case .error(let requestId, let code, let message, let details):
            ResponseWriter.writeError(
                requestId: requestId,
                code: code,
                message: message,
                details: details
            )
        }
    }

    /// Write a ready signal
    func writeReady() {
        ResponseWriter.writeReady()
    }

    /// Write an error using CaptureError
    /// - Parameters:
    ///   - requestId: Optional request ID
    ///   - error: The CaptureError to write
    func writeError(requestId: String?, error: CaptureError) {
        ResponseWriter.writeError(requestId: requestId, error: error)
    }

    /// Write a generic error
    /// - Parameters:
    ///   - requestId: Optional request ID
    ///   - code: Error code
    ///   - message: Error message
    func writeError(requestId: String?, code: String, message: String) {
        ResponseWriter.writeError(requestId: requestId, code: code, message: message)
    }
}
