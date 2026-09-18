// Best-effort access to Electron's remote module, shared by the floating timer and the
// eye-break window. The module is deprecated and its availability varies by
// Obsidian/Electron version, so every caller guards its use and degrades gracefully
// (a window still opens; it just can't be pinned, sized, or made full screen).
export function getElectronRemote(): any {
  const req = (mod: string) => {
    try {
      const r = (window as any).require;
      return r ? r(mod) : null;
    } catch {
      return null;
    }
  };
  const electron = req("electron");
  if (electron && electron.remote) return electron.remote;
  const remote = req("@electron/remote");
  if (remote) return remote;
  return null;
}
