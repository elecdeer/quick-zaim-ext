import { useRouter } from "@void/react";
import { type ReactNode, type TouchEvent, type TransitionEvent, useRef } from "react";
import { cn } from "@/lib/utils";
import { isEdgeStart, lockAxis, monthAfterSwipe, swipeDirectionOf } from "@/web/swipe";

/** 指に付いて動かす量の割合。月が変わる手応えだけ返し、中身が大きくずれて読めなくならないよう小さくする */
const FOLLOW_RATIO = 0.3;

/** スワイプを始めないタッチの場所。入力中の文字の選択やカーソルの移動を邪魔しない */
const IGNORED_TARGETS = "input, textarea, select, [contenteditable]";

type Gesture = { x: number; y: number; axis: "x" | "y" | null };

/**
 * 中身を左右に払って前後の月へ移れるようにする。左へ払うと次の月、右へ払うと前の月。
 *
 * 縦のスクロールはブラウザに任せ（touch-action: pan-y）、横の動きだけを拾う。
 * Pointer Events ではなく Touch Events で拾うのは、マウスで文字を選ぶ操作をスワイプにしないため。
 */
export const MonthSwipe = ({
  month,
  hrefOf,
  className,
  onTransitionEnd,
  children,
}: {
  month: string;
  hrefOf: (month: string) => string;
  className?: string;
  onTransitionEnd?: (event: TransitionEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) => {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);

  /**
   * 指に付いて動かした中身を元の位置に戻す。
   */
  const settle = () => {
    gesture.current = null;
    const element = ref.current;
    if (element === null) return;
    element.style.transition = "transform 200ms ease-out";
    element.style.transform = "";
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    gesture.current = null;
    const touch = event.touches[0];
    const { target } = event;
    if (event.touches.length !== 1 || touch === undefined) return;
    // React のイベントはポータルの中（セレクトのポップアップなど）からも届くので、DOM の上で中にあるものだけ拾う
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
    if (target.closest(IGNORED_TARGETS) !== null) return;
    if (isEdgeStart(touch.clientX, window.innerWidth)) return;
    gesture.current = { x: touch.clientX, y: touch.clientY, axis: null };
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const current = gesture.current;
    const touch = event.touches[0];
    if (current === null || touch === undefined) return;
    const dx = touch.clientX - current.x;
    current.axis ??= lockAxis(dx, touch.clientY - current.y);
    if (current.axis === "y") {
      // 縦のスクロールが始まったら、指を離すまでスワイプとしては扱わない
      settle();
      return;
    }
    const element = ref.current;
    if (current.axis !== "x" || element === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.style.transition = "none";
    element.style.transform = `translateX(${dx * FOLLOW_RATIO}px)`;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const current = gesture.current;
    const touch = event.changedTouches[0];
    settle();
    if (current?.axis !== "x" || touch === undefined) return;
    const direction = swipeDirectionOf(touch.clientX - current.x, touch.clientY - current.y);
    if (direction === null) return;
    void router.visit(hrefOf(monthAfterSwipe(month, direction)));
  };

  return (
    <div
      ref={ref}
      className={cn("touch-pan-y touch-pinch-zoom", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={settle}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
};
