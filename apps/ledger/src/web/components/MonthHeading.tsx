import { Link, useRouter } from "@void/react";
import { useEffect } from "react";
import { formatMonth, shiftMonth } from "@/ledger/dates";
import { setMonthSlide, swipeDirection, type TouchPoint } from "@/web/monthSlide";

/**
 * 「10月」の形で月だけを書く。前後の月へのリンクは年をまたいでも月だけで足りる。
 */
const monthLabel = (month: string): string => `${Number(month.slice(5))}月`;

/**
 * 横に払っても月を移さない場所。入力欄や選択肢の一覧、横にスクロールできる所では、払う操作をそちらに任せる
 */
const SWIPE_IGNORED =
  "input, textarea, select, [role='listbox'], [role='dialog'], [data-no-month-swipe]";

/**
 * 触れた所から上へたどり、横にスクロールできる要素があれば true を返す。
 */
const insideHorizontalScroller = (target: Element): boolean => {
  for (let element: Element | null = target; element !== null; element = element.parentElement) {
    const { overflowX } = getComputedStyle(element);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth
    ) {
      return true;
    }
  }
  return false;
};

/**
 * 画面を横に払ったら、前後の月のリンクを押したときと同じく横にずらして月を移る。
 *
 * 指に合わせて画面を動かす（スクロールスナップなど）には前後の月のデータも先に読む必要があるので、
 * 払い終えてから移る。
 */
const useMonthSwipe = (previousHref: string, nextHref: string): void => {
  const router = useRouter();
  useEffect(() => {
    let start: TouchPoint | null = null;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const target = event.target;
      // 2 本指（拡大など）や、払う操作を任せる場所から始めたときは数えない
      if (
        event.touches.length !== 1 ||
        touch === undefined ||
        !(target instanceof Element) ||
        target.closest(SWIPE_IGNORED) !== null ||
        insideHorizontalScroller(target)
      ) {
        start = null;
        return;
      }
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (start === null || touch === undefined) return;
      const direction = swipeDirection(
        start,
        { x: touch.clientX, y: touch.clientY, time: event.timeStamp },
        window.innerWidth,
      );
      start = null;
      if (direction === null) return;
      setMonthSlide(document.documentElement, direction);
      void router.visit(direction === "next" ? nextHref : previousHref, { viewTransition: true });
    };
    const onTouchCancel = () => {
      start = null;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [router, previousHref, nextHref]);
};

/**
 * 画面が扱う月。年の下に月を大きく出し、前後の月へのリンクを添える。移り先の URL は hrefOf で月から作る。
 *
 * 前後の月へ移るときは、スマホのアプリの画面送りのように本文を横にずらして入れ替える（src/styles.css）。
 * 画面を横に払っても前後の月へ移れる。
 */
export const MonthHeading = ({
  month,
  hrefOf,
}: {
  month: string;
  hrefOf: (month: string) => string;
}) => {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  useMonthSwipe(hrefOf(previous), hrefOf(next));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Link
          href={hrefOf(previous)}
          viewTransition
          onNavigate={() => setMonthSlide(document.documentElement, "prev")}
          className="hover:text-foreground"
        >
          ← {monthLabel(previous)}
        </Link>
        <Link
          href={hrefOf(next)}
          viewTransition
          onNavigate={() => setMonthSlide(document.documentElement, "next")}
          className="hover:text-foreground"
        >
          {monthLabel(next)} →
        </Link>
      </div>
      <h1 aria-label={formatMonth(month)} className="flex flex-col">
        <span className="text-xs text-muted-foreground">{month.slice(0, 4)}</span>
        <span className="text-6xl leading-none font-semibold tracking-tighter">
          {Number(month.slice(5))}
        </span>
      </h1>
    </div>
  );
};
