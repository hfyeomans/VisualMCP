import Foundation
import ScreenCaptureKit
import AppKit

/// Permission status for Screen Recording
enum PermissionStatus: String, Codable, Sendable {
    case granted
    case denied
    case notDetermined
    case restricted
}

/// Manages Screen Recording permission checking and requests
actor PermissionManager {

    /// Check if Screen Recording permission is granted
    /// - Returns: true if permission is granted, false otherwise
    func hasScreenRecordingPermission() async -> Bool {
        do {
            _ = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: true
            )
            return true
        } catch {
            Logger.debug("Permission check failed: \(error)")
            return false
        }
    }

    /// Get detailed permission status
    /// - Returns: PermissionStatus indicating current state
    func getPermissionStatus() async -> PermissionStatus {
        do {
            _ = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: true
            )
            return .granted
        } catch {
            // Check if it's a permission-specific error
            let nsError = error as NSError

            if nsError.domain == "com.apple.screencapturekit" {
                switch nsError.code {
                case -3801: // User declined
                    return .denied
                case -3802: // Not authorized
                    return .denied
                default:
                    Logger.warning("Unknown ScreenCaptureKit error code: \(nsError.code)")
                    return .denied
                }
            }

            // For other errors, assume denied
            return .denied
        }
    }

    /// Request Screen Recording permission (triggers system prompt)
    /// This will show the system permission dialog if not already determined
    /// - Throws: CaptureError if permission request fails
    func requestPermission() async throws {
        do {
            _ = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: true
            )
        } catch {
            let nsError = error as NSError
            Logger.error("Permission request failed: \(nsError)")

            throw CaptureError.permissionCheckFailed
        }
    }

    /// Open System Settings to Screen Recording permission page
    /// This provides users with a direct path to grant permission
    func openSystemSettings() {
        // Use the Screen Recording settings URL
        // Format: x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture
        let urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"

        guard let url = URL(string: urlString) else {
            Logger.error("Failed to create System Settings URL")
            return
        }

        Task { @MainActor in
            NSWorkspace.shared.open(url)
        }
    }
}
