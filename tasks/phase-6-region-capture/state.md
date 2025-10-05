# Phase 6 State: Region Capture Implementation

> **Note**: This file tracks **current progress and status**. For complete overview and documentation, see [README.md](./README.md).
> The root project README.md is only updated when features are production-ready for end users.

## Current Status
**Status**: Phase 6.2.1 Complete (P1/P2 Fixed) - Ready for Sub-Phase 3
**Created**: 2025-10-05
**Last Updated**: 2025-10-05

## Context
Phase 6 implements native macOS desktop capture using ScreenCaptureKit (macOS Tahoe 26), restructures monitoring persistence into per-session directories, and establishes an extensible adapter architecture for future platform support.

## Sub-Phase Breakdown

### Sub-Phase 1: Guardrail & Error Handling ✅ COMPLETE
**Goal**: Replace placeholder region capture with proper error handling
**Status**: Complete
**Commit**: 4e447a6
**Dependencies**: None
**Deliverables**:
- ✅ Updated `ScreenshotEngine.takeRegionScreenshot` with descriptive `ScreenshotError`
- ✅ Unit tests for error behaviour in `src/__tests__/screenshot/screenshot-engine.test.ts`
- ✅ CHANGELOG.md updated with Phase 6.1 changes
- ✅ Removed 82 lines of placeholder HTML code

### Sub-Phase 2: Desktop Capture Adapter Layer ✅ COMPLETE
**Goal**: Create extensible native capture manager architecture following BrowserManager pattern
**Status**: Complete
**Commit**: 93c587b, b390b3d, fe17eb5
**Dependencies**: Sub-Phase 1
**Deliverables**:
- ✅ `INativeCaptureManager` interface (mirrors IBrowserManager pattern)
- ✅ `MacOSCaptureManager` stub implementation for ScreenCaptureKit
- ✅ `UnsupportedPlatformCaptureManager` for non-macOS platforms
- ✅ Integration with `ScreenshotEngine` as optional dependency
- ✅ Native capture type definitions (`NativeCaptureOptions`, `NativeCaptureResult`)
- ✅ Factory function `createNativeCaptureManager()` for platform detection
- ✅ Comprehensive unit tests (9 test cases, all passing)
- ✅ Architecture documentation in `sub-phase-2-design.md`
- ✅ Stub tracking documentation in `stub-tracking.md`

### Sub-Phase 2.1: Critical P1/P2 Fixes ✅ COMPLETE
**Goal**: Fix option forwarding and platform reporting before Sub-Phase 3
**Status**: Complete
**Commits**: dfdf46c (interface/plumbing), TBD (schema completion)
**Dependencies**: Sub-Phase 2

**Issues Fixed**:

**P1 - Forward Native Capture Options** [HIGH PRIORITY] ✅
- **Root Cause** (Multi-part):
  1. `ScreenshotOptionsSchema` was missing `timeout` and `waitForNetworkIdle` fields → Zod stripped them
  2. Interface only accepted bare region coordinates → couldn't forward options
  3. Options never reached native layer
- **Fixes Applied**:
  - ✅ Added `timeout: z.number().int().positive().optional()` to `ScreenshotOptionsSchema`
  - ✅ Added `waitForNetworkIdle: z.boolean().optional()` to `ScreenshotOptionsSchema`
  - ✅ Extended `INativeCaptureManager.captureRegion()` to accept full `NativeCaptureOptions`
  - ✅ Constructed complete options object in `ScreenshotEngine.takeRegionScreenshot()`
  - ✅ Options now include: region, format, quality, timeout, outputPath
- **Verification**:
  - Test "should forward timeout option to native manager (P1 schema fix)" verifies timeout=5000 reaches native manager
  - Previously timeout was always 30000 (config default) regardless of user input
  - Now user-supplied timeout properly flows through entire chain

**P2 - Report Actual Platform Name** [MEDIUM PRIORITY] ✅
- **Root Cause**: `UnsupportedPlatformCaptureManager.getPlatform()` returned 'none' for all platforms
- **Fix**: Platform name mapping in `getPlatform()` switch statement
  - `win32` → `'windows'`
  - `linux` → `'linux'`
  - Others → `'none'`
- **Verification**: Error messages now show actual platform name

**Deliverables**:
- ✅ Schema updated with timeout and waitForNetworkIdle fields
- ✅ Updated `INativeCaptureManager.captureRegion()` signature
- ✅ Options construction in `ScreenshotEngine.takeRegionScreenshot()`
- ✅ Platform name mapping in `UnsupportedPlatformCaptureManager.getPlatform()`
- ✅ Unit tests for both fixes (12 total tests passing, added 3 new tests)
- ✅ Updated CHANGELOG.md, plan.md, and stub-tracking.md

### Sub-Phase 3: Restructure Monitoring Persistence ⏳ PENDING
**Goal**: Move to per-session directory structure
**Status**: Not Started
**Dependencies**: Sub-Phase 2.1 (P1/P2 fixes)
**Deliverables**:
- Updated `SessionRepository` with new directory layout
- Migration logic for legacy files
- Updated `MonitoringManager` for per-session paths
- Integration tests for persistence

### Sub-Phase 3.5: Feature Flag Evaluation ⏳ PENDING
**Goal**: Evaluate feasibility of independent toggle switches for browser vs native capture
**Status**: Not Started
**Dependencies**: Sub-Phase 3
**Deliverables**:
- Analysis of use cases (security, performance, testing, platform-specific)
- Architecture impact assessment
- Configuration design proposal
- Recommendation document (implement, defer, or reject)

### Sub-Phase 4: Swift ScreenCaptureKit Implementation ⏳ PENDING
**Goal**: Implement actual Swift helper for ScreenCaptureKit
**Status**: Not Started
**Dependencies**: Sub-Phase 2
**Deliverables**:
- Swift CLI application using ScreenCaptureKit
- JSON-based IPC protocol implementation
- SwiftUI picker for interactive mode
- Permission handling and error reporting
- Build and distribution strategy
- **Completes stub implementations in MacOSCaptureManager**

### Sub-Phase 5: Production Wiring & Documentation ⏳ PENDING
**Goal**: Update all documentation and provide migration guide
**Status**: Not Started
**Dependencies**: Sub-Phases 1-4
**Deliverables**:
- Updated README.md
- Migration guide for persistence changes
- Interactive capture usage docs
- API documentation updates

## Technical Notes

### Architecture Decisions
- **Adapter Pattern**: Allows platform-specific implementations without changing core engine
- **Per-Session Directories**: Better organization, future-proofs for video/multi-artifact sessions
- **Interactive-First**: Users select windows/regions via UI before automation (future)

### Key Files to Modify
- `src/screenshot/puppeteer.ts` - Update `takeRegionScreenshot`
- `src/interfaces/desktop-capture.ts` - New adapter interface
- `src/monitoring/session-repository.ts` - Persistence restructure
- `src/monitoring/monitoring.ts` - Per-session path handling
- `src/core/config.ts` - Adapter configuration

### Standards Compliance
- TypeScript strict mode, no `any` types
- Single quotes, no semicolons
- Explicit parameter types
- Modern Swift with async/await
- SwiftUI for macOS Tahoe 26

## Risks & Mitigations
1. **Risk**: ScreenCaptureKit permission failures
   **Mitigation**: Clear error messages with permission instructions

2. **Risk**: Session migration data loss
   **Mitigation**: Fallback logic, comprehensive tests, backup recommendations

3. **Risk**: Node ↔ Swift bridge complexity
   **Mitigation**: Well-defined CLI contract, narrow scope for initial implementation

## Out of Scope
- Automated (non-interactive) capture flows
- Windows/Linux adapters
- Video capture support
- Multi-frame capture sequences

## Next Steps
Begin Sub-Phase 1: Guardrail & Error Handling
