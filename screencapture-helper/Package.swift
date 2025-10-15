// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenCaptureHelper",
    platforms: [
        .macOS(.v15)  // macOS 15+ (Sequoia) for ScreenCaptureKit
    ],
    products: [
        .executable(
            name: "screencapture-helper",
            targets: ["ScreenCaptureHelper"]
        )
    ],
    dependencies: [
        // No external dependencies - uses only system frameworks
    ],
    targets: [
        .executableTarget(
            name: "ScreenCaptureHelper",
            dependencies: [],
            path: "Sources/ScreenCaptureHelper",
            swiftSettings: [
                // Swift 6 concurrency features
                .enableUpcomingFeature("StrictConcurrency"),
            ],
            linkerSettings: [
                // Link against required frameworks
                .linkedFramework("Foundation"),
                .linkedFramework("AppKit"),
                .linkedFramework("ScreenCaptureKit"),
            ]
        ),
        .testTarget(
            name: "ScreenCaptureHelperTests",
            dependencies: ["ScreenCaptureHelper"]
        )
    ]
)
