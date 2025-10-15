# Stub Implementation Tracking - Phase 6

This document tracks all stub implementations that need to be completed before Phase 6 can be considered production-ready.

## Status: INCOMPLETE - Multiple Stubs Require Implementation

---

## Critical Fixes (Phase 6.2.1)

### ✅ P1: Forward Native Capture Options - COMPLETE
**Issue**: User-supplied options (format, quality, timeout) were silently ignored for desktop captures
**Root Cause**:
1. `ScreenshotOptionsSchema` was missing `timeout` and `waitForNetworkIdle` fields
2. Zod stripped these fields before they reached `ScreenshotEngine`
3. Interface only accepted bare region coordinates

**Fixed**:
- ✅ Added `timeout` and `waitForNetworkIdle` to `ScreenshotOptionsSchema` (Commit: TBD)
- ✅ Updated `INativeCaptureManager.captureRegion()` to accept full `NativeCaptureOptions` (Commit: dfdf46c)
- ✅ Plumbed options from `ScreenshotEngine.takeRegionScreenshot()` through to native manager (Commit: dfdf46c)
- ✅ Added regression test verifying timeout reaches native manager

**Verification**: Test "should forward timeout option to native manager (P1 schema fix)" passes

### ✅ P2: Report Actual Unsupported Platform - COMPLETE
**Issue**: Windows/Linux users saw "platform: none" instead of actual platform name
**Root Cause**: `UnsupportedPlatformCaptureManager.getPlatform()` always returned 'none'

**Fixed**:
- ✅ Added platform name mapping (win32→windows, linux→linux) (Commit: dfdf46c)
- ✅ Updated error messages to show actual platform

**Verification**: Test "should include actual platform name in error message" passes

---

## Stub Implementations

### 1. MacOSCaptureManager.captureInteractive() ✅ COMPLETE
**Location**: `src/core/native-capture-manager.ts:294-345`
**Status**: ✅ COMPLETE - Fully Implemented
**Current Behavior**: Spawns Swift helper and executes interactive capture
**Implementation**:
- ✅ Spawns Swift ScreenCaptureKit helper process
- ✅ Sends JSON command over stdin: `{"command": "capture_interactive", "options": {...}}`
- ✅ Receives JSON response over stdout with file path and metadata
- ✅ Handles user cancellation gracefully (USER_CANCELLED error)
- ✅ Converts Swift errors to ScreenshotError with actionable messages
- ✅ Returns `NativeCaptureResult` with actual captured screenshot
- ✅ Timeout handling with configurable values (default 30s for interactive)

**Completed**: Phase 6.6 (TypeScript implementation)
**Related Files**:
- Swift helper CLI (requires Phase 6.7 implementation)
- IPC protocol specification (see IPC-PROTOCOL.md)

---

### 2. MacOSCaptureManager.captureRegion() ✅ COMPLETE
**Location**: `src/core/native-capture-manager.ts:350-411`
**Status**: ✅ COMPLETE - Fully Implemented
**Current Behavior**: Spawns Swift helper and executes region capture
**Implementation**:
- ✅ Validates region coordinates are provided
- ✅ Spawns Swift ScreenCaptureKit helper process
- ✅ Sends JSON command with region coordinates: `{"command": "capture_region", "region": {x, y, width, height}}`
- ✅ Receives JSON response with captured image
- ✅ Handles Screen Recording permission failures (PERMISSION_DENIED error)
- ✅ Returns `NativeCaptureResult` with actual captured screenshot
- ✅ Includes displayId, format, quality options
- ✅ Timeout handling (default 10s for region)

**Completed**: Phase 6.6 (TypeScript implementation)
**Related Files**:
- Swift helper CLI (requires Phase 6.7 implementation)
- IPC protocol specification (see IPC-PROTOCOL.md)

---

### 3. MacOSCaptureManager.cleanup() ✅ COMPLETE
**Location**: `src/core/native-capture-manager.ts:444-469`
**Status**: ✅ COMPLETE - Fully Implemented
**Current Behavior**: Gracefully terminates helper process with fallback to force kill
**Implementation**:
- ✅ Terminates Swift helper process if running
- ✅ Sends SIGTERM for graceful shutdown
- ✅ Waits up to 2 seconds for graceful shutdown
- ✅ Force kills with SIGKILL if timeout exceeded
- ✅ Clears all process references
- ✅ Returns immediately if no process running (no-op)
- ✅ Properly typed Promise<void> return

**Completed**: Phase 6.6 (TypeScript implementation)
**Dependencies**: All dependencies implemented

---

### 4. MacOSCaptureManager.isAvailable() ✅ COMPLETE
**Location**: `src/core/native-capture-manager.ts:416-432`
**Status**: ✅ COMPLETE - Fully Implemented
**Current Behavior**: Checks platform, binary existence, and executability
**Implementation**:
- ✅ Returns false if platform is not 'darwin'
- ✅ Checks if Swift helper binary exists at configured path
- ✅ Verifies Swift helper is executable (fs.constants.X_OK)
- ✅ Searches multiple locations for helper binary
- ✅ Gracefully returns false if any prerequisite is missing
- ✅ Logs warnings with details when unavailable

**Completed**: Phase 6.6 (TypeScript implementation)
**Related Files**:
- Helper binary search locations in `findHelperBinary()`
- Configuration via `NativeCaptureConfig.helperPath`

---

### 5. Helper Binary Management ✅ COMPLETE (NEW)
**Location**: `src/core/native-capture-manager.ts:81-135`
**Status**: ✅ COMPLETE - Fully Implemented
**Implementation**:
- ✅ `findHelperBinary()`: Searches multiple locations for binary
  - `bin/screencapture-helper` (working directory)
  - `screencapture-helper/.build/release/` (Swift build output)
  - `screencapture-helper/.build/debug/` (Swift debug build)
  - `node_modules/visual-mcp/bin/` (npm package)
  - `/usr/local/bin/` (system-wide installation)
- ✅ `ensureHelperAvailable()`: Validates binary is executable
- ✅ `generateRequestId()`: Creates unique IPC request IDs
- ✅ Custom helper path support via config
- ✅ Clear error messages when binary not found

**Completed**: Phase 6.6 (TypeScript implementation)

---

### 6. IPC Communication Layer ✅ COMPLETE (NEW)
**Location**: `src/core/native-capture-manager.ts:147-234`
**Status**: ✅ COMPLETE - Fully Implemented
**Implementation**:
- ✅ `executeCommand<T>()`: Generic IPC command execution
- ✅ Spawns helper with stdio pipes
- ✅ Sends JSON command to stdin
- ✅ Collects stdout/stderr data
- ✅ Parses JSON response from stdout
- ✅ Timeout handling with process kill
- ✅ Process lifecycle management
- ✅ Error handling for spawn failures
- ✅ Type-safe request/response structures

**Completed**: Phase 6.6 (TypeScript implementation)
**Interfaces**:
- `SwiftCommand` - IPC request structure
- `SwiftResponse<T>` - IPC response structure
- `SwiftErrorDetail` - Error detail structure

---

### 7. Error Conversion ✅ COMPLETE (NEW)
**Location**: `src/core/native-capture-manager.ts:239-289`
**Status**: ✅ COMPLETE - Fully Implemented
**Implementation**:
- ✅ `convertSwiftError()`: Maps Swift errors to ScreenshotError
- ✅ Comprehensive error code mapping:
  - `PERMISSION_DENIED` → System Settings deeplink
  - `USER_CANCELLED` → User-friendly message
  - `TIMEOUT` → Timeout message
  - `INVALID_REGION` → Region validation error
  - `DISPLAY_NOT_FOUND` → Display error
  - `WINDOW_NOT_FOUND` → Window error
  - `CAPTURE_FAILED` → Generic capture error
  - `ENCODING_FAILED` → Image encoding error
  - `FILE_WRITE_ERROR` → File I/O error
- ✅ Actionable error messages
- ✅ Fallback for unknown error codes

**Completed**: Phase 6.6 (TypeScript implementation)

---

## Integration Points Requiring Implementation

### 5. ScreenshotEngine - Native Manager Wiring ✅ COMPLETE
**Location**: `src/core/factories.ts:39-44`
**Status**: ✅ COMPLETE - Wired in Production (Phase 6.4)
**Implementation**:
- ✅ Updated `src/core/factories.ts` to call `createNativeCaptureManager()`
- ✅ Native manager passed to `ScreenshotEngine` constructor in factory
- ✅ Cleanup handled via `ScreenshotEngine.cleanup()` (calls `nativeCaptureManager.cleanup()`)
- ✅ Platform-aware: Factory returns appropriate manager for current platform

**Completed**: Phase 6.4
**Commit**: TBD

---

## Configuration Gaps

### 6. Native Capture Configuration ⚠️ DEFERRED (Per Sub-Phase 3.5 Decision)
**Location**: N/A
**Status**: ⚠️ DEFERRED - Not Required
**Decision**: Feature flags REJECTED per Sub-Phase 3.5 evaluation

**Rationale** (from sub-phase-3.5-feature-flag-evaluation.md):
- Target type selection (`type: 'url'` vs `'type: 'region'`) already provides user choice
- No performance benefit from configuration flags
- Platform detection handled by factory pattern
- If security needed: use env var policy check (simpler)

**Current Approach**: No configuration needed
- Factory function auto-detects platform
- User selects capture type via MCP tool parameter
- Clear error messages guide users

**If Future Requirements Change**:
- Consider environment variable: `ALLOW_DESKTOP_CAPTURE`
- Simple policy check function
- Do NOT add complex feature flag structure

---

## Swift Helper Binary

### 7. ScreenCaptureKit Swift Helper
**Location**: To be created
**Status**: ❌ NOT IMPLEMENTED
**Current Behavior**: Does not exist
**Required Implementation**:
- Create Swift CLI application using ScreenCaptureKit
- Implement JSON-based stdin/stdout IPC protocol
- Support commands: `capture_interactive`, `capture_region`, `capture_window`, `capture_display`
- SwiftUI picker for interactive mode
- Permission checking and error handling
- Build as standalone binary
- Package with npm distribution

**Implementation Plan**: Phase 6.5+ (Future Work)
**Language**: Swift 5.9+
**Frameworks**: ScreenCaptureKit, SwiftUI, AppKit
**Build System**: Swift Package Manager or Xcode
**Distribution**: Bundle pre-compiled binary in npm package

---

## Testing Gaps

### 8. Integration Tests for Native Capture
**Location**: To be created
**Status**: ❌ NOT IMPLEMENTED
**Current Behavior**: Only unit tests with mocks exist
**Required Implementation**:
- E2E tests for interactive capture flow
- E2E tests for region capture
- Permission failure scenarios
- Helper process crash/timeout handling
- Platform detection tests on actual CI runners

**Implementation Plan**: Phase 6.5 (New Sub-Phase)
**Test Environment**: Requires macOS runner with Screen Recording permission

---

## Documentation Gaps

### 9. Native Capture User Documentation
**Location**: To be created
**Status**: ❌ NOT IMPLEMENTED
**Required Documentation**:
- README section on desktop capture
- Screen Recording permission setup guide
- Platform compatibility matrix
- Troubleshooting guide
- Example usage with MCP clients

**Implementation Plan**: Phase 6.5

---

### 10. Native Capture API Documentation
**Location**: To be created
**Status**: ❌ NOT IMPLEMENTED
**Required Documentation**:
- INativeCaptureManager API reference
- NativeCaptureOptions type documentation
- Error codes and handling guide
- IPC protocol specification

**Implementation Plan**: Phase 6.5

---

## Completion Checklist

Before Phase 6 can be marked complete:

- [x] All stub methods in MacOSCaptureManager implemented (Phase 6.6)
- [x] Native capture manager wired into production server initialization (Phase 6.4)
- [x] Error scenarios handled gracefully (Phase 6.6)
- [x] TypeScript unit tests complete (Phase 6.6)
- [ ] Swift ScreenCaptureKit helper binary created and tested (Phase 6.7)
- [ ] Integration tests for native capture passing on macOS (Phase 6.8)
- [ ] User documentation complete (Phase 6.9)
- [ ] API documentation complete (Phase 6.9)
- [ ] Permission handling tested and documented (Phase 6.9)
- [ ] Binary distribution strategy finalized (Phase 6.9)
- [ ] CI/CD updated to build/test on macOS runners (Phase 6.9)

---

## Current Phase Status

**Phase 6.1**: ✅ Complete - Error guardrails
**Phase 6.2**: ✅ Complete - Architecture & interfaces (created the stubs)
**Phase 6.3**: ✅ Complete - Per-session directory structure
**Phase 6.4**: ✅ Complete - Production wiring
**Phase 6.5**: ✅ Complete - Swift design (sub-phase-5-swift-design.md)
**Phase 6.6**: ✅ Complete - TypeScript IPC implementation (THIS PHASE)
**Phase 6.7**: ⏳ Next - Swift helper implementation
**Phase 6.8**: ⏳ Planned - Integration testing
**Phase 6.9**: ⏳ Planned - Documentation

**Estimated Remaining Work**: ~3 sub-phases

---

## Notes

- All stubs throw clear errors indicating they are not yet implemented
- Error messages direct users to Phase 6.3+ for implementation timeline
- Stubs are documented in code with "Phase 6.X" comments
- This tracking document must be updated as implementations are completed
- No stub implementations should remain when Phase 6 is marked complete
- Integration tests are critical before removing stub status
