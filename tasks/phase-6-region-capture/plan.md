# Implementation Plan — Phase 6 Region Capture

## Scope Recap
- **Desktop region/window capture (macOS focus):** Replace the HTML placeholder with a deliberate `ScreenshotError` while we build a ScreenCaptureKit-based path. Introduce an interactive macOS picker first, with automation as an explicitly documented follow-up.
- **Desktop capture architecture:** Design extensible adapters so ScreenCaptureKit (macOS Tahoe 26) is the first implementation, with other platforms or automated flows activatable later.
- **Monitoring persistence:** Store session manifests and artefacts in per-session directories (`comparisons/sessions/<id>/...`) while remaining backward compatible with existing JSON files.
- **Video capture:** Deferred beyond this milestone; plan only for still imagery.

## Work Breakdown

### Phase 6.2.1: Critical Fixes Before Sub-Phase 3

**P1 - Forward Native Capture Options** [HIGH PRIORITY]
- **Issue**: User-supplied options (format, quality, timeout) are silently ignored for desktop captures
- **Location**: `src/interfaces/index.ts:85`, `src/screenshot/puppeteer.ts:264`
- **Impact**: When Swift helper lands, all desktop captures will use hardcoded defaults
- **Fix Required**:
  - Extend `INativeCaptureManager.captureRegion()` to accept `NativeCaptureOptions`
  - Update `INativeCaptureManager.captureInteractive()` to accept `NativeCaptureOptions`
  - Plumb options from `ScreenshotEngine.takeRegionScreenshot()` through to native manager
  - Ensure format, quality, timeout, outputPath are forwarded
- **Testing**: Verify options are passed correctly with mock manager

**P2 - Report Actual Unsupported Platform** [MEDIUM PRIORITY]
- **Issue**: Windows/Linux users see "platform: none" instead of actual platform name
- **Location**: `src/core/native-capture-manager.ts:162-174`
- **Impact**: Misleading diagnostics, contradicts `NativeCapturePlatform` type
- **Fix Required**:
  - Map `os.platform()` results to proper platform names
  - 'win32' → 'windows'
  - 'linux' → 'linux'
  - Others → 'none'
  - Update `UnsupportedPlatformCaptureManager.getPlatform()`
- **Testing**: Verify error messages on different platforms

**Status**: Must complete before Sub-Phase 3 (Monitoring Persistence)

---

### 1. Guardrail current region capture path [✅ COMPLETE - Phase 6.1]
- Update `ScreenshotEngine.takeRegionScreenshot` to throw a descriptive `ScreenshotError` explaining that desktop capture requires macOS support currently under development.
- Ensure downstream call sites/tests expect this error; add/adjust unit tests in `src/screenshot/__tests__`.
- Document the temporary limitation in user-facing docs and MCP metadata.

### 2. Define desktop capture adapter layer [✅ COMPLETE - Phase 6.2]
- Created `INativeCaptureManager` interface following `BrowserManager` pattern
- Implemented `MacOSCaptureManager` stub with clear error messages
- Implemented `UnsupportedPlatformCaptureManager` for non-macOS platforms
- Integrated into `ScreenshotEngine` as optional dependency
- Created comprehensive type definitions and factory function
- **Note**: Stub implementations tracked in `stub-tracking.md`

### 3. Restructure monitoring persistence [⏳ PENDING - Sub-Phase 3]
- Adjust `SessionRepository` to read/write manifests at `comparisons/sessions/<sessionId>/session.json`; create `images/` subdir for screenshots (and `recordings/` reserved for later).
- Update `MonitoringManager` to place screenshots into the per-session `images/` folder and record relative paths in session metadata.
- Provide migration logic: when loading, detect legacy flat JSON (no per-session directory) and either move files or load in place while rewriting to the new layout.
- Extend integration tests (e.g., `monitoring-integration.test.ts`) to assert restart flows with the new directory structure.

### 4. Swift ScreenCaptureKit helper implementation [⏳ PENDING - Phase 6.3+]
- Based on `SCREEN_CAPTURE_RESEARCH.md`, implement Swift helper:
  - SwiftUI picker enumerates content through `SCShareableContent`
  - On selection, configure `SCContentFilter` and `SCStreamConfiguration`
  - Start `SCStream`, write frames to disk
  - Expose CLI/IPC contract (JSON over stdio)
  - Automation support (programmatic capture) for future
- See `stub-tracking.md` for implementation requirements

### 5. Feature flag evaluation [⏳ PENDING - Sub-Phase 3.5]
**Goal**: Evaluate feasibility of independent toggle switches for browser vs native capture
- **Rationale**: Allow selective enablement/disablement of capture types
- **Use Cases**:
  - Security: Disable desktop capture in restricted environments
  - Performance: Reduce resource usage by disabling unused capture types
  - Testing: Isolate capture types during development
  - Platform-specific: Auto-disable native capture on unsupported platforms
- **Implementation Considerations**:
  - Configuration structure: `config.capture.web.enabled`, `config.capture.native.enabled`
  - Dependency injection: Conditionally create managers based on flags
  - Error handling: Clear messages when feature is disabled vs unavailable
  - Default values: Web enabled by default, native auto-detected
  - Migration: Backward compatibility with current setup
- **Evaluation Criteria**:
  - Complexity vs benefit analysis
  - Impact on existing architecture
  - Testing requirements
  - Documentation overhead
- **Output**: Design document with recommendation (implement, defer, or reject)

### 6. Testing & Documentation [⏳ PENDING - Phase 6.5]
- Unit tests: cover adapter error behaviour, repository path changes, and config defaults
- Integration tests: ensure monitoring restart rebuilds schedulers with per-session paths
- Documentation: update usage guides to clarify interactive macOS capture support, future automation plans, the new persistence layout, and ScreenCaptureKit prerequisites (Screen Recording permission, macOS Tahoe 26+)

## Deliverables & Artifacts
- Updated TypeScript sources following linting/typing standards; no `any`, single quotes, no semicolons.
- Swift helper design doc referencing `SCREEN_CAPTURE_RESEARCH.md` and relevant Xcode resources from `AGENTS.md` when needed.
- Tests covering new error handling and persistence.
- Documentation pages describing interactive capture flow and persistence changes.

## Risks & Mitigations
- **Native helper complexity:** mitigate by defining a narrow CLI contract and staging implementation (error first, design doc now).
- **Permission failures:** ensure error messages instruct users to grant Screen Recording access.
- **Persistence migration:** include fallback logic and tests to prevent data loss.

## Stub Implementations Requiring Completion

**CRITICAL**: Phase 6 currently contains stub implementations that MUST be completed before production use.

See `tasks/phase-6-region-capture/stub-tracking.md` for comprehensive tracking of:
- MacOSCaptureManager stub methods (captureInteractive, captureRegion, cleanup, isAvailable)
- Swift ScreenCaptureKit helper binary (not yet created)
- Production wiring and configuration
- Integration tests
- Documentation

**Remaining Sub-Phases to Complete Stubs**:
- Phase 6.3: Swift helper implementation & IPC
- Phase 6.4: Production wiring & configuration
- Phase 6.5: Integration testing & documentation

## Deferred / Future Work
- Automated (non-interactive) capture flows using ScreenCaptureKit filters without UI.
- Windows/Linux adapters.
- Video capture support and associated persistence.
