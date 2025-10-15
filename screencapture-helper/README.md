# ScreenCaptureHelper

A Swift CLI application that provides native macOS screen capture capabilities using ScreenCaptureKit, designed to integrate with Visual MCP (TypeScript/Node.js).

## Overview

This helper application bridges Node.js/TypeScript with macOS ScreenCaptureKit for high-performance native desktop capture. It uses a JSON-based IPC protocol over stdin/stdout for seamless integration.

## Requirements

- macOS 15+ (Sequoia)
- Swift 6.0+
- Xcode 16+
- Screen Recording permission (for actual capture operations)

## Building

```bash
# Debug build
swift build

# Release build (optimized)
swift build -c release

# Run tests
swift test
```

## Usage

The helper is designed to be spawned by TypeScript code and communicates via JSON over stdin/stdout:

```bash
echo '{"command":"echo","requestId":"test-001"}' | .build/debug/screencapture-helper
```

### Response Format

**Ready signal:**
```json
{"ready":true}
```

**Success response:**
```json
{
  "success": true,
  "requestId": "test-001",
  "result": {
    "filepath": "/tmp/echo-test.png",
    "width": 800,
    "height": 600,
    "format": "png",
    "size": 12345,
    "timestamp": "2025-10-15T15:19:12Z",
    "metadata": {
      "displayId": 1,
      "windowTitle": "Echo Test",
      "appName": "ScreenCaptureHelper",
      "platform": "macos",
      "wasInteractive": false
    }
  }
}
```

**Error response:**
```json
{
  "success": false,
  "requestId": "test-002",
  "error": {
    "code": "INVALID_COMMAND",
    "message": "Unknown command: invalid_command"
  }
}
```

## Phase 1 Status: Core Infrastructure ✅

Phase 1 is complete with the following deliverables:

### Implemented Components

- ✅ Swift Package Manager project structure
- ✅ IPC layer (stdin/stdout JSON communication)
  - `StdioManager.swift` - Async stdin/stdout handling
  - `CommandParser.swift` - JSON command parsing
  - `ResponseWriter.swift` - JSON response writing
- ✅ Data models
  - `Command.swift` - Command request types
  - `Response.swift` - Response types with Codable support
- ✅ Error handling
  - `CaptureError.swift` - Comprehensive error types
- ✅ Utilities
  - `Logger.swift` - stderr-only logging (respects LOG_LEVEL env var)
- ✅ Main entry point with command routing
- ✅ Unit tests (10 tests, all passing)
- ✅ Echo command for testing IPC

## Phase 2 Status: Permission & Availability ✅

Phase 2 is complete with the following deliverables:

### Implemented Components

- ✅ `PermissionManager.swift` - Screen Recording permission checking
  - `hasScreenRecordingPermission()` - Check current permission state
  - `getPermissionStatus()` - Get detailed permission status
  - `requestPermission()` - Trigger system permission prompt
  - `openSystemSettings()` - Deeplink to Screen Recording settings
- ✅ `CaptureCoordinator.swift` - Actor-based command orchestration
  - Thread-safe command execution
  - Permission checking before capture operations
  - Command routing to appropriate handlers
- ✅ `check_availability` command implementation
  - Returns macOS version, permission status, and ScreenCaptureKit availability
  - Provides actionable error messages if permission denied
  - Includes deeplink URL to System Settings
- ✅ ScreenCaptureKit framework integration
- ✅ Unit tests for PermissionManager (6 new tests, all passing)
- ✅ Total: 16 tests, all passing

### Permission Requirements

This application requires **Screen Recording** permission to capture screen content. On first run, macOS will prompt the user to grant this permission.

#### Checking Permission Status

```bash
echo '{"command":"check_availability","requestId":"test-001"}' | .build/debug/screencapture-helper
```

**Success Response (permission granted):**
```json
{
  "success": true,
  "requestId": "test-001",
  "result": {
    "filepath": "availability_check",
    "format": "json",
    "width": 0,
    "height": 0,
    "size": 174,
    "timestamp": "2025-10-15T15:33:55Z",
    "metadata": {
      "appName": "ScreenCaptureHelper",
      "platform": "macos",
      "wasInteractive": false
    }
  }
}
```

**Error Response (permission denied):**
```json
{
  "success": false,
  "requestId": "test-001",
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Screen Recording permission not granted",
    "details": {
      "permissionStatus": "denied",
      "instructions": "Open System Settings > Privacy & Security > Screen Recording and enable permission for this application",
      "deeplink": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    }
  }
}
```

#### Granting Permission

1. **Via System Prompt**: On first use, macOS will show a permission dialog
2. **Via System Settings**:
   - Open System Settings
   - Navigate to Privacy & Security > Screen Recording
   - Enable permission for the terminal or application running the helper
3. **Via Deeplink**: Use the provided deeplink URL from error responses

### Supported Commands (Phase 2)

- `echo` - Test command that returns a mock capture result
- `check_availability` - ✅ Returns permission status and system availability
- `capture_interactive` - Placeholder (Phase 4)
- `capture_region` - Placeholder (Phase 3)
- `capture_window` - Placeholder (future)

### Testing

```bash
# Run all unit tests
swift test

# Test echo command
echo '{"command":"echo","requestId":"test-001"}' | .build/debug/screencapture-helper

# Test invalid command
echo '{"command":"invalid","requestId":"test-002"}' | .build/debug/screencapture-helper

# Test invalid JSON
echo '{ bad json }' | .build/debug/screencapture-helper
```

All tests pass successfully:
```
Test Suite 'All tests' passed at 2025-10-15 11:34:42.996.
	 Executed 16 tests, with 0 failures (0 unexpected) in 0.184 (0.186) seconds
```

## Architecture

```
screencapture-helper/
├── Package.swift                    # SPM manifest
├── Sources/
│   └── ScreenCaptureHelper/
│       ├── main.swift              # Entry point, command routing
│       ├── Models/
│       │   ├── Command.swift       # Command request types
│       │   └── Response.swift      # Response types
│       ├── Core/
│       │   ├── CaptureCoordinator.swift  # Command orchestration (Actor)
│       │   ├── PermissionManager.swift   # Permission checking (Actor)
│       │   └── CaptureError.swift        # Error types
│       ├── IPC/
│       │   ├── CommandParser.swift    # JSON parsing
│       │   ├── ResponseWriter.swift   # JSON serialization
│       │   └── StdioManager.swift     # stdin/stdout handling
│       └── Utilities/
│           └── Logger.swift           # Logging (stderr only)
└── Tests/
    └── ScreenCaptureHelperTests/
        ├── CommandParserTests.swift      # Parser unit tests
        ├── ResponseWriterTests.swift     # Response unit tests
        └── PermissionManagerTests.swift  # Permission unit tests
```

## Next Steps: Phase 3

Phase 3 will implement:
- `CaptureEngine.swift` - ScreenCaptureKit wrapper for actual screen capture
- `ImageProcessor.swift` - Image encoding and file I/O
- `capture_region` command implementation
- Region capture with timeout handling
- Integration tests for capture functionality

## Development

### Swift Concurrency Patterns

This project uses modern Swift 6 concurrency features:
- `async/await` for asynchronous operations
- `actor` isolation for thread-safe state management
- Structured concurrency with `Task`

### Logging

Set log level via environment variable:
```bash
LOG_LEVEL=DEBUG echo '{"command":"echo","requestId":"test"}' | .build/debug/screencapture-helper
```

Levels: `DEBUG`, `INFO`, `WARN`, `ERROR` (default: `WARN`)

### Code Style

- Explicit types for clarity
- No force unwraps (using guard/if let)
- Comprehensive error handling
- Clear documentation comments

## License

Part of Visual MCP project.
