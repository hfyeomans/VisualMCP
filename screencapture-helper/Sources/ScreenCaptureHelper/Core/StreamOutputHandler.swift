import Foundation
import ScreenCaptureKit
import CoreMedia
import CoreVideo
import CoreGraphics

/// Handler for SCStream output that captures a single frame
/// This class is used to capture one frame from a ScreenCaptureKit stream
final class StreamOutputHandler: NSObject, SCStreamOutput, @unchecked Sendable {
    private let continuation: CheckedContinuation<CGImage, Error>
    private var hasCompleted = false

    init(continuation: CheckedContinuation<CGImage, Error>) {
        self.continuation = continuation
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !hasCompleted else { return }
        guard type == .screen else { return }

        do {
            let image = try Self.createImage(from: sampleBuffer)
            hasCompleted = true
            continuation.resume(returning: image)
        } catch {
            hasCompleted = true
            continuation.resume(throwing: error)
        }
    }

    /// Convert CMSampleBuffer to CGImage
    /// - Parameter sampleBuffer: The sample buffer from ScreenCaptureKit
    /// - Returns: CGImage extracted from the buffer
    /// - Throws: CaptureError if conversion fails
    private static func createImage(from sampleBuffer: CMSampleBuffer) throws -> CGImage {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            throw CaptureError.conversionFailed(reason: "Failed to get image buffer from sample")
        }

        CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)
        defer {
            CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly)
        }

        guard let baseAddress = CVPixelBufferGetBaseAddress(imageBuffer) else {
            throw CaptureError.conversionFailed(reason: "Failed to get base address from pixel buffer")
        }

        let width = CVPixelBufferGetWidth(imageBuffer)
        let height = CVPixelBufferGetHeight(imageBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)

        guard let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            throw CaptureError.conversionFailed(reason: "Failed to create CGContext")
        }

        guard let cgImage = context.makeImage() else {
            throw CaptureError.conversionFailed(reason: "Failed to create CGImage from context")
        }

        return cgImage
    }
}
