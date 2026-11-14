import type { Camera } from "three";
import { Vector3 } from "three";

// ponytail: 山の中央の柱だけで測る。奥の柱が高くなる山にするなら全柱の頂点を投影する
export const fitLayers = (
  camera: Camera,
  cube: number,
  max: number,
  bottomPx: number,
  heightPx: number,
) => {
  const point = new Vector3();
  for (let layers = max; layers > 1; layers -= 1) {
    point.set(0, layers * cube, 0).project(camera);
    if (((1 - point.y) / 2) * heightPx >= bottomPx) {
      return layers;
    }
  }
  return 1;
};
