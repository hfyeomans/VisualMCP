# Implementation Plan — Phase 6 Region Capture

## Scope Recap
- **Desktop region/window capture (macOS focus):** Replace the HTML placeholder with a deliberate `ScreenshotError` while we build a ScreenCaptureKit-based path. Introduce an interactive macOS picker first, with automation as an explicitly documented follow-up.
- **Desktop capture architecture:** Design extensible adapters so ScreenCaptureKit (macOS Tahoe 26) is the first implementation, with other platforms or automated flows activatable later.
- **Monitoring persistence:** Store session manifests and artefacts in per-session directories (`comparisons/sessions/<id>/...`) while remaining backward compatible with existing JSON files.
- **Video capture:** Deferred beyond this milestone; plan only for still imagery.

## Work Breakdown

### 1. Guardrail current region capture path
- Update `ScreenshotEngine.takeRegionScreenshot` to throw a descriptive `ScreenshotError` explaining that desktop capture requires macOS support currently under development.
- Ensure downstream call sites/tests expect this error; add/adjust unit tests in `src/screenshot/__tests__`.
- Document the temporary limitation in user-facing docs and MCP metadata.

### 2. Define desktop capture adapter layer
- Create `IDesktopCaptureAdapter` (TypeScript interface under `src/interfaces/desktop-capture.ts`), specifying methods such as `captureInteractive`, `captureRegion`, and `captureWindow`.
- Implement `NoopDesktopCaptureAdapter` returning structured `ScreenshotError`s and register it within `ScreenshotEngine` so the engine consults the adapter for non-web captures.
- Update dependency injection/config wiring to accept future adapter instances (e.g., via `config.screenshot.desktopAdapter` or service locator), respecting linting/typing rules from `AGENTS.md`.

### 3. Plan interactive macOS ScreenCaptureKit helper
- Based on `SCREEN_CAPTURE_RESEARCH.md`, draft the architecture for a Swift helper:
  - SwiftUI picker enumerates content through `SCShareableContent` and lets users choose display/window/region interactively.
  - On selection, configure `SCContentFilter` and `SCStreamConfiguration`, start an `SCStream`, and write the first (or requested number of) frames to disk under the provided output directory.
  - Expose a CLI/IPC contract (e.g., JSON over stdio) describing the requested capture type and returning file path + metadata.
  - Emit a roadmap note that automation (programmatic window/region capture) will reuse this helper with a non-interactive flow.
- Capture these design details plus permission requirements in docs (e.g., ADR or `docs/` entry) so implementation aligns with research.

### 4. Restructure monitoring persistence
- Adjust `SessionRepository` to read/write manifests at `comparisons/sessions/<sessionId>/session.json`; create `images/` subdir for screenshots (and `recordings/` reserved for later).
- Update `MonitoringManager` to place screenshots into the per-session `images/` folder and record relative paths in session metadata.
- Provide migration logic: when loading, detect legacy flat JSON (no per-session directory) and either move files or load in place while rewriting to the new layout.
- Extend integration tests (e.g., `monitoring-integration.test.ts`) to assert restart flows with the new directory structure.

### 5. Testing & Documentation
- Unit tests: cover adapter error behaviour, repository path changes, and config defaults.
- Integration tests: ensure monitoring restart rebuilds schedulers with per-session paths.
- Documentation: update usage guides to clarify interactive macOS capture support, future automation plans, the new persistence layout, and ScreenCaptureKit prerequisites (Screen Recording permission, macOS Tahoe 26+).

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
