# Visual MCP Server

A Model Context Protocol (MCP) server that provides visual feedback capabilities for UI development. Take screenshots, compare against reference designs, and get actionable feedback to help coding agents iterate faster on UI implementations.

## What is Visual MCP?

Visual MCP bridges the gap between what coding agents build and the visual outcomes you expect. It enables AI assistants to:

- Capture screenshots of web pages and desktop regions
- Compare implementations against design mockups
- Detect and analyze visual differences
- Generate actionable CSS and layout fixes
- Monitor applications for visual regressions in real-time

**Perfect for:** UI development iteration, design QA validation, regression testing, A/B testing, and monitoring live applications.

## Features at a Glance

| Feature | Description | Platforms |
|---------|-------------|-----------|
| **Web Screenshots** | Capture any URL with custom viewports and full-page support | All |
| **Native Desktop Capture** | Capture specific screen regions without browser overhead | macOS 15+ |
| **Visual Comparison** | Pixel-perfect diff detection with ignore regions | All |
| **AI Feedback** | Generate actionable CSS fixes from visual differences | All |
| **Real-time Monitoring** | Auto-detect changes and get instant feedback | All |
| **Multiple Formats** | PNG (lossless) and JPEG (optimized) with quality control | All |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Visual MCP Server                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │   MCP       │──────│  Screenshot  │──────│  Puppeteer │ │
│  │  Protocol   │      │    Engine    │      │  (Web)     │ │
│  │   Layer     │      │              │      └────────────┘ │
│  └─────────────┘      │              │      ┌────────────┐ │
│        │              │              │──────│  ScreenKit │ │
│        │              └──────────────┘      │  (macOS)   │ │
│        ▼                                    └────────────┘ │
│  ┌─────────────┐      ┌──────────────┐                     │
│  │   Tool      │──────│  Comparison  │                     │
│  │  Handlers   │      │    Engine    │──────Pixelmatch    │
│  └─────────────┘      └──────────────┘                     │
│        │                                                    │
│        │              ┌──────────────┐                     │
│        │──────────────│  Monitoring  │──────Auto-Feedback │
│        │              │    System    │                     │
│        │              └──────────────┘                     │
│        ▼                                                    │
│  ┌─────────────┐      ┌──────────────┐                     │
│  │   Claude    │──────│  AI Feedback │──────Claude API    │
│  │    Code     │      │   Analyzer   │                     │
│  └─────────────┘      └──────────────┘                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Flow:**
1. AI agent calls MCP tool (take_screenshot, compare_visuals, etc.)
2. Screenshot engine captures target (web or desktop)
3. Comparison engine generates pixel diff visualization
4. AI analyzer produces actionable feedback
5. Agent receives structured results to iterate on implementation

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Global Installation (Recommended)

Install Visual MCP globally to use from any project directory:

```bash
npm install -g @visualmcp/visual-mcp-server
```

**Configure in** `~/.claude.json` (user-level):

```json
{
  "mcpServers": {
    "visual-mcp": {
      "command": "visual-mcp"
    }
  }
}
```

**Output directories:** Screenshots/comparisons are created in your current working directory by default. For a consistent location:

```json
{
  "mcpServers": {
    "visual-mcp": {
      "command": "visual-mcp",
      "env": {
        "VISUAL_MCP_OUTPUT_DIR": "$HOME/.visual-mcp/screenshots",
        "VISUAL_MCP_COMPARISONS_DIR": "$HOME/.visual-mcp/comparisons"
      }
    }
  }
}
```

### Using with npx (No Install Required)

Run Visual MCP without installing:

```json
{
  "mcpServers": {
    "visual-mcp": {
      "command": "npx",
      "args": ["-y", "@visualmcp/visual-mcp-server"]
    }
  }
}
```

**Note:** npx downloads on first run (slight delay), then caches locally.

### Local Development Install

For development or testing from source:

```bash
# Clone the repository
git clone https://github.com/hfyeomans/VisualMCP.git
cd VisualMCP

# Install dependencies
npm install

# Build the project
npm run build

# Validate installation
npm run validate
```

The validation script checks prerequisites and provides exact MCP configuration for your system.

### Native Desktop Capture (Optional)

For capturing desktop regions on **macOS 15+ (Sequoia)**:

1. Bundled Swift helper binary included (no build required)
2. Grant Screen Recording permission when prompted
3. See [Native Capture Guide](docs/NATIVE_CAPTURE.md) for details

**Note:** Native capture requires macOS 15+. Web-based capture works on all platforms.

## MCP Integration

### Recommended: Global Install

For most users, global installation is simplest:

```json
{
  "mcpServers": {
    "visual-mcp": {
      "command": "visual-mcp"
    }
  }
}
```

### Alternative: Local Development

If you're developing Visual MCP or need a specific version:

```json
{
  "mcpServers": {
    "visual-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/VisualMCP"
    }
  }
}
```

### LMStudio

Configure in MCP server settings:

```json
{
  "name": "visual-mcp",
  "transport": {
    "type": "stdio",
    "command": "node",
    "args": ["dist/index.js"],
    "cwd": "/absolute/path/to/VisualMCP"
  }
}
```

### Other MCP Clients

Visual MCP follows the [Model Context Protocol](https://modelcontextprotocol.io) standard. Configure stdio transport with the command above.

## Configuration

Visual MCP ships with sensible defaults. Override via environment variables or `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `VISUAL_MCP_OUTPUT_DIR` | Screenshot output directory | `./screenshots` |
| `VISUAL_MCP_COMPARISONS_DIR` | Diff image directory | `./comparisons` |
| `VISUAL_MCP_TEMP_DIR` | Temporary working directory | `./temp` |
| `VISUAL_MCP_SCREENSHOT_FORMAT` | Default format (`png`/`jpeg`) | `png` |
| `VISUAL_MCP_SCREENSHOT_TIMEOUT` | Navigation timeout (ms) | `30000` |
| `VISUAL_MCP_TOLERANCE` | Comparison tolerance (0-100%) | `5` |
| `VISUAL_MCP_MONITOR_INTERVAL` | Monitoring interval (seconds) | `5` |
| `VISUAL_MCP_LOG_LEVEL` | Log level (`debug`/`info`/`warn`/`error`) | `info` |

**Example `.env`:**
```bash
VISUAL_MCP_OUTPUT_DIR=/Users/me/screenshots
VISUAL_MCP_TOLERANCE=3
VISUAL_MCP_LOG_LEVEL=debug
```

## MCP Tools Reference

### 1. take_screenshot

Capture screenshots of web pages or desktop regions.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | object | Yes | Screenshot target (URL or region) |
| `options` | object | No | Screenshot options (format, quality, etc.) |

**Target Types:**

**URL Target** (Web pages):
```typescript
{
  type: 'url',
  url: string,              // Full URL to capture
  viewport?: {              // Optional custom viewport
    width: number,          // Viewport width in pixels
    height: number          // Viewport height in pixels
  }
}
```

**Region Target** (Desktop capture - macOS 15+ only):
```typescript
{
  type: 'region',
  x: number,                // X coordinate from left
  y: number,                // Y coordinate from top
  width: number,            // Region width in pixels
  height: number            // Region height in pixels
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'png'` \| `'jpeg'` | `'png'` | Image format |
| `quality` | number (1-100) | `90` | JPEG quality (PNG ignores) |
| `filename` | string | auto-generated | Custom filename |
| `fullPage` | boolean | `false` | Capture entire page (URL only) |

**Returns:**
```typescript
{
  filepath: string,         // Absolute path to screenshot
  width: number,           // Image width in pixels
  height: number,          // Image height in pixels
  format: 'png' | 'jpeg',  // Image format
  size: number,            // File size in bytes
  timestamp: string,       // ISO timestamp
  target: object           // Original target specification
}
```

**Examples:**

```typescript
// Web page screenshot
{
  "target": {
    "type": "url",
    "url": "https://example.com",
    "viewport": { "width": 1920, "height": 1080 }
  },
  "options": {
    "format": "png",
    "fullPage": true
  }
}

// Desktop region (macOS 15+)
{
  "target": {
    "type": "region",
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  },
  "options": {
    "format": "jpeg",
    "quality": 85
  }
}
```

**Use Cases:**
- Capture current implementation state
- Screenshot reference designs
- Monitor application UI
- Create visual test baselines
- Document UI bugs

---

### 2. compare_visuals

Compare two images and detect visual differences with pixel-perfect accuracy.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `currentImage` | string | Yes | Path to current screenshot |
| `referenceImage` | string | Yes | Path to reference/baseline image |
| `options` | object | No | Comparison configuration |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tolerance` | number (0-100) | `5` | Acceptable difference % (above = mismatch) |
| `threshold` | number (0-1) | `0.1` | Pixel difference sensitivity |
| `ignoreRegions` | array | `[]` | Regions to exclude from comparison |

**Ignore Regions Format:**
```typescript
{
  x: number,      // Region X coordinate
  y: number,      // Region Y coordinate
  width: number,  // Region width
  height: number  // Region height
}
```

**Returns:**
```typescript
{
  differencePercentage: number,    // Total difference (0-100%)
  pixelsDifferent: number,         // Number of pixels changed
  totalPixels: number,             // Total pixels compared
  diffImagePath: string,           // Path to diff visualization
  isMatch: boolean,                // Within tolerance threshold
  regions: [                       // Detected difference regions
    {
      x: number,
      y: number,
      width: number,
      height: number,
      severity: 'low' | 'medium' | 'high'
    }
  ]
}
```

**Examples:**

```typescript
// Basic comparison
{
  "currentImage": "/screenshots/current.png",
  "referenceImage": "/designs/expected.png"
}

// With ignore regions (e.g., timestamps, dynamic content)
{
  "currentImage": "/screenshots/current.png",
  "referenceImage": "/designs/expected.png",
  "options": {
    "tolerance": 3,
    "ignoreRegions": [
      { "x": 10, "y": 10, "width": 200, "height": 50 },  // Ignore header timestamp
      { "x": 0, "y": 900, "width": 1920, "height": 80 }  // Ignore footer
    ]
  }
}

// Strict comparison
{
  "currentImage": "/screenshots/current.png",
  "referenceImage": "/designs/expected.png",
  "options": {
    "tolerance": 0.5,
    "threshold": 0.05
  }
}
```

**Use Cases:**
- Validate implementation against designs
- Detect visual regressions
- Compare before/after changes
- A/B testing visual differences
- QA design accuracy

**Related Tools:** `analyze_ui_feedback` (analyze the diff image)

---

### 3. analyze_ui_feedback

Generate actionable feedback from visual differences using AI analysis.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `diffImagePath` | string | Yes | Path to diff visualization (from compare_visuals) |
| `options` | object | No | Analysis configuration |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `priority` | string[] | all areas | Focus areas to analyze |
| `context` | string | - | Additional context about intended design |
| `suggestionsType` | string | `'both'` | Type of suggestions to generate |

**Priority Areas:**
- `'layout'` - Positioning, alignment, spacing
- `'colors'` - Color accuracy, contrast
- `'typography'` - Font sizing, weights, line heights
- `'spacing'` - Margins, padding, gaps
- `'content'` - Text content, images

**Suggestion Types:**
- `'css'` - CSS code snippets
- `'general'` - General guidance
- `'both'` - CSS + general (default)

**Returns:**
```typescript
{
  summary: string,              // Overall analysis summary
  issues: [                     // Detected issues
    {
      type: string,             // Issue category (layout, colors, etc.)
      severity: 'low' | 'medium' | 'high',
      description: string,      // What's wrong
      location: {               // Where the issue is
        x: number,
        y: number,
        width: number,
        height: number
      }
    }
  ],
  suggestions: [                // Actionable fixes
    {
      type: 'css' | 'general',
      title: string,            // Fix title
      description: string,      // Why this fix helps
      code?: string,            // CSS code (if type: 'css')
      priority: number          // Fix priority (1 = highest)
    }
  ],
  confidence: number            // Analysis confidence (0-100)
}
```

**Examples:**

```typescript
// Basic feedback
{
  "diffImagePath": "/comparisons/diff_12345.png"
}

// Focused analysis
{
  "diffImagePath": "/comparisons/diff_12345.png",
  "options": {
    "priority": ["layout", "spacing"],
    "context": "Button should be centered with 20px padding",
    "suggestionsType": "css"
  }
}

// General guidance only
{
  "diffImagePath": "/comparisons/diff_12345.png",
  "options": {
    "suggestionsType": "general",
    "context": "Landing page hero section"
  }
}
```

**Use Cases:**
- Get CSS fixes for visual bugs
- Understand what changed
- Prioritize visual improvements
- Generate implementation tasks
- Learn from visual differences

**Related Tools:** `compare_visuals` (generates the diff image to analyze)

---

### 4. start_monitoring

Begin continuous monitoring of a target with automatic change detection.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | object | Yes | Target to monitor (same as take_screenshot) |
| `referenceImage` | string | Yes | Baseline image for comparison |
| `interval` | number | No | Screenshot interval in seconds (1-300) |
| `autoFeedback` | boolean | No | Auto-generate feedback on changes |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interval` | number (1-300) | `5` | Seconds between captures |
| `autoFeedback` | boolean | `true` | Generate AI feedback automatically |

**Returns:**
```typescript
{
  sessionId: string,           // Monitoring session ID
  target: object,              // Target being monitored
  referenceImage: string,      // Baseline image path
  interval: number,            // Capture interval
  startedAt: string            // ISO timestamp
}
```

**Monitoring Behavior:**
- Captures screenshots at specified interval
- Compares each capture to baseline
- Detects when differences exceed tolerance
- Optionally generates AI feedback on changes
- Stores monitoring history in session directory

**Session Directory Structure:**
```
monitoring/{sessionId}/
  ├── session.json          # Session metadata
  ├── baseline.png          # Reference baseline
  └── captures/
      ├── capture_001.png   # Each capture
      ├── capture_002.png
      ├── diff_001.png      # Diff visualizations
      └── feedback_001.json # AI feedback (if enabled)
```

**Examples:**

```typescript
// Monitor localhost development
{
  "target": {
    "type": "url",
    "url": "http://localhost:3000"
  },
  "referenceImage": "/designs/final-design.png",
  "interval": 5,
  "autoFeedback": true
}

// Monitor desktop region
{
  "target": {
    "type": "region",
    "x": 100,
    "y": 100,
    "width": 1280,
    "height": 720
  },
  "referenceImage": "/baselines/window.png",
  "interval": 10,
  "autoFeedback": false
}

// Fast monitoring (1 second)
{
  "target": { "type": "url", "url": "http://localhost:8080" },
  "referenceImage": "/baseline.png",
  "interval": 1
}
```

**Use Cases:**
- Live development feedback
- Regression detection during coding
- Monitor production deployments
- Track visual changes over time
- Automated visual testing

**Related Tools:** `stop_monitoring` (stop session and get summary)

---

### 5. stop_monitoring

Stop a monitoring session and retrieve summary.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Monitoring session ID to stop |

**Returns:**
```typescript
{
  sessionId: string,           // Session ID
  target: object,              // Target that was monitored
  duration: number,            // Total monitoring duration (seconds)
  captureCount: number,        // Total captures taken
  changesDetected: number,     // Number of times changes exceeded tolerance
  finalStatus: string,         // 'matched' | 'different' | 'error'
  sessionDirectory: string,    // Path to session data
  captures: [                  // All captures taken
    {
      timestamp: string,
      filepath: string,
      differencePercentage: number
    }
  ],
  significantChanges: [        // Changes that exceeded tolerance
    {
      timestamp: string,
      differencePercentage: number,
      diffImagePath: string,
      feedback?: object        // AI feedback (if enabled)
    }
  ]
}
```

**Examples:**

```typescript
// Stop monitoring session
{
  "sessionId": "monitor_abc123"
}
```

**Use Cases:**
- End monitoring session
- Get monitoring report
- Analyze captured changes
- Review feedback history
- Archive monitoring data

**Related Tools:** `start_monitoring` (start a session)

---

## Common Workflows

### Workflow 1: UI Development Iteration

**Scenario:** Building a component against a design mockup

```typescript
// 1. Capture current implementation
const screenshot = await take_screenshot({
  target: { type: 'url', url: 'http://localhost:3000' },
  options: { filename: 'current.png' }
})

// 2. Compare with design
const comparison = await compare_visuals({
  currentImage: screenshot.filepath,
  referenceImage: '/designs/mockup.png',
  options: { tolerance: 3 }
})

// 3. Get actionable feedback
if (!comparison.isMatch) {
  const feedback = await analyze_ui_feedback({
    diffImagePath: comparison.diffImagePath,
    options: {
      priority: ['layout', 'spacing'],
      suggestionsType: 'css'
    }
  })

  // Apply CSS suggestions and repeat
}
```

**Benefits:**
- Fast iteration cycles
- Pixel-perfect implementation
- Actionable CSS fixes
- Visual proof of progress

---

### Workflow 2: Design QA Validation

**Scenario:** Validate implementation accuracy before deployment

```typescript
// 1. Capture production-ready implementation
const screenshot = await take_screenshot({
  target: {
    type: 'url',
    url: 'https://staging.example.com',
    viewport: { width: 1920, height: 1080 }
  },
  options: { fullPage: true }
})

// 2. Strict comparison with approved design
const comparison = await compare_visuals({
  currentImage: screenshot.filepath,
  referenceImage: '/approved-designs/final.png',
  options: {
    tolerance: 1,  // Strict threshold
    ignoreRegions: [
      { x: 0, y: 0, width: 1920, height: 60 }  // Ignore nav bar
    ]
  }
})

// 3. Generate QA report
if (!comparison.isMatch) {
  const feedback = await analyze_ui_feedback({
    diffImagePath: comparison.diffImagePath,
    options: { suggestionsType: 'general' }
  })
}
```

**Benefits:**
- Catch visual bugs before production
- Maintain design consistency
- Automated QA process
- Document visual accuracy

---

### Workflow 3: Regression Testing

**Scenario:** Detect visual changes after code updates

```typescript
// 1. Take baseline before changes
const baseline = await take_screenshot({
  target: { type: 'url', url: 'http://localhost:3000/dashboard' },
  options: { filename: 'baseline.png', fullPage: true }
})

// 2. ... make code changes ...

// 3. Capture after changes
const after = await take_screenshot({
  target: { type: 'url', url: 'http://localhost:3000/dashboard' },
  options: { filename: 'after-changes.png', fullPage: true }
})

// 4. Detect regressions
const comparison = await compare_visuals({
  currentImage: after.filepath,
  referenceImage: baseline.filepath,
  options: { tolerance: 2 }
})

// 5. Investigate unexpected changes
if (!comparison.isMatch) {
  const feedback = await analyze_ui_feedback({
    diffImagePath: comparison.diffImagePath
  })
}
```

**Benefits:**
- Catch unintended visual changes
- Safe refactoring
- Automated regression detection
- Visual change documentation

---

### Workflow 4: A/B Testing Comparison

**Scenario:** Compare two design variations

```typescript
// 1. Capture variant A
const variantA = await take_screenshot({
  target: { type: 'url', url: 'http://localhost:3000?variant=a' }
})

// 2. Capture variant B
const variantB = await take_screenshot({
  target: { type: 'url', url: 'http://localhost:3000?variant=b' }
})

// 3. Visual difference analysis
const comparison = await compare_visuals({
  currentImage: variantB.filepath,
  referenceImage: variantA.filepath,
  options: { tolerance: 0 }  // Detect all differences
})

// 4. Document differences
const feedback = await analyze_ui_feedback({
  diffImagePath: comparison.diffImagePath,
  options: {
    context: 'Comparing button placement variants',
    suggestionsType: 'general'
  }
})
```

**Benefits:**
- Visual A/B comparison
- Document design decisions
- Measure visual impact
- Test variations

---

### Workflow 5: Live Monitoring

**Scenario:** Monitor application during development

```typescript
// 1. Start monitoring
const session = await start_monitoring({
  target: { type: 'url', url: 'http://localhost:3000' },
  referenceImage: '/designs/final.png',
  interval: 5,
  autoFeedback: true
})

// 2. Develop application...
// Monitor automatically detects changes and provides feedback

// 3. Stop and review
const summary = await stop_monitoring({
  sessionId: session.sessionId
})

console.log(`Captured ${summary.captureCount} screenshots`)
console.log(`Detected ${summary.changesDetected} significant changes`)
```

**Benefits:**
- Real-time visual feedback
- Automated change detection
- Historical capture record
- Development monitoring

---

## Performance Benchmarks

### Capture Performance

| Operation | macOS 15+ Native | Puppeteer (All) | Notes |
|-----------|------------------|-----------------|-------|
| Small Region (800x600) | ~200ms | ~2000ms | Native 10x faster |
| Full HD (1920x1080) | ~300ms | ~2200ms | Native 7x faster |
| 4K (3840x2160) | ~500ms | ~2500ms | Native 5x faster |
| Memory Usage | ~15MB | ~150MB | Native 10x lighter |

### Comparison Performance

| Images | Resolution | Time | Notes |
|--------|------------|------|-------|
| 2 images | 1920x1080 | ~100ms | Pixelmatch |
| 2 images | 3840x2160 | ~300ms | 4K comparison |
| With 5 ignore regions | 1920x1080 | ~120ms | Small overhead |

### Monitoring Performance

| Interval | CPU Usage | Memory | Sustainable |
|----------|-----------|--------|-------------|
| 1 second | 15-20% | ~200MB | Yes (short term) |
| 5 seconds | 5-8% | ~150MB | Yes (recommended) |
| 30 seconds | <2% | ~100MB | Yes (long term) |

**Optimization Tips:**
1. Use JPEG for large captures (smaller files, 2-3x faster I/O)
2. Reduce quality (75-85) for preview captures
3. Capture only needed regions (avoid full screen)
4. Use longer intervals for monitoring (5+ seconds)
5. Native capture on macOS 15+ (10x performance boost)

---

## Platform Compatibility

### Feature Support Matrix

| Feature | macOS 15+ | macOS <15 | Windows | Linux |
|---------|-----------|-----------|---------|-------|
| Web Screenshots | ✅ | ✅ | ✅ | ✅ |
| Desktop Capture | ✅ Native | ❌ | ⏳ Planned | ⏳ Planned |
| Visual Comparison | ✅ | ✅ | ✅ | ✅ |
| AI Feedback | ✅ | ✅ | ✅ | ✅ |
| Monitoring | ✅ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Fully Supported
- ⏳ Planned (roadmap)
- ❌ Not Available

### Platform-Specific Notes

**macOS 15+ (Sequoia):**
- Native desktop capture via ScreenCaptureKit
- Hardware-accelerated encoding
- Requires Screen Recording permission
- 10x faster than web-based capture

**macOS 14 and Earlier:**
- Web-based capture only
- Native capture not available
- All other features work normally

**Windows:**
- Web-based capture fully supported
- Native desktop capture planned (Q2 2025)
- Windows Graphics Capture API research phase

**Linux:**
- Web-based capture fully supported
- Native desktop capture planned (Q3 2025)
- X11 and Wayland support planned

See [Platform Compatibility Guide](docs/PLATFORM_COMPATIBILITY.md) for detailed information.

---

## Limitations & Roadmap

### Current Limitations

**Native Capture:**
- macOS 15+ only (Sequoia)
- Requires Screen Recording permission
- No interactive window picker yet

**Monitoring:**
- Single session per target
- No remote monitoring yet
- Session data stored locally only

**Comparison:**
- Images must be same dimensions
- PNG/JPEG formats only
- No video comparison yet

### Future Roadmap

**Phase 7 - Windows Support (Q2 2025)**
- Native desktop capture for Windows
- Windows Graphics Capture API integration
- Multi-display support

**Phase 8 - Linux Support (Q3 2025)**
- Native capture for X11/Wayland
- Desktop environment integration
- PipeWire screen sharing

**Phase 9 - Interactive Features (Q4 2025)**
- Interactive window picker (all platforms)
- Region selection overlay
- Real-time preview

**Phase 10 - Advanced Features (2026)**
- Video capture and comparison
- Remote monitoring capabilities
- Cloud storage integration
- Collaborative visual testing

---

## Testing

### Run Tests

```bash
# Unit tests
npm test

# Unit tests only (no e2e)
npm run test:unit

# Integration tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Interactive Demo

```bash
# Interactive tool demonstration
npm run demo
```

### CLI Test Harness

```bash
# Smoke test all features
npm run test-runner
```

### Test Application

Local test app for controlled testing:

```bash
cd test-app
npm install
npm run dev
```

Open `http://localhost:5173` for interactive test interface.

---

## Troubleshooting

### Common Issues

**"Puppeteer fails to launch"**

```bash
# macOS/Linux - Install Chrome dependencies
npm install puppeteer --force

# Linux - Install system dependencies
sudo apt-get install -y libx11-xcb1 libxcomposite1 libxcursor1
```

**"Screenshot fails for localhost"**

- Ensure target application is running
- Check firewall settings
- Try `127.0.0.1` instead of `localhost`
- Verify port is correct

**"Image comparison errors"**

- Verify both images exist and are valid PNG/JPEG
- Ensure images are same dimensions
- Check file permissions (readable)
- Try absolute paths

**"MCP server not responding"**

```bash
# Rebuild the server
npm run clean && npm run build

# Check MCP configuration
npm run validate

# Enable debug logging
DEBUG=visual-mcp:* npm start
```

**"Native capture permission denied" (macOS)**

1. Open System Settings > Privacy & Security > Screen Recording
2. Enable permission for your application (Terminal, Node, IDE)
3. Restart application completely
4. See [Permission Guide](docs/SCREEN_RECORDING_PERMISSION.md)

### Debug Mode

Enable detailed logging:

```bash
# Environment variable
export DEBUG=visual-mcp:*
export VISUAL_MCP_LOG_LEVEL=debug

# Or in .env file
DEBUG=visual-mcp:*
VISUAL_MCP_LOG_LEVEL=debug
```

### Getting Help

**Before reporting issues:**

1. Enable debug logging
2. Run validation: `npm run validate`
3. Check platform compatibility
4. Review [documentation](docs/)
5. Search existing issues

**When reporting issues, include:**

- OS and version (`sw_vers` / `systeminfo` / `lsb_release -a`)
- Node version (`node --version`)
- Error messages (full stack trace)
- Debug logs (with `DEBUG=visual-mcp:*`)
- Minimal reproduction case

---

## Documentation

- [Native Desktop Capture Guide](docs/NATIVE_CAPTURE.md) - macOS ScreenCaptureKit usage
- [Screen Recording Permission Setup](docs/SCREEN_RECORDING_PERMISSION.md) - Permission guide
- [Platform Compatibility](docs/PLATFORM_COMPATIBILITY.md) - Feature support by platform

---

## Project Structure

```
VisualMCP/
├── src/
│   ├── index.ts                   # MCP server entry
│   ├── core/                      # Core infrastructure
│   │   ├── config.ts              # Configuration management
│   │   ├── container.ts           # Dependency injection
│   │   ├── logger.ts              # Logging
│   │   └── errors.ts              # Error types
│   ├── handlers/                  # MCP tool handlers
│   │   ├── take-screenshot.ts     # Screenshot handler
│   │   ├── compare-visuals.ts     # Comparison handler
│   │   ├── analyze-feedback.ts    # Feedback handler
│   │   ├── start-monitoring.ts    # Start monitor handler
│   │   └── stop-monitoring.ts     # Stop monitor handler
│   ├── screenshot/                # Screenshot engine
│   │   ├── puppeteer.ts           # Web capture (Puppeteer)
│   │   ├── native-capture.ts      # Desktop capture (ScreenCaptureKit)
│   │   └── monitoring.ts          # Monitoring system
│   ├── comparison/                # Visual analysis
│   │   ├── differ.ts              # Image comparison (Pixelmatch)
│   │   └── analyzer.ts            # AI feedback analyzer
│   ├── interfaces/                # TypeScript interfaces
│   └── types/                     # Type definitions
├── bin/
│   └── screencapture-helper       # Swift helper binary (macOS)
├── docs/                          # Documentation
├── test-app/                      # Test application
├── cli-tools/                     # Testing tools
├── screenshots/                   # Screenshot output
├── comparisons/                   # Diff output
├── monitoring/                    # Monitoring sessions
└── dist/                          # Built JavaScript
```

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for changes
4. Run test suite: `npm test`
5. Submit pull request

**Areas needing help:**
- Windows native capture implementation
- Linux native capture implementation
- Performance optimizations
- Additional test coverage
- Documentation improvements

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built on [Model Context Protocol](https://modelcontextprotocol.io)
- Uses [Puppeteer](https://pptr.dev/) for web automation
- Image processing with [Sharp](https://sharp.pixelplumbing.com/)
- Pixel comparison via [Pixelmatch](https://github.com/mapbox/pixelmatch)
- macOS capture powered by [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)

---

**Visual MCP** - Closing the feedback loop between AI coding agents and visual outcomes.
