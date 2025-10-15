# Visual MCP Server

A Model Context Protocol (MCP) server that provides visual feedback capabilities for UI development. Take screenshots, compare against reference designs, and get actionable feedback to help coding agents iterate faster on UI implementations.

## 🚀 Features

- **Screenshot Capture**: Take screenshots of web pages, windows, or specific regions
- **Native Desktop Capture**: 🖥️ Capture desktop regions on macOS 15+ using ScreenCaptureKit (requires Screen Recording permission)
- **Visual Comparison**: Compare screenshots with reference designs and detect differences
- **Real-time Monitoring**: Monitor applications for visual changes at configurable intervals
- **AI-powered Feedback**: Generate actionable improvement suggestions from visual differences
- **Cross-platform**: Supports macOS, Windows, and Linux
- **MCP Integration**: Works seamlessly with Claude Code, LMStudio, and other MCP clients

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn package manager

#### Native Desktop Capture (Optional)
- macOS 15+ (Sequoia)
- Screen Recording permission
- Bundled Swift helper binary (included)

See [Native Capture Guide](docs/NATIVE_CAPTURE.md) for setup details.

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd VisualMCP

# Install dependencies
npm install

# Build the project
npm run build

# Validate installation (optional)
node validate-mcp.js
```

The validation script checks that all prerequisites are met and provides the exact configuration needed for your system.

## 🛠️ MCP Integration

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcps": {
    "visual-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/Users/hank/dev/src/VisualMCP"
    }
  }
}
```

### LMStudio

Configure the MCP server connection:

```json
{
  "name": "visual-mcp",
  "transport": {
    "type": "stdio",
    "command": "node",
    "args": ["dist/index.js"],
    "cwd": "/Users/hank/dev/src/VisualMCP"
  }
}
```

## ⚙️ Configuration

Visual MCP ships with sensible defaults, but you can override settings via environment variables or a `.env` file. Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Description | Default |
| --- | --- | --- |
| `VISUAL_MCP_OUTPUT_DIR` | Directory for captured screenshots | `./screenshots` |
| `VISUAL_MCP_COMPARISONS_DIR` | Directory for diff images | `./comparisons` |
| `VISUAL_MCP_TEMP_DIR` | Temporary working directory | `./temp` |
| `VISUAL_MCP_SCREENSHOT_FORMAT` | Screenshot format (`png`/`jpeg`) | `png` |
| `VISUAL_MCP_SCREENSHOT_TIMEOUT` | Navigation timeout (ms) | `30000` |
| `VISUAL_MCP_TOLERANCE` | Comparison tolerance percentage | `5` |
| `VISUAL_MCP_MONITOR_INTERVAL` | Monitoring interval (seconds) | `5` |
| `VISUAL_MCP_LOG_LEVEL` | Logger level (`debug`/`info`/`warn`/`error`) | `info` |

Any unset values fall back to defaults; overrides are deep-merged so partial updates (e.g., adjusting `VISUAL_MCP_SCREENSHOT_QUALITY`) do not reset other options.

## 🔧 Available MCP Tools

### 1. take_screenshot

Capture screenshots of web pages, windows, or screen regions.

**Parameters:**
- `target` (object): Screenshot target specification
  - For URLs: `{ type: 'url', url: string, viewport?: { width, height } }`
  - For regions: `{ type: 'region', x: number, y: number, width: number, height: number }`
- `options` (optional): Screenshot configuration
  - `format`: 'png' | 'jpeg' (default: 'png')
  - `quality`: 1-100 (JPEG only)
  - `filename`: Custom filename
  - `fullPage`: boolean (default: false)

**Example:**
```json
{
  "target": {
    "type": "url",
    "url": "https://example.com",
    "viewport": { "width": 1200, "height": 800 }
  },
  "options": {
    "format": "png",
    "filename": "homepage.png"
  }
}
```

### 2. compare_visuals

Compare two images and detect visual differences.

**Parameters:**
- `currentImage` (string): Path to current screenshot
- `referenceImage` (string): Path to reference design
- `options` (optional): Comparison settings
  - `tolerance`: 0-100 (default: 5) - Acceptable difference percentage
  - `threshold`: 0-1 (default: 0.1) - Pixel difference threshold
  - `ignoreRegions`: Array of regions to exclude from comparison

**Example:**
```json
{
  "currentImage": "/path/to/screenshots/current.png",
  "referenceImage": "/path/to/designs/expected.png",
  "options": {
    "tolerance": 3,
    "ignoreRegions": [
      { "x": 0, "y": 0, "width": 100, "height": 50 }
    ]
  }
}
```

### 3. analyze_ui_feedback

Generate actionable feedback for UI improvements based on visual differences.

**Parameters:**
- `diffImagePath` (string): Path to difference visualization image
- `options` (optional): Analysis configuration
  - `priority`: Array of focus areas ('layout', 'colors', 'typography', 'spacing', 'content')
  - `context`: Description of the intended design
  - `suggestionsType`: 'css' | 'general' | 'both' (default: 'both')

**Example:**
```json
{
  "diffImagePath": "/path/to/comparisons/diff_12345.png",
  "options": {
    "priority": ["layout", "colors"],
    "context": "Button alignment and hover states",
    "suggestionsType": "css"
  }
}
```

### 4. start_monitoring

Begin incremental screenshot monitoring of a target.

**Parameters:**
- `target` (object): Target to monitor (same format as take_screenshot)
- `referenceImage` (string): Baseline image for comparison
- `interval` (optional): Screenshot interval in seconds (1-300, default: 5)
- `autoFeedback` (optional): Generate automatic feedback (default: true)

**Example:**
```json
{
  "target": {
    "type": "url", 
    "url": "http://localhost:3000"
  },
  "referenceImage": "/path/to/baseline.png",
  "interval": 10,
  "autoFeedback": true
}
```

### 5. stop_monitoring

Stop a monitoring session and get summary.

**Parameters:**
- `sessionId` (string): ID of monitoring session to stop

## 🧪 Testing

Automated unit/integration suites are being rebuilt as part of the Phase 1 refactor. A ConfigManager unit suite is available (`npm test`) while we restore broader coverage. Use the smoke harnesses below for end-to-end flows.

```bash
# Unit tests
npm test

# CLI smoke harness
node cli-tools/test-runner.js
```

### Interactive Demo

```bash
node cli-tools/demo.js
```

### Test Application

The included test application provides a controlled environment for testing visual changes:

```bash
cd test-app
npm install
npm run dev
```

Open `http://localhost:5173` to interact with the test interface.

## 📁 Project Structure

```
VisualMCP/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── types/                    # TypeScript interfaces
│   ├── screenshot/               # Screenshot capture engine
│   │   ├── puppeteer.ts          # Web screenshot handler  
│   │   └── monitoring.ts         # Monitoring system
│   └── comparison/               # Visual analysis
│       ├── differ.ts             # Image comparison
│       └── analyzer.ts           # AI-powered feedback
├── test-app/                     # Test application
├── cli-tools/                    # Testing and demo tools
├── screenshots/                  # Screenshot output
├── comparisons/                  # Diff image output
└── dist/                        # Built JavaScript
```

## 🎯 Usage Examples

### Desktop Region Capture (macOS 15+)

Capture a specific region of your desktop:

```typescript
const result = await take_screenshot({
  target: {
    type: 'region',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  },
  options: {
    format: 'png',
    filename: 'desktop-capture.png'
  }
})
```

**JPEG with quality:**

```typescript
const result = await take_screenshot({
  target: {
    type: 'region',
    x: 100,
    y: 100,
    width: 800,
    height: 600
  },
  options: {
    format: 'jpeg',
    quality: 85,
    filename: 'window-area.jpg'
  }
})
```

**Note**: Requires macOS 15+ and Screen Recording permission. See [Native Capture Guide](docs/NATIVE_CAPTURE.md) for details.

### Basic Screenshot Workflow

```bash
# 1. Take screenshot of current state
take_screenshot {
  "target": { "type": "url", "url": "http://localhost:3000" },
  "options": { "filename": "current-state.png" }
}

# 2. Compare with reference design
compare_visuals {
  "currentImage": "screenshots/current-state.png",
  "referenceImage": "designs/mockup.png"
}

# 3. Generate improvement feedback
analyze_ui_feedback {
  "diffImagePath": "comparisons/diff_abc123.png",
  "options": { "priority": ["layout", "spacing"] }
}
```

### Monitoring Workflow

```bash
# Start monitoring a development server
start_monitoring {
  "target": { "type": "url", "url": "http://localhost:3000" },
  "referenceImage": "designs/final-design.png",
  "interval": 5
}

# Make changes to your application...
# Monitor automatically detects changes

# Stop monitoring and get summary
stop_monitoring {
  "sessionId": "monitor_abc123"
}
```

## 🔍 Output Examples

### Screenshot Result
```json
{
  "filepath": "/path/to/screenshots/example.png",
  "width": 1200,
  "height": 800,
  "format": "png",
  "size": 245760,
  "timestamp": "2025-01-09T10:30:00.000Z",
  "target": { "type": "url", "url": "https://example.com" }
}
```

### Comparison Result
```json
{
  "differencePercentage": 3.42,
  "pixelsDifferent": 32768,
  "totalPixels": 960000,
  "diffImagePath": "/path/to/comparisons/diff_12345.png",
  "isMatch": true,
  "regions": [
    {
      "x": 150, "y": 200, "width": 300, "height": 100,
      "severity": "medium"
    }
  ]
}
```

### Feedback Result
```json
{
  "summary": "Analysis detected 2 visual differences. 1 high priority issue should be addressed.",
  "issues": [
    {
      "type": "layout",
      "severity": "high", 
      "description": "Large layout change detected (300x100 pixels)",
      "location": { "x": 150, "y": 200, "width": 300, "height": 100 }
    }
  ],
  "suggestions": [
    {
      "type": "css",
      "title": "Fix Layout Positioning",
      "description": "Adjust element positioning to match the reference design",
      "code": ".target-element { margin-top: 20px; margin-left: 15px; }",
      "priority": 1
    }
  ],
  "confidence": 85
}
```

## 🐛 Troubleshooting

### Common Issues

**"Puppeteer fails to launch"**
- Ensure Chrome/Chromium is installed
- On Linux, install dependencies: `apt-get install -y gconf-service libasound2`

**"Screenshot fails for localhost"**  
- Ensure the target application is running
- Check firewall settings
- Try using 127.0.0.1 instead of localhost

**"Image comparison errors"**
- Verify both image files exist
- Ensure images are valid PNG/JPEG formats
- Check file permissions

**"MCP server not responding"**
- Verify the server is built: `npm run build`
- Check MCP client configuration
- Look for errors in server logs

**"Native capture permission denied"** (macOS)
- Open System Settings > Privacy & Security > Screen Recording
- Enable permission for your application (Terminal, Node, or IDE)
- Restart the application completely
- See [Screen Recording Permission Guide](docs/SCREEN_RECORDING_PERMISSION.md)

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=visual-mcp:* node dist/index.js
```

## 📚 Documentation

- [Native Desktop Capture Guide](docs/NATIVE_CAPTURE.md) - macOS desktop capture with ScreenCaptureKit
- [Screen Recording Permission Setup](docs/SCREEN_RECORDING_PERMISSION.md) - Step-by-step permission guide
- [Platform Compatibility](docs/PLATFORM_COMPATIBILITY.md) - Supported platforms and features
- [IPC Protocol Reference](screencapture-helper/IPC-PROTOCOL.md) - Swift helper binary protocol

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run the test suite: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built on [Model Context Protocol](https://modelcontextprotocol.io) 
- Uses [Puppeteer](https://pptr.dev/) for web automation
- Image processing with [Sharp](https://sharp.pixelplumbing.com/)
- Pixel comparison via [Pixelmatch](https://github.com/mapbox/pixelmatch)

---

**Visual MCP** - Bridging the gap between what coding agents build and the visual outcomes ✨