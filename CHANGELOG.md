# Changelog

## 1.0.4 - 2026-09-14

- Add Zotero 10.0.2 to the supported version range.
- Verify the reader lifecycle and semantic history APIs against Zotero 10.0.2.

## 1.0.3 - 2026-08-31

- Listen for native swipe gestures at both Gecko event locations used by the
  Zotero reader: its iframe and its owning chrome window.
- Keep outer-window gesture handling scoped to the active reader under the
  pointer.
- Add concise native-gesture diagnostics to Zotero debug output.
- Add the public GitHub update manifest and release endpoint.

## 1.0.2 - 2026-08-31

- Add Zotero 10's required update-manifest declaration.
- Keep the mandatory update URL confined to a reserved local loopback address.

## 1.0.1 - 2026-08-31

- Verify the reader lifecycle and semantic history APIs against Zotero 10.0.1.
- Target Zotero 10.0.1 and use its corrected public reader-listener cleanup API.

## 1.0.0 - 2026-08-31

- Add native macOS two-finger swipe navigation for Zotero reader history.
- Support PDF and EPUB readers, existing readers, multiple tabs, and split view.
- Add deterministic listener cleanup for disable, upgrade, and uninstall.
