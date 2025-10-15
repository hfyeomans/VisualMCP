import XCTest
@testable import ScreenCaptureHelper

/// Tests for PermissionManager
/// Note: These tests interact with real ScreenCaptureKit APIs and may trigger system permission prompts
final class PermissionManagerTests: XCTestCase {

    /// Test that hasScreenRecordingPermission returns a boolean value without crashing
    func testHasScreenRecordingPermissionReturnsBoolean() async {
        let manager = PermissionManager()
        let hasPermission = await manager.hasScreenRecordingPermission()

        // Should return a boolean without crashing
        // The actual value depends on system permission state
        XCTAssertTrue(hasPermission == true || hasPermission == false)
    }

    /// Test that getPermissionStatus returns a valid PermissionStatus
    func testGetPermissionStatusReturnsValidStatus() async {
        let manager = PermissionManager()
        let status = await manager.getPermissionStatus()

        // Should return one of the valid statuses
        let validStatuses: [PermissionStatus] = [.granted, .denied, .notDetermined, .restricted]
        XCTAssertTrue(validStatuses.contains(status))
    }

    /// Test that permission status is consistent with hasScreenRecordingPermission
    func testPermissionStatusConsistency() async {
        let manager = PermissionManager()
        let hasPermission = await manager.hasScreenRecordingPermission()
        let status = await manager.getPermissionStatus()

        if hasPermission {
            XCTAssertEqual(status, .granted, "If hasPermission is true, status should be granted")
        } else {
            XCTAssertNotEqual(status, .granted, "If hasPermission is false, status should not be granted")
        }
    }

    /// Test that PermissionStatus enum has expected cases
    func testPermissionStatusEnumCases() {
        let granted = PermissionStatus.granted
        let denied = PermissionStatus.denied
        let notDetermined = PermissionStatus.notDetermined
        let restricted = PermissionStatus.restricted

        XCTAssertEqual(granted.rawValue, "granted")
        XCTAssertEqual(denied.rawValue, "denied")
        XCTAssertEqual(notDetermined.rawValue, "notDetermined")
        XCTAssertEqual(restricted.rawValue, "restricted")
    }

    /// Test that PermissionStatus is Codable
    func testPermissionStatusCodable() throws {
        let status = PermissionStatus.granted
        let encoder = JSONEncoder()
        let data = try encoder.encode(status)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(PermissionStatus.self, from: data)

        XCTAssertEqual(decoded, status)
    }

    /// Test that openSystemSettings doesn't crash
    /// Note: This will actually try to open System Settings if run
    func testOpenSystemSettingsDoesNotCrash() async {
        let manager = PermissionManager()

        // This method should not throw or crash
        // It may open System Settings as a side effect
        await manager.openSystemSettings()

        // If we get here without crashing, the test passes
        XCTAssertTrue(true)
    }
}
