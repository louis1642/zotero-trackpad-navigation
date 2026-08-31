# Contributing

Thanks for helping improve Zotero Trackpad Navigation.

## Development

Use Zotero 10.0.1 on macOS with a separate Zotero profile and data directory.
Run the automated checks and build the XPI with:

```sh
node tests/test-bootstrap.js
./build.sh
unzip -t out/zotero-trackpad-navigation-*.xpi
```

## Manual testing

Before proposing a release, verify native two-finger Back and Forward gestures
against Zotero's keyboard commands using internal PDF links and annotations.
Also test empty history, vertical and diagonal scrolling, pinch zoom, multiple
reader tabs, split view, and disable/re-enable cycles.

When reporting gesture problems, include the macOS version, Mac model or
trackpad type, Zotero version, and any `[TrackpadNavigation]` debug lines.

