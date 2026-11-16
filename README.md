# Zotero Trackpad Navigation

A small macOS plugin that maps native two-finger trackpad swipes to Zotero's
existing reader location history:

- Physical swipe left to right → previous reader location (Back)
- Physical swipe right to left → next reader location (Forward)

It works in Zotero's built-in PDF and EPUB reader, including separate reader
tabs and split views. It calls the same semantic `navigateBack()` and
`navigateForward()` operations as Zotero's built-in reader shortcuts. It does
not create its own history or approximate navigation with page changes.

Version 1.0.5 supports Zotero 10.0.1 through 10.0.9. Its reader lifecycle and
history APIs have been verified against Zotero 10.0.9.

## Requirements

- macOS with a Mac trackpad or compatible trackpad
- Zotero 10.0.1 through 10.0.9

The initial release is deliberately restricted to the Zotero version family
against which it was developed and tested. Its history calls are internal
Zotero reader APIs and should be rechecked before widening compatibility.

## Installation

1. Download `zotero-trackpad-navigation-1.0.5.xpi` from the latest GitHub
   release.
2. In Zotero, choose **Tools → Plugins**.
3. Drag the `.xpi` file into the Plugins window (or use **Install Plugin From
   File** from the gear menu) and approve the installation.

## Removal

Disable or remove **Zotero Trackpad Navigation** in **Tools → Plugins**. All
gesture listeners are removed immediately; restarting Zotero is not required.
The plugin never modifies PDFs, item metadata, or Zotero library data.

## Privacy and data safety

The plugin is completely local. Its code makes no network requests, collects
no analytics, transmits no data, stores no reading history, and does not modify
documents or library metadata.

Zotero 10 requires extensions to declare an update manifest. Zotero may check
the repository's public `updates.json` file on GitHub for new versions. The
plugin itself makes no network requests, and an internet connection is not
required for gesture navigation.

## Design and limitations

The plugin uses Gecko's native `MozSwipeGestureMayStart` and completed
`MozSwipeGesture` events. It opts in only inside the active reader and only
when Zotero reports that the requested history direction is available. It does
not inspect wheel events, so ordinary vertical/diagonal scrolling and pinch
zoom are outside its event path.

Zotero's reader API used here is internal rather than a formally stable public
API. Compatibility is therefore capped at Zotero 10.0.9. No preference pane or
direction-reversal option is included in this MVP.

## Development and verification

Use a separate Zotero profile and data directory. Useful launch options are
`-P <profile>`, `-ZoteroDebugText`, and `-jsconsole`. Build with:

```sh
./build.sh
```

The XPI is written to `out/`, with `manifest.json` at its archive root. Test
the packaged XPI itself, including internal-link and annotation history,
multiple entries, empty history, vertical and diagonal scrolling, pinch zoom,
cancelled and rapid swipes, multiple tabs, split view, already-open readers,
and repeated disable/re-enable cycles.
