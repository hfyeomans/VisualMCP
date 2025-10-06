# Sub-Phase 3.5: Feature Flag Evaluation

## Executive Summary

**RECOMMENDATION: REJECT feature flags - Use target-based selection instead**

The MCP tool interface already provides user-driven selection via `target.type`. Adding configuration-level feature flags would introduce unnecessary complexity without meaningful benefits. The current architecture naturally handles all four stated concerns through existing mechanisms.

---

## Research: Current Architecture Analysis

### How Capture Type Selection Works Today

**MCP Tool Interface** (User-facing):
```json
{
  "target": {
    "type": "url",           // ← User chooses web capture
    "url": "https://example.com"
  }
}

{
  "target": {
    "type": "region",        // ← User chooses desktop capture
    "x": 100, "y": 100,
    "width": 800, "height": 600
  }
}
```

**Key Insight**: **Selection happens at invocation time, not configuration time.**

### Current Production State

**From `src/core/factories.ts:38-39`**:
```typescript
container.registerSingleton<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE, () => {
  return new ScreenshotEngine(browserManager, fileManager, imageProcessor);
  // ← Note: No nativeCaptureManager parameter (Phase 6.4 will add this)
});
```

**Current Behavior**:
- **Web captures** (`type: 'url'`): ✅ Fully functional (BrowserManager)
- **Desktop captures** (`type: 'region'`): ❌ Throws `NATIVE_CAPTURE_UNAVAILABLE`

**Phase 6.4 will add**:
```typescript
const nativeManager = createNativeCaptureManager(); // Platform-aware factory
return new ScreenshotEngine(browserManager, fileManager, imageProcessor, nativeManager);
```

---

## Analysis of Four Stated Concerns

### 1. Security: Disable Desktop Capture in Restricted Environments

**Concern**: Administrators may want to prevent desktop capture for security/privacy.

**Current Architecture Handles This**:
- ✅ Platform-specific managers already implement security boundaries
- ✅ macOS requires Screen Recording permission (OS-level security)
- ✅ Errors are clear and actionable when unavailable

**With Feature Flags**:
```typescript
// config.ts
nativeCapture: {
  enabled: false // ← Admin disables
}

// factories.ts
const nativeManager = config.nativeCapture.enabled
  ? createNativeCaptureManager()
  : null;
```

**Alternative (Better)**:
```typescript
// Add simple security check in handler
if (target.type === 'region' && !isDesktopCaptureAllowed()) {
  throw new ScreenshotError('Desktop capture disabled by administrator', 'DISABLED_BY_POLICY');
}
```

**Recommendation**:
- **DON'T** add feature flags
- **DO** add simple policy check if needed (one function, clear intent)
- **Benefit**: More explicit, easier to understand, no configuration complexity

---

### 2. Performance: Reduce Resources by Disabling Unused Features

**Concern**: Keeping both capture types enabled might waste resources.

**Analysis - Resource Usage**:

| Component | Creation Cost | Runtime Cost (Idle) | Runtime Cost (Active) |
|-----------|---------------|---------------------|----------------------|
| **BrowserManager** | Lazy (browser spawned on first use) | ~0 MB (no browser until needed) | ~100-200 MB (Chromium) |
| **NativeCaptureManager** | Instant (just class instance) | ~0 MB (no process until called) | Depends on Swift helper |

**Key Finding**: **Near-zero cost when idle.**

**Current Architecture**:
- BrowserManager: Already lazy-initialized (browser spawns on first `createPage()`)
- NativeCaptureManager: Just a class wrapper, no resources until `captureRegion()` called
- Swift helper: Only spawned when capture actually happens (Phase 6.3+)

**With Feature Flags**:
```typescript
if (config.capture.web.enabled) {
  // Create BrowserManager
}
if (config.capture.native.enabled) {
  // Create NativeCaptureManager
}
```

**Savings**: ~0 bytes of memory, 0 CPU cycles
**Complexity Added**: Configuration, conditional creation, error paths

**Recommendation**:
- **DON'T** add feature flags for performance
- **Existing lazy initialization** already provides optimal resource usage
- **No measurable benefit**, only added complexity

---

### 3. Testing: Isolate Capture Types During Development

**Concern**: Developers want to test web vs desktop captures independently.

**Current Architecture Handles This**:

```typescript
// Test only web capture
await engine.takeScreenshot({ type: 'url', url: 'https://example.com' });

// Test only desktop capture (with mock manager)
const mockNative = { ... };
const engine = new ScreenshotEngine(browser, file, image, mockNative);
await engine.takeScreenshot({ type: 'region', x: 0, y: 0, width: 100, height: 100 });
```

**With Feature Flags**:
```typescript
// Need to toggle config in tests
config.capture.web.enabled = false;
config.capture.native.enabled = true;
// ... run tests
```

**Analysis**:
- Current: Tests explicitly call the type they want to test
- Current: Mock injection already provides perfect isolation
- Flags: Would require config manipulation in tests (more boilerplate)
- Flags: Could accidentally affect unrelated tests (global state)

**Recommendation**:
- **DON'T** add feature flags for testing
- **Target type selection + mocks** already provide perfect isolation
- **Cleaner tests**: Just specify the target type you want to test

---

### 4. Platform: Auto-Disable Unavailable Features

**Concern**: Native capture should auto-disable on Windows/Linux.

**Current Architecture Already Does This**:

```typescript
// factories.ts (Phase 6.4)
const nativeManager = createNativeCaptureManager();
// ↓ Factory function handles platform detection
// macOS → MacOSCaptureManager
// Others → UnsupportedPlatformCaptureManager (throws helpful errors)

// When user calls with type: 'region' on Windows:
await nativeManager.isAvailable(); // → false
await nativeManager.captureRegion(...);
// → Throws: "Not supported on windows. Use URL-based screenshots."
```

**With Feature Flags**:
```typescript
// config.ts
platform: process.platform === 'darwin' ? 'macos' : 'none',
enabled: process.platform === 'darwin'

// factories.ts
const nativeManager = config.nativeCapture.enabled
  ? createNativeCaptureManager()
  : null;
```

**Analysis**:
- Current: Platform detection happens in factory function (one place)
- Current: Errors are descriptive and actionable
- Flags: Duplicate logic (config AND factory both check platform)
- Flags: More places to maintain platform detection

**Recommendation**:
- **DON'T** add feature flags for platform detection
- **Factory pattern** already handles platform awareness perfectly
- **Keep logic in one place** (DRY principle)

---

## Alternative Architectures Evaluated

### Option A: Configuration-Level Feature Flags (REJECTED)

```typescript
// config.ts
export interface Config {
  capture: {
    web: {
      enabled: boolean;
    };
    native: {
      enabled: boolean;
      helperPath?: string;
    };
  };
}

// factories.ts
const nativeManager = config.capture.native.enabled
  ? createNativeCaptureManager()
  : null;

// Complexity added:
// - Configuration structure
// - Conditional creation logic
// - Error handling for disabled features
// - Documentation of flag behavior
// - Migration for existing configs
```

**Problems**:
1. ❌ Duplicates platform detection (config + factory)
2. ❌ No performance benefit (managers are lightweight)
3. ❌ Harder testing (config manipulation)
4. ❌ More error paths to maintain
5. ❌ User confusion (disabled vs unavailable)

**Benefits**:
1. ✅ Explicit admin policy enforcement
2. ✅ Could disable at server startup

**Verdict**: Costs outweigh benefits

---

### Option B: MCP Tool Capabilities Filtering (REJECTED)

```typescript
// Hide 'region' target type from tool schema if native capture unavailable
tools: [
  {
    name: 'take_screenshot',
    inputSchema: {
      properties: {
        target: {
          oneOf: [
            { type: 'url', ... },
            ...(nativeManager?.isAvailable() ? [{ type: 'region', ... }] : [])
          ]
        }
      }
    }
  }
]
```

**Problems**:
1. ❌ Dynamic schema generation complexity
2. ❌ Hides capabilities instead of explaining them
3. ❌ Poor UX: feature disappears without explanation
4. ❌ Can't show helpful "not available on your platform" message

**Benefits**:
1. ✅ Clean schema (only shows what works)

**Verdict**: Hides capabilities instead of explaining limitations

---

### Option C: Keep Current Architecture (RECOMMENDED)

**How It Works**:
1. User calls `take_screenshot` with `target.type = 'url'` OR `'region'`
2. ScreenshotEngine routes based on type
3. If native manager missing or unavailable: clear error message
4. No configuration needed, no feature flags

**Example User Flows**:

```
User on macOS (Phase 6.4+):
→ Calls with type: 'region'
→ Works! (ScreenCaptureKit)

User on Windows:
→ Calls with type: 'region'
→ Error: "Not supported on windows. Use type: 'url' instead."

User on macOS without permission:
→ Calls with type: 'region'
→ Error: "Screen Recording permission required. Open System Settings..."
```

**Benefits**:
1. ✅ Simple mental model: choose target type, get result or helpful error
2. ✅ No configuration complexity
3. ✅ Self-documenting (target type names are clear)
4. ✅ Platform awareness built-in (factory pattern)
5. ✅ Lazy initialization (zero cost until used)
6. ✅ Easy testing (just specify target type)
7. ✅ Follows MCP philosophy: expose capabilities, let context/user choose

**Costs**:
1. Small: Native manager instance created even on Windows (but it's ~1KB)

**Verdict**: Best balance of simplicity and functionality

---

## Deep Dive: MCP Philosophy

### How MCP Tools Should Work

**MCP Server Model**: Expose capabilities, let client/user choose

Example from MCP SDK:
- File system servers expose `read_file`, `write_file`, `list_directory`
- They don't have "enable read" or "enable write" flags
- They just return errors if operations aren't allowed

**Visual MCP Should Follow Same Pattern**:
- Expose `take_screenshot` with target types: `url` and `region`
- Return clear errors if target type isn't available
- No need to hide capabilities via configuration

### Comparison: Existing MCP Servers

**Filesystem MCP**:
```typescript
// No flags for "enable read" or "enable write"
// Just expose tools and check permissions at runtime
{
  name: 'read_file',
  // Works or returns permission error
}
```

**Brave Search MCP**:
```typescript
// No "enable web search" flag
// Just works or errors if API key missing
{
  name: 'brave_search'
}
```

**Our Pattern Should Be**:
```typescript
// No "enable desktop capture" flag
// Just works or errors if platform unsupported
{
  name: 'take_screenshot',
  target: { type: 'region' or 'url' }
}
```

---

## Recommendation Analysis

### Evaluation Matrix

| Criterion | Feature Flags | Current Architecture | Winner |
|-----------|--------------|---------------------|--------|
| **Simplicity** | ⭐⭐ (Config + conditionals) | ⭐⭐⭐⭐⭐ (Just works) | Current |
| **Security** | ⭐⭐⭐⭐ (Admin can disable) | ⭐⭐⭐ (Runtime checks possible) | Flags (slight edge) |
| **Performance** | ⭐⭐⭐ (Skip creation) | ⭐⭐⭐⭐⭐ (Lazy init) | Current |
| **Testing** | ⭐⭐ (Config manipulation) | ⭐⭐⭐⭐⭐ (Target selection) | Current |
| **Platform Awareness** | ⭐⭐ (Duplicate logic) | ⭐⭐⭐⭐⭐ (Factory pattern) | Current |
| **User Experience** | ⭐⭐⭐ (Config confusion) | ⭐⭐⭐⭐⭐ (Just use target type) | Current |
| **Maintainability** | ⭐⭐ (More code paths) | ⭐⭐⭐⭐⭐ (Single path) | Current |
| **MCP Philosophy** | ⭐⭐ (Hides capabilities) | ⭐⭐⭐⭐⭐ (Exposes + errors) | Current |

**Overall Score**: Feature Flags 19/40 | Current Architecture 37/40

---

## Decision: REJECT Feature Flags

### Primary Recommendation

**DO NOT implement feature flags for browser vs native capture.**

### Rationale

1. **Target Type Already Provides Selection**
   - Users explicitly choose via `target.type`
   - No ambiguity, no configuration needed
   - Self-documenting and clear

2. **Platform Detection Already Exists**
   - Factory function handles platform awareness
   - Error messages are helpful and actionable
   - No duplicate logic needed

3. **Performance Cost is Zero**
   - Managers are lightweight (just classes)
   - Resources only consumed when actually capturing
   - Lazy initialization already optimal

4. **Testing is Already Isolated**
   - Tests specify target type they want to test
   - Mock injection provides perfect isolation
   - No global configuration state to manage

5. **MCP Philosophy Alignment**
   - MCP servers expose capabilities, don't hide them
   - Errors at runtime are better than missing capabilities
   - User-driven selection > admin-driven configuration

### If Security is Required

**Better Alternative to Feature Flags**:

```typescript
// Simple, explicit security check
export function isDesktopCaptureAllowed(): boolean {
  // Check environment variable or policy file
  return process.env.ALLOW_DESKTOP_CAPTURE !== 'false';
}

// In ScreenshotEngine.takeRegionScreenshot():
if (!isDesktopCaptureAllowed()) {
  throw new ScreenshotError(
    'Desktop capture disabled by administrator policy',
    'DISABLED_BY_POLICY'
  );
}
```

**Benefits over feature flags**:
- ✅ More explicit (policy check vs feature flag)
- ✅ Simpler (one function vs config structure)
- ✅ Clearer errors ("disabled by policy" vs "feature not enabled")
- ✅ Easy to audit (one check point)

---

## Implementation Guidance for Phase 6.4

### What TO Do

**1. Wire Native Manager in Production** (Required):
```typescript
// src/core/factories.ts
container.registerSingleton<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE, () => {
  const nativeManager = createNativeCaptureManager(); // ← Add this
  return new ScreenshotEngine(browserManager, fileManager, imageProcessor, nativeManager);
});
```

**2. Document Target Type Selection** (User Documentation):
```markdown
# Taking Screenshots

## Web Page Capture
```json
{
  "target": { "type": "url", "url": "https://example.com" }
}
```

## Desktop Region Capture (macOS only)
```json
{
  "target": { "type": "region", "x": 0, "y": 0, "width": 800, "height": 600 }
}
```
```

**3. Clear Error Messages** (Already implemented):
- ✅ "Not supported on windows" (platform check)
- ✅ "Native capture unavailable" (manager missing)
- ✅ "Screen Recording permission required" (when Swift helper implements)

### What NOT To Do

**❌ DON'T Add These**:
```typescript
// ❌ Don't add feature flag config
config.capture.web.enabled
config.capture.native.enabled

// ❌ Don't add conditional manager creation
if (config.enabled) { ... }

// ❌ Don't hide capabilities from schema
oneOf: [...(enabled ? [regionType] : [])]
```

**Why**: Complexity without benefit, violates MCP philosophy

---

## Edge Cases Considered

### "What if Swift helper is slow to spawn?"

**Not a feature flag issue** - This is a performance optimization:
- Could keep helper process alive (Phase 6.3 design decision)
- Could add helper pooling if needed
- Feature flags don't help here

### "What if we add Windows support later?"

**Current architecture already handles it**:
```typescript
// Factory pattern scales naturally
export function createNativeCaptureManager(): INativeCaptureManager {
  const platform = os.platform();

  if (platform === 'darwin') return new MacOSCaptureManager();
  if (platform === 'win32') return new WindowsCaptureManager(); // ← Add when ready
  if (platform === 'linux') return new LinuxCaptureManager(); // ← Add when ready

  return new UnsupportedPlatformCaptureManager();
}
```

No feature flags needed - just add new manager class.

### "What if enterprise wants to disable desktop capture company-wide?"

**Use environment variables** (simpler than feature flags):
```bash
# docker-compose.yml or .env
ALLOW_DESKTOP_CAPTURE=false
```

```typescript
// One check in handler
if (process.env.ALLOW_DESKTOP_CAPTURE === 'false') {
  throw new ScreenshotError('Desktop capture disabled by organization policy', 'POLICY_DISABLED');
}
```

Benefits:
- ✅ Standard deployment pattern (env vars)
- ✅ No code changes to config system
- ✅ Can override per environment
- ✅ Clear audit trail (env var logs)

---

## Comparison with Industry Patterns

### Puppeteer (Similar Tool)
- No "enable browser mode" flag
- Just works or errors if browser unavailable
- **Our pattern**: Same approach

### FFmpeg
- No "enable image output" vs "enable video output" flags
- Output format specified in command
- **Our pattern**: Same approach (target type in call)

### Docker
- No "enable container" vs "enable image" flags
- Command specifies what you want (`docker run` vs `docker build`)
- **Our pattern**: Same approach (target type in call)

**Conclusion**: Industry standard is **capability-based invocation**, not configuration flags

---

## Final Recommendation

### REJECT Feature Flags

**Primary Reasons**:
1. User already selects capture type via `target.type` (no configuration needed)
2. Zero performance benefit (lazy initialization already optimal)
3. Testing already isolated (target type + mocks)
4. Platform awareness built-in (factory pattern)
5. Violates MCP philosophy (expose capabilities, don't hide them)
6. Adds complexity without corresponding value

### Alternative Solutions (If Needed)

**For Security/Policy Enforcement**:
- Use environment variable check (simpler than feature flags)
- One function: `isDesktopCaptureAllowed()`
- Clear error: "Disabled by administrator policy"

**For Platform Availability**:
- Already handled by factory pattern
- `createNativeCaptureManager()` returns appropriate manager
- Helpful error messages guide users to alternatives

**For Testing Isolation**:
- Already perfect: specify target type in test
- Mock injection for unit tests
- No configuration manipulation needed

### Implementation Plan

**Phase 6.4 (Next)**:
1. Wire `createNativeCaptureManager()` into production factory
2. Document target type selection in user docs
3. **DO NOT** add feature flag configuration
4. **DO NOT** add conditional manager creation based on flags

**If Security Becomes a Requirement** (Future):
1. Add environment variable check: `ALLOW_DESKTOP_CAPTURE`
2. Add simple policy check function
3. Update error messages to indicate policy restriction
4. Document in deployment guide

---

## Decision Matrix

| Approach | Complexity | Flexibility | Performance | Security | Verdict |
|----------|-----------|-------------|-------------|----------|---------|
| **Feature Flags** | 🔴 High | 🟡 Medium | 🟢 None | 🟢 Good | ❌ REJECT |
| **Current (Target Type)** | 🟢 Low | 🟢 High | 🟢 Optimal | 🟡 Fair | ✅ **RECOMMEND** |
| **Env Var Policy Check** | 🟢 Low | 🟢 High | 🟢 Optimal | 🟢 Good | ✅ Use if needed |

---

## Conclusion

Feature flags would add complexity without solving any problems the current architecture doesn't already handle. The target-based selection pattern is:

- ✅ Simpler (no configuration)
- ✅ More flexible (user chooses per call)
- ✅ Better UX (explicit choice, helpful errors)
- ✅ Easier to test (no config state)
- ✅ Follows MCP patterns (expose, don't hide)
- ✅ Already handles all four stated concerns

**Recommendation**: Proceed with Phase 6.4 (Swift implementation) without adding feature flags.

If security requirements emerge, use environment variable policy checks instead of feature flags.

---

## Action Items

1. ✅ Mark Sub-Phase 3.5 as COMPLETE (decision: reject feature flags)
2. ➡️ Proceed with Phase 6.4: Swift ScreenCaptureKit implementation
3. ➡️ Wire `createNativeCaptureManager()` into production factory
4. ➡️ Document target type selection for users
5. 🔮 Future: Add env var policy check if enterprise security needed
