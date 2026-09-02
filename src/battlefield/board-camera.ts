export interface CameraState { zoom: number; panX: number; panY: number }
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 2.5;

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function centeredOrigin(viewport: Size, world: Size, zoom: number): Point {
  return { x: (viewport.width - world.width * zoom) / 2, y: (viewport.height - world.height * zoom) / 2 };
}

export function zoomCameraAtPoint(camera: CameraState, requestedZoom: number, pointer: Point, viewport: Size, world: Size): CameraState {
  const zoom = clampZoom(requestedZoom);
  const oldOrigin = centeredOrigin(viewport, world, camera.zoom);
  const nextOrigin = centeredOrigin(viewport, world, zoom);
  const worldX = (pointer.x - oldOrigin.x - camera.panX) / camera.zoom;
  const worldY = (pointer.y - oldOrigin.y - camera.panY) / camera.zoom;
  return {
    zoom,
    panX: pointer.x - worldX * zoom - nextOrigin.x,
    panY: pointer.y - worldY * zoom - nextOrigin.y,
  };
}
