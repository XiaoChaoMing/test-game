export function isoOffset(distance: number, yawDeg = 45, pitchDeg = 35): { x: number; y: number; z: number } {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const horiz = Math.cos(pitch) * distance;
  return { x: Math.sin(yaw) * horiz, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * horiz };
}
