"use strict";

const PLUGIN_ID = "zotero-trackpad-navigation@luigicatello";
const LOG_PREFIX = "[TrackpadNavigation]";

// A Map, rather than only a WeakMap, lets shutdown deterministically remove
// every listener even when a reader remains open.
let readerRegistrations = new Map();
let renderToolbarHandler = null;
let running = false;

function log(message) {
  Zotero.debug(`${LOG_PREFIX} ${message}`);
}

function reportError(error) {
  Zotero.logError(new Error(`${LOG_PREFIX} ${error.message}`, { cause: error }));
}

/**
 * These are Zotero's semantic reader-history operations, not page changes and
 * not a plugin-owned history. In Zotero 10.0.1–10.0.9 they are the same
 * operations called by Reader's Cmd-[ / Cmd-Left and Cmd-] / Cmd-Right handler:
 * resource/reader/reader.js, KeyboardManager.handleKeyDown(), which calls
 * this._reader.navigateBack()/navigateForward(). The Zotero ReaderInstance
 * proxy forwards these methods to its internal reader.
 */
function navigateBack(reader) {
  reader.navigateBack();
}

function navigateForward(reader) {
  reader.navigateForward();
}

function isCurrentReader(reader, eventWindow, event) {
  if (!running) {
    return false;
  }

  // Gecko may dispatch native swipe gestures either inside the reader iframe
  // or on the owning chrome window. For the latter, only claim a gesture whose
  // target/pointer is actually over this reader's iframe.
  if (eventWindow !== reader._iframeWindow) {
    const frame = reader._iframe;
    const target = event.originalTarget || event.target;
    const isOverReader = target === frame
      || Boolean(frame?.contains?.(target))
      || Boolean(frame?.matches?.(":hover"));
    if (!isOverReader) {
      return false;
    }
  }

  // A tab reader must be the selected Zotero tab. Standalone reader windows
  // do not have a tabID; receiving the event in their own iframe is enough.
  if (reader.tabID) {
    return reader._window?.Zotero_Tabs?.selectedID === reader.tabID;
  }
  return true;
}

function canNavigate(reader, direction) {
  return direction === "back"
    ? Boolean(reader.canNavigateBack)
    : Boolean(reader.canNavigateForward);
}

function initializeReader(reader) {
  if (!running || !reader?._iframeWindow) {
    return;
  }

  const eventWindows = [...new Set([
    reader._iframeWindow,
    reader._window
  ].filter(Boolean))];
  const previous = readerRegistrations.get(reader);
  if (previous
    && previous.eventWindows.length === eventWindows.length
    && previous.eventWindows.every((win, index) => win === eventWindows[index])) {
    return;
  }
  previous?.cleanup();

  function handleSwipeMayStart(event) {
    if (!isCurrentReader(reader, event.currentTarget, event)) {
      return;
    }

    let pluginDirections = 0;
    if (canNavigate(reader, "back")) {
      pluginDirections |= event.DIRECTION_LEFT;
    }
    if (canNavigate(reader, "forward")) {
      pluginDirections |= event.DIRECTION_RIGHT;
    }
    if (!pluginDirections) {
      return;
    }

    // Firefox 140's SimpleGestureEvent contract requires both the bitmask and
    // preventDefault() at MayStart to opt into a native swipe. In an LTR UI,
    // Gecko's DIRECTION_LEFT is the history-back/content direction produced by
    // a physical left-to-right trackpad swipe; DIRECTION_RIGHT is forward.
    event.allowedDirections |= pluginDirections;
    event.preventDefault();
    log(`native swipe claimed (${reader.type || "unknown"})`);
  }

  function handleSwipeCompleted(event) {
    if (!isCurrentReader(reader, event.currentTarget, event)) {
      return;
    }

    let handled = false;
    if (event.direction === event.DIRECTION_LEFT && canNavigate(reader, "back")) {
      navigateBack(reader);
      handled = true;
    }
    else if (event.direction === event.DIRECTION_RIGHT && canNavigate(reader, "forward")) {
      navigateForward(reader);
      handled = true;
    }

    if (handled) {
      // Consume only the completed horizontal gesture that performed reader
      // navigation. Vertical scrolling and pinch events are never listened to.
      event.preventDefault();
      event.stopPropagation();
      log(`native swipe completed: ${event.direction === event.DIRECTION_LEFT ? "back" : "forward"}`);
    }
  }

  let registration;
  function cleanup() {
    for (const eventWindow of eventWindows) {
      eventWindow.removeEventListener("MozSwipeGestureMayStart", handleSwipeMayStart, true);
      eventWindow.removeEventListener("MozSwipeGesture", handleSwipeCompleted, true);
    }
    reader._iframeWindow?.removeEventListener("unload", handleUnload, true);
    if (readerRegistrations.get(reader) === registration) {
      readerRegistrations.delete(reader);
    }
  }

  function handleUnload() {
    cleanup();
  }

  registration = { eventWindows, cleanup };
  readerRegistrations.set(reader, registration);
  for (const eventWindow of eventWindows) {
    eventWindow.addEventListener("MozSwipeGestureMayStart", handleSwipeMayStart, true);
    eventWindow.addEventListener("MozSwipeGesture", handleSwipeCompleted, true);
  }
  reader._iframeWindow.addEventListener("unload", handleUnload, true);
  log(`reader initialized (${reader.type || "unknown"}, ${eventWindows.length} event windows)`);
}

async function initializeExistingReader(reader) {
  try {
    await reader._initPromise;
    initializeReader(reader);
  }
  catch (error) {
    reportError(error);
  }
}

async function startup({ id }) {
  if (!Zotero.isMac) {
    log("disabled: macOS is required");
    return;
  }

  await Zotero.uiReadyPromise;
  running = true;

  renderToolbarHandler = ({ reader }) => initializeReader(reader);
  Zotero.Reader.registerEventListener(
    "renderToolbar",
    renderToolbarHandler,
    id || PLUGIN_ID
  );

  // renderToolbar covers readers opened later. This covers restored/already
  // open readers when the plugin is installed or re-enabled at runtime.
  for (const reader of Zotero.Reader._readers) {
    void initializeExistingReader(reader);
  }
  log("started");
}

function shutdown() {
  running = false;

  // Zotero also removes listeners registered with a plugin ID during plugin
  // shutdown. Explicitly unregistering makes reload cleanup deterministic.
  if (renderToolbarHandler) {
    Zotero.Reader?.unregisterEventListener?.("renderToolbar", renderToolbarHandler);
  }
  renderToolbarHandler = null;

  for (const registration of [...readerRegistrations.values()]) {
    registration.cleanup();
  }
  readerRegistrations.clear();
  log("stopped");
}

function install() {}

function uninstall() {}
