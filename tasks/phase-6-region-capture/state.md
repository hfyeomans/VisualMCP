# Phase 6 State: Region Capture Implementation

> **Note**: This file tracks **current progress and status**. For complete overview and documentation, see [README.md](./README.md).
> The root project README.md is only updated when features are production-ready for end users.

## Current Status
**Status**: Sub-Phase 5 IN PROGRESS (Swift Implementation - Phase 2 Complete)
**Created**: 2025-10-05
**Last Updated**: 2025-10-15

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

### Sub-Phase 3: Restructure Monitoring Persistence ✅ COMPLETE
**Goal**: Move to per-session directory structure
**Status**: Complete
**Commit**: 2435a0b
**Dependencies**: Sub-Phase 2.1 (P1/P2 fixes)
**Deliverables**:
- ✅ Per-session directory structure (`sessions/<id>/session.json`, `sessions/<id>/images/`)
- ✅ Public methods: `getSessionDirectory()`, `getImagesDirectory()`, `getRecordingsDirectory()`
- ✅ Automatic migration from legacy flat JSON format
- ✅ Legacy detection with `isLegacySession()` method
- ✅ Migration logic in `migrateLegacySession()` with safety checks
- ✅ Updated `MonitoringManager` to store screenshots in per-session directories
- ✅ Relative path storage for portability
- ✅ Legacy files backed up as `*.json.migrated`
- ✅ 16 comprehensive unit tests (all passing)
- ✅ Updated existing tests for new structure
- ✅ Added 3 migration-specific test suites

### Sub-Phase 3.5: Feature Flag Evaluation ✅ COMPLETE (REJECTED)
**Goal**: Evaluate feasibility of independent toggle switches for browser vs native capture
**Status**: Complete - **DECISION: REJECT FEATURE FLAGS**
**Commit**: TBD
**Dependencies**: Sub-Phase 3

**Analysis Conducted**:
- ✅ Security implications (runtime policy checks are better)
- ✅ Performance impact (zero - managers are lightweight, lazy init)
- ✅ Testing isolation (target type selection already provides this)
- ✅ Platform availability (factory pattern already handles)
- ✅ Comparison with industry patterns (Puppeteer, FFmpeg, Docker)
- ✅ MCP philosophy alignment (expose capabilities, don't hide them)
- ✅ Alternative solutions evaluated (env var policy checks)

**Key Findings**:
- **Target type selection already provides user choice** (`type: 'url'` vs `'type: 'region'`)
- Selection happens at invocation time (MCP tool call), not configuration time
- Zero performance cost (managers only consume resources when actively used)
- Feature flags would add complexity without corresponding benefits
- Current architecture scores 37/40 vs feature flags 19/40

**Decision Rationale**:
1. User explicitly chooses capture type via `target.type` parameter
2. Platform detection handled by factory pattern (no duplication)
3. Lazy initialization provides optimal performance
4. Testing isolation via target type selection (no config needed)
5. Follows MCP philosophy: expose capabilities, return helpful errors
6. If security needed: use env var policy check (simpler than flags)

**Deliverables**:
- ✅ Comprehensive evaluation document: `sub-phase-3.5-feature-flag-evaluation.md`
- ✅ Evaluation matrix comparing approaches
- ✅ Industry pattern research
- ✅ Alternative solutions for each concern
- ✅ Clear recommendation: REJECT feature flags
- ✅ Guidance for Phase 6.4 implementation

### Sub-Phase 4: Production Wiring ✅ COMPLETE
**Goal**: Wire native capture manager into production server
**Status**: Complete
**Commit**: TBD
**Dependencies**: Sub-Phase 3.5 (Feature flag decision)
**Deliverables**:
- ✅ Updated `src/core/factories.ts` to call `createNativeCaptureManager()`
- ✅ Native manager passed to `ScreenshotEngine` in production factory
- ✅ Platform-aware: Factory auto-detects and creates appropriate manager
- ✅ Cleanup handled via `ScreenshotEngine.cleanup()` chain
- ✅ Updated stub-tracking.md to mark wiring as complete
- ✅ No feature flags added (per Sub-Phase 3.5 decision)

**What Was Done**:
- Added import for `createNativeCaptureManager`
- Factory now creates native manager and passes to ScreenshotEngine
- Maintains platform awareness (macOS vs others)
- Graceful degradation on unsupported platforms

**What Was NOT Done** (Per Sub-Phase 3.5):
- ❌ No feature flag configuration added
- ❌ No conditional creation based on config
- ❌ No admin toggle switches

### Sub-Phase 5: Swift ScreenCaptureKit Implementation ⏳ IN PROGRESS
**Goal**: Implement actual Swift CLI helper for ScreenCaptureKit
**Status**: In Progress - Swift Phase 2 Complete
**Dependencies**: Sub-Phase 4 (Production wiring) ✅ COMPLETE
**Location**: `/Users/hank/dev/src/VisualMCP/screencapture-helper/`

**Swift Implementation Phases** (internal roadmap within Sub-Phase 5):
- ✅ Swift Phase 1: Core Infrastructure (IPC layer) - COMPLETE
  - JSON over stdin/stdout working
  - Command parsing and routing
  - 10 unit tests passing
  - Binary: 229KB release
  - Validation: phase1-test-report.md
- ✅ Swift Phase 2: Permission & Availability - COMPLETE
  - PermissionManager with ScreenCaptureKit integration
  - CaptureCoordinator actor for command routing
  - `check_availability` command working
  - System Settings deeplink functional
  - 16 unit tests passing (6 new)
  - Binary: 430KB
  - Validation: phase2-test-report.md
- ⏳ Swift Phase 3: Basic Region Capture - NEXT
  - CaptureEngine with ScreenCaptureKit
  - ImageProcessor for encoding
  - `capture_region` command
  - Timeout handling
- ⏳ Swift Phase 4: Interactive Picker (Week 3)
  - SwiftUI picker for window selection
  - `capture_interactive` command
- ⏳ Swift Phase 5: Region Selector (Week 3-4)
  - Interactive region selection overlay
- ⏳ Swift Phase 6: Polish & Optimization (Week 4)
  - Retry logic, binary optimization, comprehensive tests
- ⏳ Swift Phase 7: Integration & Deployment (Week 5)
  - Complete MacOSCaptureManager TypeScript stubs
  - Remove stub error throws
  - Integration testing

**Deliverables Completed So Far**:
- ✅ Swift CLI project structure with Package.swift
- ✅ JSON-based IPC protocol working (stdin/stdout)
- ✅ Permission handling with ScreenCaptureKit
- ✅ check_availability command functional
- ✅ System Settings deeplink
- ✅ Comprehensive unit tests (16 tests)
- ✅ Design documentation (sub-phase-5-swift-design.md)

**Remaining Deliverables**:
- ⏳ ScreenCaptureKit capture implementation
- ⏳ SwiftUI picker for interactive selection
- ⏳ Region selector overlay
- ⏳ Complete MacOSCaptureManager TypeScript stubs
- ⏳ Build and distribution strategy
- ⏳ Integration testing

### Sub-Phase 6: Documentation & User Guide ⏳ PENDING
**Goal**: Update documentation for production-ready feature
**Status**: Not Started
**Dependencies**: Sub-Phase 5 (Swift implementation complete)
**Deliverables**:
- Updated README.md with desktop capture documentation
- Migration guide for persistence changes
- Target type selection guide (type: 'url' vs 'region')
- Platform compatibility matrix
- Screen Recording permission setup guide
- Troubleshooting guide

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
