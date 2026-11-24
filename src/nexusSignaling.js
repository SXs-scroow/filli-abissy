/**
 * Waits until the browser has collected the ICE candidates for a peer connection.
 * Sending an SDP offer/answer before this point can lose candidates when signaling
 * uses ephemeral Realtime broadcasts (the receiver may not have created its peer yet).
 */
export function waitForIceGatheringComplete(peerConnection, timeoutMs = 10000) {
  if (!peerConnection) return Promise.resolve(false);
  if (peerConnection.iceGatheringState === 'complete') return Promise.resolve(true);

  const timeout = Math.max(1, Number(timeoutMs) || 10000);
  return new Promise(resolve => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      if (typeof peerConnection.removeEventListener === 'function') {
        peerConnection.removeEventListener('icegatheringstatechange', onStateChange);
      } else if (peerConnection.onicegatheringstatechange === onStateChange) {
        peerConnection.onicegatheringstatechange = null;
      }
    };

    const finish = complete => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Boolean(complete));
    };

    const onStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') finish(true);
    };

    if (typeof peerConnection.addEventListener === 'function') {
      peerConnection.addEventListener('icegatheringstatechange', onStateChange);
    } else {
      peerConnection.onicegatheringstatechange = onStateChange;
    }

    timer = setTimeout(() => finish(peerConnection.iceGatheringState === 'complete'), timeout);
    // The state can change between the first check and listener registration.
    onStateChange();
  });
}
