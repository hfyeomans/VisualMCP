import XCTest
@testable import ScreenCaptureHelper
import CoreGraphics

final class ImageProcessorTests: XCTestCase {
    var processor: ImageProcessor!
    var tempDir: URL!

    override func setUp() async throws {
        try await super.setUp()
        processor = ImageProcessor()
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempDir)
        try await super.tearDown()
    }

    func testDetermineFinalPathWithOutputPath() async throws {
        let outputPath = tempDir.appendingPathComponent("test.png").path

        let testImage = try createTestImage(width: 100, height: 100)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)

        let filepath = try await processor.save(
            imageData: capturedData,
            format: .png,
            quality: 90,
            outputPath: outputPath
        )

        XCTAssertEqual(filepath, outputPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: filepath))
    }

    func testDetermineFinalPathWithoutOutputPath() async throws {
        let testImage = try createTestImage(width: 100, height: 100)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)

        let filepath = try await processor.save(
            imageData: capturedData,
            format: .png,
            quality: 90,
            outputPath: nil
        )

        XCTAssertTrue(filepath.contains("/tmp/") || filepath.contains("T/"))
        XCTAssertTrue(filepath.hasSuffix(".png"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: filepath))

        try? FileManager.default.removeItem(atPath: filepath)
    }

    func testEncodePNG() async throws {
        let testImage = try createTestImage(width: 200, height: 150)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)
        let outputPath = tempDir.appendingPathComponent("test.png").path

        let filepath = try await processor.save(
            imageData: capturedData,
            format: .png,
            quality: 90,
            outputPath: outputPath
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: filepath))

        let fileSize = processor.getFileSize(path: filepath)
        XCTAssertGreaterThan(fileSize, 0)
    }

    func testEncodeJPEG() async throws {
        let testImage = try createTestImage(width: 200, height: 150)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)
        let outputPath = tempDir.appendingPathComponent("test.jpg").path

        let filepath = try await processor.save(
            imageData: capturedData,
            format: .jpeg,
            quality: 80,
            outputPath: outputPath
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: filepath))

        let fileSize = processor.getFileSize(path: filepath)
        XCTAssertGreaterThan(fileSize, 0)
    }

    func testJPEGQualityNormalization() async throws {
        let testImage = try createTestImage(width: 100, height: 100)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)

        let highQualityPath = tempDir.appendingPathComponent("high.jpg").path
        let lowQualityPath = tempDir.appendingPathComponent("low.jpg").path

        _ = try await processor.save(
            imageData: capturedData,
            format: .jpeg,
            quality: 100,
            outputPath: highQualityPath
        )

        _ = try await processor.save(
            imageData: capturedData,
            format: .jpeg,
            quality: 10,
            outputPath: lowQualityPath
        )

        let highSize = processor.getFileSize(path: highQualityPath)
        let lowSize = processor.getFileSize(path: lowQualityPath)

        XCTAssertGreaterThan(highSize, lowSize, "Higher quality should produce larger file")
    }

    func testInvalidParentDirectory() async throws {
        let testImage = try createTestImage(width: 100, height: 100)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)
        let invalidPath = "/nonexistent/directory/test.png"

        do {
            _ = try await processor.save(
                imageData: capturedData,
                format: .png,
                quality: 90,
                outputPath: invalidPath
            )
            XCTFail("Should have thrown an error for invalid parent directory")
        } catch let error as CaptureError {
            switch error {
            case .fileWriteError:
                break
            default:
                XCTFail("Expected fileWriteError, got \(error)")
            }
        }
    }

    func testGetFileSize() async throws {
        let testImage = try createTestImage(width: 100, height: 100)
        let capturedData = CapturedImageData(image: testImage, displayId: 1)
        let outputPath = tempDir.appendingPathComponent("size-test.png").path

        let filepath = try await processor.save(
            imageData: capturedData,
            format: .png,
            quality: 90,
            outputPath: outputPath
        )

        let size = processor.getFileSize(path: filepath)
        XCTAssertGreaterThan(size, 0)

        let nonExistentSize = processor.getFileSize(path: "/nonexistent/file.png")
        XCTAssertEqual(nonExistentSize, 0)
    }

    private func createTestImage(width: Int, height: Int) throws -> CGImage {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)

        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            throw CaptureError.conversionFailed(reason: "Failed to create test CGContext")
        }

        context.setFillColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1.0)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        guard let image = context.makeImage() else {
            throw CaptureError.conversionFailed(reason: "Failed to create test CGImage")
        }

        return image
    }
}
