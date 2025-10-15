import Foundation
import CoreGraphics

/// Command request from TypeScript layer
struct CommandRequest: Codable, Sendable {
    let command: String
    let requestId: String
    let options: CommandOptions?
}

/// All possible command options (use optional properties)
struct CommandOptions: Codable, Sendable {
    // Common options
    let format: ImageFormat?
    let quality: Int?
    let outputPath: String?
    let timeout: TimeInterval?

    // Region capture
    let region: Region?
    let displayId: UInt32?

    // Window capture
    let windowId: UInt32?
}

/// Rectangle region specification
struct Region: Codable, Sendable {
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}

/// Supported image formats
enum ImageFormat: String, Codable, Sendable {
    case png
    case jpeg
}
