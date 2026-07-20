(function (global) {
  "use strict";

  const isIos = /iphone|ipad|ipod/i.test(global.navigator.userAgent || "");
  const state = {
    supported: "serviceWorker" in navigator,
    registered: false,
    installed: global.matchMedia?.("(display-mode: standalone)").matches || Boolean(global.navigator.standalone),
    updateReady: false,
    offlineDataUsed: false,
    deferredPrompt: null,
    registration: null,
    manualInstall: isIos
  };

  function emit() {
    global.dispatchEvent(new CustomEvent("lottery:pwa-state", { detail: getState() }));
  }

  function getState() {
    return {
      supported: state.supported,
      registered: state.registered,
      installed: state.installed,
      installAvailable: Boolean(state.deferredPrompt) && !state.installed,
      manualInstall: state.manualInstall && !state.installed,
      updateReady: state.updateReady,
      offlineDataUsed: state.offlineDataUsed
    };
  }

  async function install() {
    if (!state.deferredPrompt) return false;
    state.deferredPrompt.prompt();
    const result = await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    if (result?.outcome === "accepted") state.installed = true;
    emit();
    return result?.outcome === "accepted";
  }

  function applyUpdate() {
    if (state.registration?.waiting) state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  global.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    emit();
  });

  global.addEventListener("appinstalled", () => {
    state.installed = true;
    state.deferredPrompt = null;
    emit();
  });

  if (state.supported) {
    global.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
        state.registration = registration;
        state.registered = true;
        state.updateReady = Boolean(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              state.updateReady = true;
              emit();
            }
          });
        });
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "OFFLINE_DATA_USED") {
            state.offlineDataUsed = true;
            emit();
          }
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          global.location.reload();
        });
        emit();
      } catch (error) {
        state.registered = false;
        emit();
      }
    });
  }

  global.LotteryPWA = Object.freeze({ getState, install, applyUpdate });
})(window);
