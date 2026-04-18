// server/public/export.js
// Runs in the headless export page. Loads window.__scene into Excalidraw,
// calls exportToBlob, base64-encodes the result, and exposes it as
// window.__exported_png for Playwright to pick up.

(async () => {
  try {
    if (!window.ExcalidrawLib) throw new Error('ExcalidrawLib not loaded');
    const { exportToBlob } = window.ExcalidrawLib;
    if (typeof exportToBlob !== 'function') throw new Error('exportToBlob is not a function on ExcalidrawLib');

    const scene = window.__scene;
    if (!scene) throw new Error('no scene');

    const blob = await exportToBlob({
      elements: scene.elements,
      appState: {
        ...(scene.appState || {}),
        exportBackground: true,
        viewBackgroundColor: '#ffffff',
      },
      files: scene.files || {},
      mimeType: 'image/png',
    });
    const reader = new FileReader();
    reader.onload = () => { window.__exported_png = reader.result; };
    reader.onerror = () => { window.__exported_png = 'ERROR: FileReader failed'; };
    reader.readAsDataURL(blob);
  } catch (err) {
    window.__exported_png = 'ERROR: ' + err.message;
  }
})();
