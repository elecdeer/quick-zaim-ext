/**
 * 月を移る向き。次の月へ進むなら next、前の月へ戻るなら prev。
 */
export type MonthSlideDirection = "next" | "prev";

/**
 * 月を移るときの横にずらすアニメーションの向きを、ルート要素の data-month-slide に書く。
 *
 * Void の Link は document.startViewTransition にコールバックだけを渡し、遷移の型（types）を付けられない。
 * そのため向きはルート要素の属性で CSS（src/styles.css）に伝える。
 * 属性は移動のあとも残るが、CSS は月の移動のビュー遷移の間だけ読むので消さない。
 */
export const setMonthSlide = (
  root: { dataset: Record<string, string | undefined> },
  direction: MonthSlideDirection,
): void => {
  root.dataset.monthSlide = direction;
};

/**
 * 指が触れた位置と時刻。
 */
export type TouchPoint = { x: number; y: number; time: number };

/** 月を移すと見なす横の移動量の下限（px） */
const MIN_SWIPE_DISTANCE = 60;
/** 横の移動量が縦の何倍あれば横のスワイプと見なすか */
const MIN_HORIZONTAL_RATIO = 2;
/** ゆっくり指を動かしたときは、文字を選ぶなど別の操作として月を移さない（ms） */
const MAX_SWIPE_DURATION = 800;
/** 画面の端からのスワイプは、iOS の「戻る」などブラウザの操作に任せる（px） */
const EDGE_GUARD = 24;

/**
 * 横のスワイプから月を移す向きを返す。月を移さないスワイプなら null を返す。
 *
 * 左へ払えば次の月、右へ払えば前の月へ移る（ページをめくる向き）。
 * 縦のスクロールの途中で少し横にぶれただけでは移らないよう、横の移動が縦より十分大きいときだけ認める。
 */
export const swipeDirection = (
  start: TouchPoint,
  end: TouchPoint,
  viewportWidth: number,
): MonthSlideDirection | null => {
  if (start.x < EDGE_GUARD || start.x > viewportWidth - EDGE_GUARD) return null;
  if (end.time - start.time > MAX_SWIPE_DURATION) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) return null;
  return dx < 0 ? "next" : "prev";
};
