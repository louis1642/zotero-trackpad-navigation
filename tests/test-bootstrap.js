"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MockWindow {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type, event = {}) {
    event.type = type;
    for (const handler of this.listeners.get(type) || []) {
      event.currentTarget = this;
      handler(event);
    }
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

function makeSwipe(direction) {
  return {
    direction,
    DIRECTION_LEFT: 4,
    DIRECTION_RIGHT: 8,
    allowedDirections: 0,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    }
  };
}

function createHarness() {
  const registered = [];
  const readers = [];
  const errors = [];
  const Zotero = {
    isMac: true,
    uiReadyPromise: Promise.resolve(),
    debug() {},
    logError(error) {
      errors.push(error);
    },
    Reader: {
      _readers: readers,
      registerEventListener(type, handler, pluginID) {
        registered.push({ type, handler, pluginID });
      },
      unregisterEventListener(type, handler) {
        for (let i = registered.length - 1; i >= 0; i--) {
          if (registered[i].type === type && registered[i].handler === handler) {
            registered.splice(i, 1);
          }
        }
      },
      _unregisterEventListenerByPluginID(pluginID) {
        for (let i = registered.length - 1; i >= 0; i--) {
          if (registered[i].pluginID === pluginID) registered.splice(i, 1);
        }
      }
    }
  };
  const context = vm.createContext({ Zotero, Error, Boolean, Map, Set, Promise });
  const source = fs.readFileSync(path.join(__dirname, "..", "bootstrap.js"), "utf8");
  vm.runInContext(source, context, { filename: "bootstrap.js" });
  return { context, Zotero, readers, registered, errors };
}

function createReader({ selected = true, back = true, forward = true } = {}) {
  const eventWindow = new MockWindow();
  const outerWindow = new MockWindow();
  const iframe = {
    hovered: true,
    contains(target) {
      return target === this;
    },
    matches(selector) {
      return selector === ":hover" && this.hovered;
    }
  };
  let backCount = 0;
  let forwardCount = 0;
  const reader = {
    type: "pdf",
    tabID: "reader-tab",
    _iframe: iframe,
    _iframeWindow: eventWindow,
    _window: outerWindow,
    _initPromise: Promise.resolve(),
    canNavigateBack: back,
    canNavigateForward: forward,
    navigateBack() {
      backCount++;
    },
    navigateForward() {
      forwardCount++;
    }
  };
  outerWindow.Zotero_Tabs = { selectedID: selected ? "reader-tab" : "other-tab" };
  return {
    reader,
    eventWindow,
    outerWindow,
    iframe,
    counts: () => ({ back: backCount, forward: forwardCount })
  };
}

async function main() {
  const harness = createHarness();
  const active = createReader();
  harness.readers.push(active.reader);

  await harness.context.startup({ id: "zotero-trackpad-navigation@luigicatello" });
  await Promise.resolve();
  assert.equal(active.eventWindow.listenerCount("MozSwipeGestureMayStart"), 1);
  assert.equal(active.eventWindow.listenerCount("MozSwipeGesture"), 1);
  assert.equal(active.outerWindow.listenerCount("MozSwipeGesture"), 1);

  const mayStart = makeSwipe(0);
  active.eventWindow.dispatch("MozSwipeGestureMayStart", mayStart);
  assert.equal(mayStart.allowedDirections, 12);
  assert.equal(mayStart.defaultPrevented, true);

  const back = makeSwipe(4);
  active.eventWindow.dispatch("MozSwipeGesture", back);
  assert.deepEqual(active.counts(), { back: 1, forward: 0 });
  assert.equal(back.defaultPrevented, true);
  assert.equal(back.propagationStopped, true);

  active.eventWindow.dispatch("MozSwipeGesture", makeSwipe(8));
  assert.deepEqual(active.counts(), { back: 1, forward: 1 });

  // Gecko may deliver native gestures to the owning chrome window.
  active.outerWindow.dispatch("MozSwipeGesture", makeSwipe(4));
  assert.deepEqual(active.counts(), { back: 2, forward: 1 });

  // Outer-window gestures away from the reader must remain untouched.
  active.iframe.hovered = false;
  const outsideSwipe = makeSwipe(4);
  outsideSwipe.target = {};
  active.outerWindow.dispatch("MozSwipeGesture", outsideSwipe);
  assert.deepEqual(active.counts(), { back: 2, forward: 1 });
  assert.equal(outsideSwipe.defaultPrevented, false);
  active.iframe.hovered = true;

  // A duplicate render event must not install duplicate listeners.
  harness.registered[0].handler({ reader: active.reader });
  assert.equal(active.eventWindow.listenerCount("MozSwipeGesture"), 1);

  const inactive = createReader({ selected: false });
  harness.registered[0].handler({ reader: inactive.reader });
  const inactiveSwipe = makeSwipe(4);
  inactive.eventWindow.dispatch("MozSwipeGesture", inactiveSwipe);
  assert.deepEqual(inactive.counts(), { back: 0, forward: 0 });
  assert.equal(inactiveSwipe.defaultPrevented, false);

  const empty = createReader({ back: false, forward: false });
  harness.registered[0].handler({ reader: empty.reader });
  const emptyMayStart = makeSwipe(0);
  empty.eventWindow.dispatch("MozSwipeGestureMayStart", emptyMayStart);
  assert.equal(emptyMayStart.allowedDirections, 0);
  assert.equal(emptyMayStart.defaultPrevented, false);

  harness.context.shutdown();
  assert.equal(active.eventWindow.listenerCount("MozSwipeGesture"), 0);
  assert.equal(active.outerWindow.listenerCount("MozSwipeGesture"), 0);
  assert.equal(inactive.eventWindow.listenerCount("MozSwipeGesture"), 0);
  assert.equal(empty.eventWindow.listenerCount("MozSwipeGesture"), 0);
  assert.equal(harness.registered.length, 0);
  assert.equal(harness.errors.length, 0);

  // Re-enable installs exactly one new listener.
  await harness.context.startup({ id: "zotero-trackpad-navigation@luigicatello" });
  await Promise.resolve();
  assert.equal(active.eventWindow.listenerCount("MozSwipeGesture"), 1);
  harness.context.shutdown();

  process.stdout.write("bootstrap gesture tests passed\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
