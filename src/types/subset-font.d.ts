declare module "subset-font" {
  interface SubsetFontOptions {
    targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
    preserveNameIds?: number[];
    variationAxes?: Record<
      string,
      number | { min: number; max: number; default?: number }
    >;
  }

  /**
   * harfbuzz(wasm) ベースのフォントサブセッター。
   * text に含まれる文字のグリフだけを残したフォントバッファを返す。
   */
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
