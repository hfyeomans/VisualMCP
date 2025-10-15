import Foundation
import CoreGraphics

/// Container for captured image data and metadata
struct CapturedImageData: Sendable {
    let image: CGImage
    let width: Int
    let height: Int
    let displayId: UInt32?

    init(image: CGImage, displayId: UInt32? = nil) {
        self.image = image
        self.width = image.width
        self.height = image.height
        self.displayId = displayId
    }
}
