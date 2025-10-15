# Phase 6: Region Capture Implementation

## Overview

Phase 6 adds native desktop screenshot capture to Visual MCP using Apple's ScreenCaptureKit framework on macOS. This enables capturing specific windows, regions, and displays directly from the desktop environment.

## Current Status: IN PROGRESS

**Completed Sub-Phases**: 2/5+
**Production Ready**: ❌ No (stub implementations remain)

See [stub-tracking.md](./stub-tracking.md) for detailed status of incomplete implementations.

## Quick Links

- **[plan.md](./plan.md)** - Original implementation plan and scope
- **[research.md](./research.md)** - Research notes on ScreenCaptureKit and macOS capture
- **[state.md](./state.md)** - Current progress and sub-phase status
- **[stub-tracking.md](./stub-tracking.md)** - ⚠️ **CRITICAL** - Incomplete implementations requiring work
- **[sub-phase-2-design.md](./sub-phase-2-design.md)** - Detailed architecture design for native capture manager

## Sub-Phases

### ✅ Phase 6.1: Guardrail & Error Handling (Complete)
**Commit**: 4e447a6
- Replaced HTML placeholder with proper error handling
- Added descriptive errors explaining ScreenCaptureKit requirement
- Created initial unit tests

### ✅ Phase 6.2: Desktop Capture Manager Architecture (Complete)
**Commit**: 93c587b, b390b3d
- Created `INativeCaptureManager` interface following `BrowserManager` pattern
- Implemented `MacOSCaptureManager` stub with proper error messages
- Implemented `UnsupportedPlatformCaptureManager` for non-macOS platforms
- Added comprehensive type definitions
- Integrated with `ScreenshotEngine` as optional dependency
- 9 unit tests covering all integration scenarios
- **Created stub-tracking.md to document incomplete implementations**

### ⏳ Phase 6.3: Swift ScreenCaptureKit Helper (Planned)
**Dependencies**: Phase 6.2
**Goal**: Implement actual Swift CLI helper for ScreenCaptureKit
- Create Swift application using ScreenCaptureKit framework
- Implement JSON-based IPC protocol
- SwiftUI picker for interactive capture
- Permission handling and error reporting
- Build and distribution strategy

**This phase will complete stubs in MacOSCaptureManager**

### ⏳ Phase 6.4: Production Wiring & Configuration (Planned)
**Dependencies**: Phase 6.3
**Goal**: Wire native capture into production server
- Update server initialization to instantiate native manager
- Add configuration for helper path and settings
- Register cleanup handlers
- Platform detection and auto-configuration

### ⏳ Phase 6.5: Testing & Documentation (Planned)
**Dependencies**: Phase 6.4
**Goal**: Comprehensive testing and user documentation
- Integration tests on macOS
- Permission testing scenarios
- User documentation for setup
- API documentation
- Troubleshooting guide

### ⏳ Phase 6.6: Monitoring Persistence Restructure (Planned)
**Dependencies**: Phase 6.1
**Goal**: Move monitoring artifacts to per-session directories
- Update `SessionRepository` for new layout
- Migration logic for legacy files
- Integration tests

## Architecture Principles

Following guidance to avoid over-abstraction and unnecessary adapter patterns:

1. **Follow Existing Patterns**: Mirrors `BrowserManager`/`IBrowserManager` exactly
2. **Concrete Implementations**: No abstract base classes or premature abstraction
3. **Optional Dependencies**: Native manager injected optionally, graceful degradation
4. **Platform-Specific**: Clear separation via factory pattern
5. **Doesn't Block Core Changes**: `ScreenshotEngine` can evolve independently

## Files Created/Modified

### Created
- `src/types/native-capture.ts` - Type definitions
- `src/core/native-capture-manager.ts` - Manager implementations
- `src/__tests__/screenshot/screenshot-engine.test.ts` - Unit tests
- `tasks/phase-6-region-capture/sub-phase-2-design.md` - Architecture documentation
- `tasks/phase-6-region-capture/stub-tracking.md` - Stub implementation tracking

### Modified
- `src/interfaces/index.ts` - Added `INativeCaptureManager`
- `src/screenshot/puppeteer.ts` - Integrated native capture manager
- `src/types/index.ts` - Export native capture types
- `CHANGELOG.md` - Phase 6.1 and 6.2 entries

## Important Notes

### ⚠️ Stub Implementations

**This phase contains stub implementations that MUST be completed before production use.**

All incomplete work is tracked in [stub-tracking.md](./stub-tracking.md). Key stubs:
- `MacOSCaptureManager.captureInteractive()` - Throws not implemented error
- `MacOSCaptureManager.captureRegion()` - Throws not implemented error
- `MacOSCaptureManager.cleanup()` - No-op
- `MacOSCaptureManager.isAvailable()` - Platform check only, no helper verification
- Swift ScreenCaptureKit helper binary - Does not exist yet

**These stubs are intentional and documented.** They allow:
1. Clean architecture to be established
2. Integration layer to be tested with mocks
3. Future implementation to slot in without refactoring
4. Clear error messages guiding users to alternatives

### Testing Strategy

- **Unit Tests**: Comprehensive (9 tests, all passing) using mocks
- **Integration Tests**: Require Phase 6.3 (Swift helper) to be complete
- **E2E Tests**: Require macOS environment with Screen Recording permission

### Platform Support

- **macOS 12.3+**: Full support (via ScreenCaptureKit) - Phase 6.3+
- **Other Platforms**: Graceful error messages directing to URL-based screenshots

## Development Standards

All code follows project standards:
- TypeScript strict mode, no `any` types
- Single quotes, no semicolons
- Explicit parameter types
- ESLint import ordering
- Comprehensive error handling

## Next Steps

1. **Complete stub tracking documentation** ✅
2. **Phase 6.3**: Implement Swift ScreenCaptureKit helper
3. **Phase 6.4**: Wire into production server
4. **Phase 6.5**: Testing and documentation
5. **Remove all stubs** before marking Phase 6 complete

## Questions or Issues?

See [stub-tracking.md](./stub-tracking.md) for the current status of all incomplete work.
