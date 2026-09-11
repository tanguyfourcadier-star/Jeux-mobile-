// ============================================================================
// Entrée "inclinaison" partagée par les jeux qui en ont besoin.
//
// Combine trois sources en un seul vecteur {x, y} dans [-1, 1] :
//  - l'inclinaison réelle du téléphone (DeviceOrientationEvent)
//  - les flèches du clavier (pratique pour tester sur ordinateur)
//  - un glisser du doigt sur la zone de jeu (repli tactile si l'inclinaison
//    est refusée ou indisponible)
//
// Sur iPhone (iOS 13+), l'accès à l'inclinaison doit être demandé après un
// geste utilisateur : requestTiltPermission() doit être appelée dans le
// gestionnaire de clic du bouton "Commencer", avant de démarrer la partie.
// ============================================================================

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export async function requestTiltPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    try {
      const res = await DOE.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true; // pas de permission explicite nécessaire (Android, ordinateur)
}

export function createSteering(target) {
  let tiltX = 0;
  let tiltY = 0;
  let keyX = 0;
  let keyY = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let dragStart = null;
  let rawGamma = 0;
  let rawBeta = 0;
  // Par défaut (sans calibration) : ~35° de beta = inclinaison naturelle en main.
  let baseGamma = 0;
  let baseBeta = 35;
  let sampling = false;
  let samples = [];

  function onOrientation(e) {
    rawGamma = e.gamma || 0;
    rawBeta = e.beta || 0;
    if (sampling) samples.push({ g: rawGamma, b: rawBeta });
    tiltX = clamp((rawGamma - baseGamma) / 22, -1, 1);
    tiltY = clamp((rawBeta - baseBeta) / 22, -1, 1);
  }

  // Échantillonne l'inclinaison réelle pendant `durationMs` et en fait la
  // nouvelle position "neutre" (0,0) — à appeler pendant que le téléphone
  // est posé à plat. Sans capteur (ordinateur), ne change rien : le repli
  // clavier/tactile continue de fonctionner normalement.
  async function calibrate(durationMs = 500) {
    samples = [];
    sampling = true;
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    sampling = false;
    if (samples.length > 0) {
      baseGamma = samples.reduce((s, v) => s + v.g, 0) / samples.length;
      baseBeta = samples.reduce((s, v) => s + v.b, 0) / samples.length;
    }
  }
  function onKeyDown(e) {
    if (e.key === "ArrowLeft") keyX = -1;
    if (e.key === "ArrowRight") keyX = 1;
    if (e.key === "ArrowUp") keyY = -1;
    if (e.key === "ArrowDown") keyY = 1;
  }
  function onKeyUp(e) {
    if (e.key === "ArrowLeft" && keyX < 0) keyX = 0;
    if (e.key === "ArrowRight" && keyX > 0) keyX = 0;
    if (e.key === "ArrowUp" && keyY < 0) keyY = 0;
    if (e.key === "ArrowDown" && keyY > 0) keyY = 0;
  }
  function onPointerDown(e) {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!dragging || !dragStart) return;
    dragX = clamp((e.clientX - dragStart.x) / 55, -1, 1);
    dragY = clamp((e.clientY - dragStart.y) / 55, -1, 1);
  }
  function onPointerUp() {
    dragging = false;
    dragX = 0;
    dragY = 0;
  }

  window.addEventListener("deviceorientation", onOrientation);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  if (target) {
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointerleave", onPointerUp);
  }

  return {
    get x() {
      return clamp(tiltX + keyX + dragX, -1, 1);
    },
    get y() {
      return clamp(tiltY + keyY + dragY, -1, 1);
    },
    calibrate,
    destroy() {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (target) {
        target.removeEventListener("pointerdown", onPointerDown);
        target.removeEventListener("pointermove", onPointerMove);
        target.removeEventListener("pointerup", onPointerUp);
        target.removeEventListener("pointerleave", onPointerUp);
      }
    },
  };
}
