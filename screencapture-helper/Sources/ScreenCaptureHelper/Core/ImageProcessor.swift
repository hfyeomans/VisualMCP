import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// Processor for encoding and saving captured images
struct ImageProcessor: Sendable {
    /// Save captured image data to a file
    /// - Parameters:
    ///   - imageData: The captured image data to save
    ///   - format: Image format (png or jpeg)
    ///   - quality: JPEG quality (0-100, ignored for PNG)
    ///   - outputPath: Optional output path (uses temp directory if nil)
    /// - Returns: Absolute path to the saved file
    /// - Throws: CaptureError if encoding or file writing fails
    func save(
        imageData: CapturedImageData,
        format: ImageFormat = .png,
        quality: Int = 90,
        outputPath: String?
    ) async throws -> String {
        Logger.info("ImageProcessor: Encoding image as \(format.rawValue)")

        let finalPath = try determineFinalPath(outputPath: outputPath, format: format)

        let imageData = try encode(
            image: imageData.image,
            format: format,
            quality: quality
        )

        Logger.info("ImageProcessor: Writing \(imageData.count) bytes to \(finalPath)")

        do {
            try imageData.write(to: URL(fileURLWithPath: finalPath), options: .atomic)
        } catch {
            throw CaptureError.fileWriteError(reason: error.localizedDescription)
        }

        guard FileManager.default.fileExists(atPath: finalPath) else {
            throw CaptureError.fileWriteError(reason: "File was not created at expected path")
        }

        return finalPath
    }

    /// Encode CGImage to data in specified format
    /// - Parameters:
    ///   - image: The CGImage to encode
    ///   - format: Target image format
    ///   - quality: JPEG quality (0-100, ignored for PNG)
    /// - Returns: Encoded image data
    /// - Throws: CaptureError if encoding fails
    private func encode(
        image: CGImage,
        format: ImageFormat,
        quality: Int
    ) throws -> Data {
        guard let mutableData = CFDataCreateMutable(nil, 0) else {
            throw CaptureError.conversionFailed(reason: "Failed to create mutable data")
        }

        let utType: UTType
        let properties: [String: Any]

        switch format {
        case .png:
            utType = .png
            properties = [:]

        case .jpeg:
            utType = .jpeg
            let normalizedQuality = max(0, min(100, quality))
            properties = [kCGImageDestinationLossyCompressionQuality as String: Double(normalizedQuality) / 100.0]
        }

        guard let destination = CGImageDestinationCreateWithData(
            mutableData,
            utType.identifier as CFString,
            1,
            nil
        ) else {
            throw CaptureError.conversionFailed(reason: "Failed to create image destination")
        }

        CGImageDestinationAddImage(destination, image, properties as CFDictionary)

        guard CGImageDestinationFinalize(destination) else {
            throw CaptureError.conversionFailed(reason: "Failed to finalize image encoding")
        }

        return mutableData as Data
    }

    /// Determine the final output path for the saved file
    /// - Parameters:
    ///   - outputPath: Optional user-specified path
    ///   - format: Image format for file extension
    /// - Returns: Absolute path to use for saving
    /// - Throws: CaptureError if path is invalid or directory doesn't exist
    private func determineFinalPath(
        outputPath: String?,
        format: ImageFormat
    ) throws -> String {
        if let outputPath = outputPath {
            let path = NSString(string: outputPath).expandingTildeInPath

            if path.hasSuffix("/") || path.isEmpty {
                throw CaptureError.invalidOptions("Output path must be a file path, not a directory")
            }

            let parentDir = (path as NSString).deletingLastPathComponent
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: parentDir, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                throw CaptureError.fileWriteError(reason: "Parent directory does not exist: \(parentDir)")
            }

            return path
        } else {
            let tempDir = FileManager.default.temporaryDirectory
            let filename = "capture-\(Date().timeIntervalSince1970).\(format.rawValue)"
            return tempDir.appendingPathComponent(filename).path
        }
    }

    /// Get file size in bytes for a saved file
    /// - Parameter path: Path to the file
    /// - Returns: File size in bytes, or 0 if unable to determine
    func getFileSize(path: String) -> Int {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: path)
            if let fileSize = attributes[.size] as? NSNumber {
                return fileSize.intValue
            }
        } catch {
            Logger.error("Failed to get file size for \(path): \(error)")
        }
        return 0
    }
}
