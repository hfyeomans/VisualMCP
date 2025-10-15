import Foundation
import ScreenCaptureKit

/// Availability result for check_availability command
struct AvailabilityResult: Codable, Sendable {
    let available: Bool
    let hasPermission: Bool
    let macOSVersion: String
    let screenCaptureKitAvailable: Bool
    let permissionStatus: String
}

/// Main orchestrator for capture operations
/// Actor ensures thread-safe command execution
actor CaptureCoordinator {
    private let permissionManager: PermissionManager
    private let captureEngine: CaptureEngine
    private let imageProcessor: ImageProcessor

    init() {
        self.permissionManager = PermissionManager()
        self.captureEngine = CaptureEngine()
        self.imageProcessor = ImageProcessor()
    }

    /// Execute a command and return response
    /// - Parameter command: The command to execute
    /// - Returns: ResponseType (success or error)
    func execute(command: CommandRequest) async -> ResponseType {
        Logger.info("CaptureCoordinator executing: \(command.command)")

        do {
            // Route to appropriate handler
            switch command.command {
            case "check_availability":
                return await handleCheckAvailability(requestId: command.requestId)

            case "capture_interactive":
                // Placeholder for Phase 4
                return .error(
                    requestId: command.requestId,
                    code: "NOT_IMPLEMENTED",
                    message: "capture_interactive not yet implemented (Phase 4)",
                    details: nil
                )

            case "capture_region":
                guard let options = command.options else {
                    return .error(
                        requestId: command.requestId,
                        code: "INVALID_OPTIONS",
                        message: "capture_region requires options with region",
                        details: nil
                    )
                }
                return await handleCaptureRegion(requestId: command.requestId, options: options)

            case "capture_window":
                // Placeholder for future
                return .error(
                    requestId: command.requestId,
                    code: "NOT_IMPLEMENTED",
                    message: "capture_window not yet implemented",
                    details: nil
                )

            case "echo":
                // Keep echo command for testing
                return handleEcho(requestId: command.requestId)

            default:
                return .error(
                    requestId: command.requestId,
                    code: "INVALID_COMMAND",
                    message: "Unknown command: \(command.command)",
                    details: nil
                )
            }

        } catch let error as CaptureError {
            return .error(
                requestId: command.requestId,
                code: error.code,
                message: error.message,
                details: error.details
            )
        } catch {
            return .error(
                requestId: command.requestId,
                code: "INTERNAL_ERROR",
                message: "Internal error: \(error.localizedDescription)",
                details: nil
            )
        }
    }

    /// Handle check_availability command
    /// - Parameter requestId: Request ID for response tracking
    /// - Returns: ResponseType with availability information
    private func handleCheckAvailability(requestId: String) async -> ResponseType {
        Logger.info("Checking availability and permissions")

        // Get macOS version
        let macOSVersion = ProcessInfo.processInfo.operatingSystemVersionString

        // Check ScreenCaptureKit availability (always true on macOS 15+)
        let screenCaptureKitAvailable = true

        // Check permission status
        let permissionStatus = await permissionManager.getPermissionStatus()
        let hasPermission = permissionStatus == .granted

        // Overall availability
        let available = screenCaptureKitAvailable && hasPermission

        // Build availability result
        let availabilityResult = AvailabilityResult(
            available: available,
            hasPermission: hasPermission,
            macOSVersion: macOSVersion,
            screenCaptureKitAvailable: screenCaptureKitAvailable,
            permissionStatus: permissionStatus.rawValue
        )

        // Encode availability result as JSON
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]

        guard let jsonData = try? encoder.encode(availabilityResult),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return .error(
                requestId: requestId,
                code: "INTERNAL_ERROR",
                message: "Failed to encode availability result",
                details: nil
            )
        }

        // Write availability JSON to a temporary file so TypeScript can read it
        let tempDir = FileManager.default.temporaryDirectory
        let tempFile = tempDir.appendingPathComponent("availability-\(requestId).json")

        do {
            try jsonData.write(to: tempFile)
        } catch {
            return .error(
                requestId: requestId,
                code: "FILE_WRITE_ERROR",
                message: "Failed to write availability data to temp file",
                details: ["error": error.localizedDescription]
            )
        }

        // Create CaptureResult with actual file path
        let result = CaptureResult(
            filepath: tempFile.path,
            width: 0,
            height: 0,
            format: "json",
            size: jsonData.count,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            metadata: CaptureMetadata(
                displayId: nil,
                windowTitle: nil,
                appName: "ScreenCaptureHelper",
                platform: "macos",
                wasInteractive: false
            )
        )

        // If permission is denied, return error with instructions
        if !hasPermission {
            return .error(
                requestId: requestId,
                code: "PERMISSION_DENIED",
                message: "Screen Recording permission not granted",
                details: [
                    "permissionStatus": permissionStatus.rawValue,
                    "instructions": "Open System Settings > Privacy & Security > Screen Recording and enable permission for this application",
                    "deeplink": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
                    "availabilityData": jsonString,
                    "availabilityFile": tempFile.path
                ]
            )
        }

        // Return success with availability data file path
        return .success(requestId: requestId, result: result)
    }

    /// Handle echo command (for testing)
    /// - Parameter requestId: Request ID for response tracking
    /// - Returns: ResponseType with mock capture result
    private func handleEcho(requestId: String) -> ResponseType {
        Logger.info("Handling echo command")

        let result = CaptureResult(
            filepath: "/tmp/echo-test.png",
            width: 800,
            height: 600,
            format: "png",
            size: 12345,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            metadata: CaptureMetadata(
                displayId: 1,
                windowTitle: "Echo Test",
                appName: "ScreenCaptureHelper",
                platform: "macos",
                wasInteractive: false
            )
        )

        return .success(requestId: requestId, result: result)
    }

    /// Check if permission is granted before capture operations
    /// - Throws: CaptureError.permissionDenied if permission not granted
    private func ensurePermission() async throws {
        let hasPermission = await permissionManager.hasScreenRecordingPermission()

        guard hasPermission else {
            throw CaptureError.permissionDenied(
                instructions: "Open System Settings > Privacy & Security > Screen Recording"
            )
        }
    }

    /// Handle capture_region command
    /// - Parameters:
    ///   - requestId: Request ID for response tracking
    ///   - options: Command options containing region and other parameters
    /// - Returns: ResponseType with capture result or error
    private func handleCaptureRegion(requestId: String, options: CommandOptions) async -> ResponseType {
        Logger.info("Handling capture_region command")

        do {
            try await ensurePermission()

            guard let region = options.region else {
                throw CaptureError.invalidOptions("region is required for capture_region")
            }

            let format = options.format ?? .png
            let quality = options.quality ?? 90
            let timeout = options.timeout ?? 5.0

            let capturedData = try await captureEngine.captureFrame(
                region: region,
                displayId: options.displayId,
                timeout: timeout
            )

            let filepath = try await imageProcessor.save(
                imageData: capturedData,
                format: format,
                quality: quality,
                outputPath: options.outputPath
            )

            let fileSize = imageProcessor.getFileSize(path: filepath)

            let result = CaptureResult(
                filepath: filepath,
                width: capturedData.width,
                height: capturedData.height,
                format: format.rawValue,
                size: fileSize,
                timestamp: ISO8601DateFormatter().string(from: Date()),
                metadata: CaptureMetadata(
                    displayId: capturedData.displayId,
                    windowTitle: nil,
                    appName: nil,
                    platform: "macos",
                    wasInteractive: false
                )
            )

            Logger.info("Capture completed successfully: \(filepath)")
            return .success(requestId: requestId, result: result)

        } catch let error as CaptureError {
            Logger.error("Capture failed: \(error.code) - \(error.message)")
            return .error(
                requestId: requestId,
                code: error.code,
                message: error.message,
                details: error.details
            )
        } catch {
            Logger.error("Unexpected error during capture: \(error)")
            return .error(
                requestId: requestId,
                code: "INTERNAL_ERROR",
                message: "Unexpected error: \(error.localizedDescription)",
                details: nil
            )
        }
    }
}
