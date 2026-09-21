export function runtimePlatform() {
  const capacitor = globalThis.Capacitor;

  if (capacitor?.getPlatform) {
    const platform = capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') return platform;
  }

  return 'web';
}

export function isNativeApp() {
  return runtimePlatform() !== 'web';
}

export function isIOSApp() {
  return runtimePlatform() === 'ios';
}

export function isAndroidApp() {
  return runtimePlatform() === 'android';
}
