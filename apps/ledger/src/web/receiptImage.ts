/**
 * 撮影したレシートの写真を、AI に送る大きさに縮める。
 *
 * スマートフォンの写真（数 MB）をそのまま送ると遅く、AI の入力トークンも増える。
 * 長辺 1600px あればレシートの小さい文字も読める。
 */

/** 縮めた後の長辺の上限（px） */
export const RECEIPT_MAX_EDGE = 1600;

/** JPEG の品質 */
const JPEG_QUALITY = 0.8;

/**
 * 長辺が maxEdge に収まるよう、縦横比を保って縮めた大きさを返す。小さい画像は大きくしない。
 */
export const fitWithin = (
  width: number,
  height: number,
  maxEdge: number = RECEIPT_MAX_EDGE,
): { width: number; height: number } => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * 画像のファイルを長辺 1600px の JPEG の data URL にする。ブラウザでだけ動く。
 *
 * `createImageBitmap` は写真の EXIF の向きに合わせて回してから読むので、縦に撮った写真も横倒しにならない。
 */
export const resizeReceiptImage = async (file: Blob): Promise<string> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("画像を縮められませんでした");
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
};
