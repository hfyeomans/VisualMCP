import XCTest
@testable import ScreenCaptureHelper

final class ResponseWriterTests: XCTestCase {
    func testSuccessResponseStructure() throws {
        let result = CaptureResult(
            filepath: "/tmp/test.png",
            width: 1920,
            height: 1080,
            format: "png",
            size: 524288,
            timestamp: "2025-10-15T14:30:00.000Z",
            metadata: CaptureMetadata(
                displayId: 1,
                windowTitle: "Test Window",
                appName: "TestApp",
                platform: "macos",
                wasInteractive: true
            )
        )

        let response = SuccessResponse(requestId: "req-001", result: result)

        // Verify structure
        XCTAssertTrue(response.success)
        XCTAssertEqual(response.requestId, "req-001")
        XCTAssertEqual(response.result.filepath, "/tmp/test.png")
        XCTAssertEqual(response.result.width, 1920)
        XCTAssertEqual(response.result.height, 1080)
        XCTAssertEqual(response.result.format, "png")
        XCTAssertEqual(response.result.size, 524288)
        XCTAssertEqual(response.result.metadata?.displayId, 1)
        XCTAssertEqual(response.result.metadata?.windowTitle, "Test Window")
        XCTAssertEqual(response.result.metadata?.appName, "TestApp")
        XCTAssertEqual(response.result.metadata?.platform, "macos")
        XCTAssertEqual(response.result.metadata?.wasInteractive, true)

        // Verify it's Codable
        let encoder = JSONEncoder()
        let data = try encoder.encode(response)
        XCTAssertFalse(data.isEmpty)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(SuccessResponse.self, from: data)
        XCTAssertEqual(decoded.requestId, response.requestId)
    }

    func testErrorResponseStructure() throws {
        let errorDetail = ErrorDetail(
            code: "PERMISSION_DENIED",
            message: "Screen Recording permission not granted",
            details: ["instructions": "Open System Settings"]
        )

        let response = ErrorResponse(requestId: "req-002", error: errorDetail)

        // Verify structure
        XCTAssertFalse(response.success)
        XCTAssertEqual(response.requestId, "req-002")
        XCTAssertEqual(response.error.code, "PERMISSION_DENIED")
        XCTAssertEqual(response.error.message, "Screen Recording permission not granted")
        XCTAssertEqual(response.error.details?["instructions"], "Open System Settings")

        // Verify it's Codable
        let encoder = JSONEncoder()
        let data = try encoder.encode(response)
        XCTAssertFalse(data.isEmpty)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ErrorResponse.self, from: data)
        XCTAssertEqual(decoded.requestId, response.requestId)
        XCTAssertEqual(decoded.error.code, response.error.code)
    }

    func testCaptureErrorConversion() {
        let error = CaptureError.permissionDenied(
            instructions: "Open System Settings > Privacy & Security > Screen Recording"
        )

        XCTAssertEqual(error.code, "PERMISSION_DENIED")
        XCTAssertTrue(error.message.contains("Screen Recording"))
        XCTAssertNotNil(error.details)
    }

    func testAllErrorCodes() {
        let errors: [CaptureError] = [
            .permissionDenied(instructions: "test"),
            .permissionCheckFailed,
            .userCancelled,
            .timeout,
            .invalidCommand("test"),
            .invalidOptions("test"),
            .invalidRegion,
            .displayNotFound,
            .windowNotFound,
            .captureFailed(reason: "test"),
            .conversionFailed(reason: "test"),
            .fileWriteError(reason: "test"),
            .internalError(reason: "test")
        ]

        for error in errors {
            // Verify each error has a code and message
            XCTAssertFalse(error.code.isEmpty, "Error code should not be empty")
            XCTAssertFalse(error.message.isEmpty, "Error message should not be empty")
        }
    }
}
