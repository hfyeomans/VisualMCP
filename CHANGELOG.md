# Changelog

All notable changes to the Visual MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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