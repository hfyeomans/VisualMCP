import Foundation

/// Main entry point - top-level async code
Task {
    await ScreenCaptureHelperApp.run()
    exit(0)
}

dispatchMain()

/// Application logic
enum ScreenCaptureHelperApp {
    /// Main run function
    static func run() async {
        // Initialize coordinator (actor for thread safety)
        let coordinator = CaptureCoordinator()

        // Initialize stdio manager
        let stdio = StdioManager()

        Logger.info("ScreenCaptureHelper starting...")

        // Signal ready to TypeScript layer
        await stdio.writeReady()

        // Read single command from stdin (single-shot mode)
        if let line = await stdio.readLine() {
            Logger.debug("Received command: \(line)")

            // Parse command
            guard let command = try? CommandParser.parse(line) else {
                await stdio.writeError(
                    requestId: nil,
                    code: "INVALID_COMMAND",
                    message: "Failed to parse command JSON"
                )
                return
            }

            // Execute command through coordinator
            let result = await coordinator.execute(command: command)

            // Write response
            await stdio.writeResponse(result)
        } else {
            Logger.error("No command received on stdin")
        }
    }
}
