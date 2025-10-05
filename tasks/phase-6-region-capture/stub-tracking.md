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

### 1. MacOSCaptureManager.captureInteractive()
**Location**: `src/core/native-capture-manager.ts:45-55`
**Status**: ❌ STUB - Not Implemented
**Current Behavior**: Throws `ScreenshotError` with code `NATIVE_CAPTURE_NOT_IMPLEMENTED`
**Required Implementation**:
- Spawn Swift ScreenCaptureKit helper process
- Send JSON command over stdin: `{"command": "capture_interactive", "options": {...}}`
- Receive JSON response over stdout with file path and metadata
- Handle user cancellation gracefully
- Check Screen Recording permission before spawning
- Return `NativeCaptureResult` with actual captured screenshot

**Implementation Plan**: Phase 6.3
**Related Files**:
- Swift helper CLI (to be created)
- IPC protocol specification (see sub-phase-2-design.md)

---

### 2. MacOSCaptureManager.captureRegion()
**Location**: `src/core/native-capture-manager.ts:62-77`
**Status**: ❌ STUB - Not Implemented
**Current Behavior**: Throws `ScreenshotError` with code `NATIVE_CAPTURE_NOT_IMPLEMENTED`
**Required Implementation**:
- Spawn Swift ScreenCaptureKit helper process
- Send JSON command with region coordinates: `{"command": "capture_region", "region": {x, y, width, height}}`
- Receive JSON response with captured image
- Handle Screen Recording permission failures
- Return `NativeCaptureResult` with actual captured screenshot

**Implementation Plan**: Phase 6.3
**Related Files**:
- Swift helper CLI (to be created)
- IPC protocol specification (see sub-phase-2-design.md)

---

### 3. MacOSCaptureManager.cleanup()
**Location**: `src/core/native-capture-manager.ts:108-118`
**Status**: ⚠️ PARTIAL STUB - No-op Implementation
**Current Behavior**: No-op (returns immediately if not initialized)
**Required Implementation**:
- Terminate Swift helper process if running
- Wait for graceful shutdown with timeout
- Force kill if timeout exceeded
- Clear all process references
- Clean up any temporary files created by helper
- Unregister from cleanup manager

**Implementation Plan**: Phase 6.3
**Dependencies**: Requires helper process management implementation

---

### 4. MacOSCaptureManager.isAvailable()
**Location**: `src/core/native-capture-manager.ts:84-95`
**Status**: ⚠️ PARTIAL STUB - Platform Check Only
**Current Behavior**: Returns `true` only if platform is 'darwin'
**Required Implementation**:
- Check if Swift helper binary exists at configured path
- Verify Swift helper is executable
- Check Screen Recording permission status
- Optionally: Verify macOS version >= 12.3 (ScreenCaptureKit requirement)
- Return `false` if any prerequisite is missing

**Implementation Plan**: Phase 6.3
**Related Files**:
- Configuration for helper path
- Permission checking utilities

---

## Integration Points Requiring Implementation

### 5. ScreenshotEngine - Native Manager Wiring
**Location**: `src/screenshot/puppeteer.ts:35`
**Status**: ⚠️ PARTIAL - Optional Parameter Exists, Not Wired in Production
**Current Behavior**: Native manager can be passed but isn't instantiated anywhere in production code
**Required Implementation**:
- Update `src/index.ts` to instantiate native capture manager
- Call `createNativeCaptureManager()` factory function
- Pass manager instance to `ScreenshotEngine` constructor
- Register cleanup handler with `CleanupManager`

**Implementation Plan**: Phase 6.3
**Related Files**:
- `src/index.ts` - Main server initialization

---

## Configuration Gaps

### 6. Native Capture Configuration
**Location**: `src/core/config.ts`
**Status**: ❌ NOT IMPLEMENTED
**Current Behavior**: No configuration for native capture
**Required Implementation**:
```typescript
export interface Config {
  // ... existing config
  nativeCapture: {
    enabled: boolean;
    helperPath: string; // Path to Swift CLI helper
    platform: NativeCapturePlatform;
    defaultTimeout: number;
  };
}
```

**Implementation Plan**: Phase 6.3
**Default Values**:
- `enabled`: `true` on macOS, `false` otherwise
- `helperPath`: `./bin/screencapture-helper` (or platform-specific)
- `platform`: Auto-detected from `os.platform()`
- `defaultTimeout`: `30000` (30 seconds)

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

**Implementation Plan**: Phase 6.4 (New Sub-Phase)
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

- [ ] All stub methods in MacOSCaptureManager implemented
- [ ] Swift ScreenCaptureKit helper binary created and tested
- [ ] Native capture manager wired into production server initialization
- [ ] Configuration for native capture added to config system
- [ ] Integration tests for native capture passing on macOS
- [ ] User documentation complete
- [ ] API documentation complete
- [ ] Permission handling tested and documented
- [ ] Error scenarios handled gracefully
- [ ] Binary distribution strategy finalized
- [ ] CI/CD updated to build/test on macOS runners

---

## Current Phase Status

**Phase 6.1**: ✅ Complete - Error guardrails
**Phase 6.2**: ✅ Complete - Architecture & interfaces (this created the stubs)
**Phase 6.3**: ⏳ Planned - Swift helper implementation
**Phase 6.4**: ⏳ Planned - Production wiring & configuration
**Phase 6.5**: ⏳ Planned - Testing & documentation

**Estimated Remaining Work**: ~3-4 sub-phases

---

## Notes

- All stubs throw clear errors indicating they are not yet implemented
- Error messages direct users to Phase 6.3+ for implementation timeline
- Stubs are documented in code with "Phase 6.X" comments
- This tracking document must be updated as implementations are completed
- No stub implementations should remain when Phase 6 is marked complete
- Integration tests are critical before removing stub status
