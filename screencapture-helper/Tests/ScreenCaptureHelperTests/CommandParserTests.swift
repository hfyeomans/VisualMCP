import XCTest
@testable import ScreenCaptureHelper

final class CommandParserTests: XCTestCase {
    func testParseValidEchoCommand() throws {
        let json = """
        {
            "command": "echo",
            "requestId": "test-001"
        }
        """

        let command = try CommandParser.parse(json)

        XCTAssertEqual(command.command, "echo")
        XCTAssertEqual(command.requestId, "test-001")
        XCTAssertNil(command.options)
    }

    func testParseValidCaptureRegionCommand() throws {
        let json = """
        {
            "command": "capture_region",
            "requestId": "req-123",
            "options": {
                "region": { "x": 0, "y": 0, "width": 100, "height": 100 },
                "format": "png",
                "quality": 90,
                "outputPath": "/tmp/test.png"
            }
        }
        """

        let command = try CommandParser.parse(json)

        XCTAssertEqual(command.command, "capture_region")
        XCTAssertEqual(command.requestId, "req-123")
        XCTAssertNotNil(command.options?.region)
        XCTAssertEqual(command.options?.region?.x, 0)
        XCTAssertEqual(command.options?.region?.y, 0)
        XCTAssertEqual(command.options?.region?.width, 100)
        XCTAssertEqual(command.options?.region?.height, 100)
        XCTAssertEqual(command.options?.format, .png)
        XCTAssertEqual(command.options?.quality, 90)
        XCTAssertEqual(command.options?.outputPath, "/tmp/test.png")
    }

    func testParseInvalidJSON() {
        let json = "{ invalid json }"

        XCTAssertThrowsError(try CommandParser.parse(json)) { error in
            XCTAssertTrue(error is DecodingError)
        }
    }

    func testParseEmptyString() {
        let json = ""

        XCTAssertThrowsError(try CommandParser.parse(json))
    }

    func testParseMissingRequiredFields() {
        let json = """
        {
            "command": "echo"
        }
        """

        // Missing requestId
        XCTAssertThrowsError(try CommandParser.parse(json)) { error in
            XCTAssertTrue(error is DecodingError)
        }
    }

    func testParseWithAllOptions() throws {
        let json = """
        {
            "command": "capture_window",
            "requestId": "req-456",
            "options": {
                "windowId": 12345,
                "format": "jpeg",
                "quality": 85,
                "outputPath": "/tmp/window.jpg",
                "timeout": 5000
            }
        }
        """

        let command = try CommandParser.parse(json)

        XCTAssertEqual(command.command, "capture_window")
        XCTAssertEqual(command.requestId, "req-456")
        XCTAssertEqual(command.options?.windowId, 12345)
        XCTAssertEqual(command.options?.format, .jpeg)
        XCTAssertEqual(command.options?.quality, 85)
        XCTAssertEqual(command.options?.outputPath, "/tmp/window.jpg")
        XCTAssertEqual(command.options?.timeout, 5000)
    }
}
