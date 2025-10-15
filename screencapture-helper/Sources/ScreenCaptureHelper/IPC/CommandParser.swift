import Foundation

/// Parses JSON commands from stdin
enum CommandParser {
    /// Parse a JSON command string into a CommandRequest
    /// - Parameter jsonString: The JSON string to parse
    /// - Returns: A CommandRequest instance
    /// - Throws: DecodingError if parsing fails
    static func parse(_ jsonString: String) throws -> CommandRequest {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: [],
                    debugDescription: "Failed to convert string to UTF-8 data"
                )
            )
        }

        let decoder = JSONDecoder()
        return try decoder.decode(CommandRequest.self, from: data)
    }
}
