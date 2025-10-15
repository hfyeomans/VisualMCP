import Foundation
@preconcurrency import ScreenCaptureKit
import CoreGraphics

/// Engine for performing screen captures using ScreenCaptureKit
/// Handles the lifecycle of SCStream and frame capture
final class CaptureEngine: Sendable {
    private static let captureTimeout: TimeInterval = 5.0

    init() {}

    /// Capture a single frame from a specified region
    /// - Parameters:
    ///   - region: The rectangular region to capture
    ///   - displayId: Optional display ID (uses main display if nil)
    ///   - timeout: Maximum time to wait for capture (defaults to 5 seconds)
    /// - Returns: CapturedImageData containing the captured frame
    /// - Throws: CaptureError if capture fails
    func captureFrame(
        region: Region,
        displayId: UInt32? = nil,
        timeout: TimeInterval = captureTimeout
    ) async throws -> CapturedImageData {
        Logger.info("CaptureEngine: Starting frame capture for region \(region.width)x\(region.height) at (\(region.x), \(region.y))")

        let filter = try await createRegionFilter(region: region, displayId: displayId)
        let actualDisplayId = displayId ?? CGMainDisplayID()

        let config = SCStreamConfiguration()
        config.sourceRect = CGRect(
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
        )
        config.width = region.width
        config.height = region.height
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = false
        config.capturesAudio = false

        let stream = SCStream(filter: filter, configuration: config, delegate: nil)

        do {
            let image = try await Self.captureFrameFromStream(stream: stream, timeout: timeout)
            return CapturedImageData(image: image, displayId: actualDisplayId)
        } catch let error as CaptureError {
            throw error
        } catch {
            throw CaptureError.captureFailed(reason: error.localizedDescription)
        }
    }

    /// Create a content filter for the specified region and display
    /// - Parameters:
    ///   - region: The rectangular region to capture
    ///   - displayId: Optional display ID (uses main display if nil)
    /// - Returns: SCContentFilter configured for the region
    /// - Throws: CaptureError if display not found or region invalid
    func createRegionFilter(region: Region, displayId: UInt32?) async throws -> SCContentFilter {
        Logger.info("CaptureEngine: Creating filter for display \(displayId?.description ?? "main")")

        guard region.width > 0 && region.height > 0 else {
            throw CaptureError.invalidRegion
        }

        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )

        let targetDisplayId = displayId ?? CGMainDisplayID()

        guard let display = content.displays.first(where: { $0.displayID == targetDisplayId }) else {
            throw CaptureError.displayNotFound
        }

        let displayBounds = display.frame
        guard region.x >= 0 && region.y >= 0 &&
              region.x + region.width <= Int(displayBounds.width) &&
              region.y + region.height <= Int(displayBounds.height) else {
            throw CaptureError.invalidRegion
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        return filter
    }

    /// Capture a single frame from an active stream
    /// - Parameters:
    ///   - stream: The SCStream to capture from
    ///   - timeout: Maximum time to wait for capture
    /// - Returns: CGImage of the captured frame
    /// - Throws: CaptureError if capture fails
    private static func captureFrameFromStream(stream: SCStream, timeout: TimeInterval) async throws -> CGImage {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<CGImage, Error>) in
            let handler = StreamOutputHandler(continuation: continuation)

            Task {
                do {
                    try stream.addStreamOutput(handler, type: .screen, sampleHandlerQueue: .main)
                    try await stream.startCapture()

                    try await Task.sleep(nanoseconds: 100_000_000)

                    try await stream.stopCapture()
                } catch {
                    continuation.resume(throwing: CaptureError.captureFailed(reason: error.localizedDescription))
                }
            }
        }
    }
}
