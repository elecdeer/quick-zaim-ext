import type { NavigationState } from "void/pages-client";

/**
 * パスがナビゲーションの項目の下にあれば true を返す。
 */
export const isActive = (path: string, href: string): boolean =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/**
 * ナビゲーションで今いる画面として示すパスを返す。
 *
 * 画面の移動中は、移動先のデータが届くまで前の画面が残る。押したタブにすぐ下線を移して反応を返すため、
 * GET で読み込み中なら移動先のパスを返す。フォームの送信（submitting）は画面を移るとは限らないので、今のパスのままにする。
 */
export const navPath = (path: string, navigation: NavigationState): string =>
  navigation.state === "loading" && navigation.location !== null
    ? navigation.location.pathname
    : path;

/**
 * 画面の移動かフォームの送信の途中なら true を返す。
 */
export const isNavigating = (navigation: NavigationState): boolean => navigation.state !== "idle";
