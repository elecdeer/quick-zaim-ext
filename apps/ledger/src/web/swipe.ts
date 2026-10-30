import { shiftMonth } from "../ledger/dates.ts";

/** 指を動かした向き。left は右から左へ払う動き */
export type SwipeDirection = "left" | "right";

/** スワイプとみなす横の移動量（px）。タップや少しのぶれで月が変わらないようにする */
export const SWIPE_DISTANCE = 64;

/** 縦か横かを決めるまでの移動量（px）。動きはじめのぶれで決めてしまわないよう少し待つ */
export const AXIS_LOCK_DISTANCE = 10;

/**
 * 画面の端から始めたタッチとみなす幅（px）。
 * iOS の Safari では画面の端から払うと前の画面に戻るので、そちらに譲る。
 */
export const EDGE_WIDTH = 24;

/**
 * 動きはじめの移動量から、横に払おうとしているかを決める。まだ決められなければ null を返す。
 */
export const lockAxis = (dx: number, dy: number): "x" | "y" | null => {
  if (Math.hypot(dx, dy) < AXIS_LOCK_DISTANCE) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
};

/**
 * 指を離したときの移動量から、スワイプの向きを決める。
 * 斜めの動きで月が変わらないよう、横の移動が縦の 2 倍以上あるときだけスワイプにする。
 */
export const swipeDirectionOf = (dx: number, dy: number): SwipeDirection | null => {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx < 0 ? "left" : "right";
};

/**
 * タッチを始めた位置が画面の左右の端なら true を返す。
 */
export const isEdgeStart = (x: number, viewportWidth: number): boolean =>
  x < EDGE_WIDTH || x > viewportWidth - EDGE_WIDTH;

/**
 * スワイプで移る月を返す。左へ払うと次の月、右へ払うと前の月にする（ページをめくる向き）。
 */
export const monthAfterSwipe = (month: string, direction: SwipeDirection): string =>
  shiftMonth(month, direction === "left" ? 1 : -1);
