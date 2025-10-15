# Changelog

All notable changes to the Visual MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 6.5**: Native macOS desktop capture using ScreenCaptureKit framework
- Swift CLI helper (`screencapture-helper`) for native screen capture on macOS 15+
- `capture_region` command for programmatic region capture via ScreenCaptureKit
- `check_availability` command for permission and system capability checking
- MacOSCaptureManager TypeScript implementation with IPC communication layer
- Helper binary finding with 5 search locations for flexible deployment
- Process lifecycle management (spawn, timeout, graceful shutdown)
- Comprehensive error conversion from Swift to TypeScript with actionable messages
- 57 new tests (23 Swift + 34 TypeScript) covering native capture functionality
- E2E test harness using @modelcontextprotocol/sdk for comprehensive server testing
- ESLint import ordering rules with automatic alphabetization
- GitHub Actions CI pipeline with lint, typecheck, unit, e2e, and build stages
- Release process documentation in `docs/RELEASE_CHECKLIST.md`
- Pluggable analyzer registry with strategy pattern for feedback generation
- JSON metadata persistence alongside diff images for reproducibility
- AsyncScheduler with jitter and exponential backoff for monitoring
- SessionRepository for persistent monitoring sessions (filesystem-based)
- AutoFeedbackManager with rate limiting for automated analysis
- Browser session management utilities for reusable page setup
- Filename sanitization for safe screenshot paths
- Deep merge support for configuration environment overrides
- Graceful shutdown hooks with comprehensive cleanup lifecycle
- Factory functions for all service initialization
- Component-specific loggers with structured metadata
- **Phase 6.1**: Descriptive error for desktop region capture explaining ScreenCaptureKit requirement
- **Phase 6.1**: Unit tests for region capture error handling
- **Phase 6.2**: `INativeCaptureManager` interface following `BrowserManager` pattern
- **Phase 6.2**: `MacOSCaptureManager` stub implementation for ScreenCaptureKit integration
- **Phase 6.2**: `UnsupportedPlatformCaptureManager` for non-macOS platforms
- **Phase 6.2**: Native capture type definitions (`NativeCaptureOptions`, `NativeCaptureResult`, `NativeCaptureConfig`)
- **Phase 6.2**: Factory function `createNativeCaptureManager()` for platform-specific managers
- **Phase 6.2**: Comprehensive unit tests for native capture manager integration (9 test cases)
- **Phase 6.2.1**: P1 fix - Native capture now receives full user options (format, quality, timeout)
- **Phase 6.2.1**: P1 schema fix - Added `timeout` and `waitForNetworkIdle` to `ScreenshotOptionsSchema` (prevents Zod stripping)
- **Phase 6.2.1**: P2 fix - Platform name mapping for accurate error messages (win32→windows, linux→linux)
- **Phase 6.2.1**: Regression test ensuring timeout=5000 reaches native manager (not default 30000)
- **Phase 6.3**: Per-session directory structure for monitoring artifacts (`sessions/<id>/session.json`, `sessions/<id>/images/`)
- **Phase 6.3**: Automatic migration from legacy flat JSON format to per-session directories
- **Phase 6.3**: Public methods: `getSessionDirectory()`, `getImagesDirectory()`, `getRecordingsDirectory()` (future video support)
- **Phase 6.3**: 16 comprehensive unit tests for persistence and migration (all passing)
- **Phase 6.3**: P0 fix - Updated integration tests to check new per-session directory structure
- **Phase 6.3.5**: Feature flag evaluation complete - REJECTED feature flags (see evaluation document)
- **Phase 6.4**: Native capture manager wired into production factory (platform-aware auto-detection)
- **Phase 6.5**: Swift ScreenCaptureKit CLI helper implementation (Phases 1-3 complete)
  - Phase 1: Core Infrastructure - JSON IPC protocol (stdin/stdout), 10 tests
  - Phase 2: Permission & Availability - ScreenCaptureKit integration, 6 tests
  - Phase 3: Basic Region Capture - Actual capture with PNG/JPEG encoding, 7 tests
- **Phase 6.5**: MacOSCaptureManager TypeScript integration complete (all stubs removed)
- **Phase 6.5**: Swift helper binary bundled in `bin/screencapture-helper` (342KB)

### Changed
- **BREAKING**: Desktop region capture now requires macOS 15+ with ScreenCaptureKit (previously placeholder)
- **BREAKING**: Scheduler configuration values (jitter, backoff) now properly honored instead of hardcoded
- **Phase 6.1**: Desktop region capture (`target.type = 'region'`) now throws descriptive `ScreenshotError` instead of creating placeholder HTML
- **Phase 6.2**: `ScreenshotEngine` now accepts optional `INativeCaptureManager` parameter (follows `BrowserManager` pattern)
- **Phase 6.2**: Region capture delegates to native manager when available, platform-aware error handling
- **Phase 6.2**: Enhanced cleanup lifecycle includes native capture manager cleanup
- **Phase 6.2.1**: `ScreenshotOptionsSchema` now accepts `timeout` and `waitForNetworkIdle` fields (user-facing)
- **Phase 6.2.1**: `INativeCaptureManager.captureRegion()` now accepts full `NativeCaptureOptions` instead of bare coordinates
- **Phase 6.2.1**: User-supplied format, quality, and timeout options now forwarded to native capture layer
- **Phase 6.2.1**: Platform name mapping in error messages (Windows shows "windows" not "none")
- **Phase 6.3**: `SessionRepository` now uses per-session directories (`sessions/<id>/session.json`)
- **Phase 6.3**: `MonitoringManager` stores screenshots in session-specific `images/` directories
- **Phase 6.3**: Screenshot paths stored as relative paths for portability
- **Phase 6.3**: Automatic migration from legacy flat structure on first load
- **Phase 6.3**: Legacy files backed up as `*.json.migrated` after migration
- **Phase 6.4**: Production factory now creates and wires native capture manager automatically
- **Phase 6.5**: MacOSCaptureManager now spawns Swift helper for actual capture (IPC communication)
- **Phase 6.5**: Helper binary finding searches 5 locations for flexible deployment
- **Phase 6.5**: Error messages include Screen Recording permission instructions with deeplink
- `no-console` ESLint rule changed from 'warn' to 'error' (intentional console usage requires eslint-disable)
- All services now use constructor-based dependency injection
- Configuration manager supports deep merging without overwriting unrelated fields
- Async initialization separated from construction via explicit `init()` methods
- Screenshot/comparison engines use reusable browser session helpers
- Image manipulation utilities merged to reduce code duplication
- Monitoring uses queued async scheduler instead of raw setInterval
- Import statements now automatically sorted by ESLint
- FeedbackGenerator refactored into composable analyzers
- Issue generation logic centralized to avoid duplication

### Fixed
- **CRITICAL**: Persisted monitoring sessions now properly resume after server restart - schedulers are automatically recreated for active sessions
- **CRITICAL**: Jest ESM import configuration for @modelcontextprotocol/sdk - E2E tests now transform ESM packages correctly
- Monitoring scheduler config values (jitterMs, backoffMultiplier, maxBackoffMs) now respected instead of hardcoded defaults
- E2E navigation timeout test increased to 15s to prevent false failures
- Cleanup manager properly disposes monitoring intervals on shutdown
- Configuration updates no longer overwrite nested unrelated fields
- No more overlapping monitoring executions via AsyncScheduler queuing
- Directory creation properly awaited in engine initialization

### Removed
- Unsupported `window` target type from screenshot schema (not yet implemented)
- dist/ directory from version control (generated during build/publish only)
- **Phase 6.1**: Placeholder HTML implementation for desktop region capture (replaced with proper error)

### Developer Experience
- Comprehensive E2E tests covering all MCP tools and error handling
- Lint-enforced import ordering for consistent code style
- CI pipeline ensures code quality before merge
- Release checklist provides step-by-step publish guidance
- Monitoring sessions persist across process restarts

### Technical Details
- Test coverage improved across all refactored modules
- All async initialization properly awaited
- Correlation IDs included in handler logs for request tracing
- Severity classification uses configurable thresholds
- Monitoring includes pause/resume capabilities

### Migration Notes
No breaking changes at the MCP tool interface level - all changes are internal refactoring. Existing tool invocations remain compatible.

## [1.0.0] - 2025-01-09

### Added
- Initial release of Visual MCP server
- Core MCP server implementation with JSON-RPC 2.0 transport
- Screenshot capture engine using Puppeteer for web automation
- Visual comparison module with pixel-perfect diffing using Pixelmatch
- AI-powered feedback analysis system for actionable UI improvements
- Real-time monitoring system for incremental screenshot capture
- Cross-platform support (macOS, Windows, Linux)

#### MCP Tools
- `take_screenshot`: Capture screenshots of web pages, windows, or regions
- `compare_visuals`: Compare images and detect visual differences
- `analyze_ui_feedback`: Generate actionable feedback from visual differences  
- `start_monitoring`: Begin incremental screenshot monitoring
- `stop_monitoring`: Stop monitoring sessions with detailed summaries

#### Testing & Validation
- Interactive test application with controllable UI changes
- Comprehensive CLI test runner with validation scenarios
- Interactive demo script showcasing all functionality
- Mock data and reference designs for testing workflows

#### Developer Experience  
- Full TypeScript implementation with comprehensive type definitions
- Detailed documentation with usage examples and integration guides
- CLI tools for testing, validation, and demonstration
- Error handling and validation for all MCP tool parameters

#### Integration Support
- Claude Code MCP configuration examples
- LMStudio integration documentation
- Generic MCP client compatibility
- Stdio and WebSocket transport support

### Technical Details
- Built on @modelcontextprotocol/sdk v0.5.0
- Uses Puppeteer 22.0.0 for web automation
- Sharp 0.33.0 for image processing
- Pixelmatch 6.0.0 for pixel-level comparisons
- Zod 3.22.0 for runtime type validation
- Full ES2022/ESNext module support

### File Structure
```
VisualMCP/
├── src/                     # TypeScript source code
├── test-app/               # Interactive test application
├── cli-tools/              # Testing and demo utilities
├── dist/                   # Compiled JavaScript output
├── screenshots/            # Screenshot storage
├── comparisons/            # Diff image storage
└── docs/                   # Documentation
```

### Security
- User consent mechanisms for screenshot capture
- File system access controls and validation
- Input sanitization for all MCP tool parameters
- Safe handling of external URLs and file paths

### Performance
- Efficient image processing with Sharp
- Optimized pixel comparison algorithms
- Background monitoring without blocking operations
- Memory-conscious image handling for large screenshots

### Known Limitations
- Desktop region capture requires platform-specific implementation (placeholder provided)
- Puppeteer requires Chrome/Chromium installation
- Large image comparisons may be memory intensive
- Monitoring intervals limited to 1-300 seconds

### Future Enhancements
- Native desktop screenshot capture across all platforms
- OCR integration for text-based comparisons
- Machine learning models for semantic visual understanding
- Integration with popular design tools (Figma, Sketch)
- Performance optimizations for large-scale monitoring

---

## Development Notes

This initial release provides a solid foundation for visual testing automation within MCP-enabled environments. The architecture is designed to be extensible, allowing for future enhancements while maintaining backward compatibility.

Key design decisions:
- TypeScript-first development for type safety
- Modular architecture for easy testing and maintenance
- Comprehensive error handling and user feedback
- Cross-platform compatibility from day one
- Rich CLI tooling for developer productivity

The project successfully bridges the gap between what coding agents build and visual outcomes, enabling rapid iteration on UI development with concrete, actionable feedback.