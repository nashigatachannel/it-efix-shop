# -*- coding: utf-8 -*-
"""卸カタログJSON再生成: Google Sheets「EFIX 販売」直読み → 通常卸/特価卸の2JSONを更新する。

旧 generate_wholesale_catalog.py は 2026-05 時点の Excel 列構成前提で、
2026-06-28 のスプシ再構成後は列がズレて仕入価格を卸価格として読んでしまう。
本スクリプトは現行列構成（下記）専用:

  オプション価格表: 略称,No,対応機種,区分,セクション,カテゴリ,品番,製品名,必要数,
                    仕入(税抜),特価卸(税抜),通常卸(税抜),希望小売(税抜),...
  製品販売卸価格表: 略称,製品名,品番,定価(税抜),仕入(税抜),特価卸(税抜),通常卸(税抜),
                    販売価格(税抜),希望小売(税抜),...

画像は既存JSONの割当を (partNumber, model) で継承し、新規品目のみ
imageAssets へのスコアマッチで割当てる。sourceSheet=manual-test の
手動アイテム（注文テスト）はそのまま引き継ぐ。

使い方:
  python scripts/regenerate_wholesale_catalog_from_sheet.py
"""
from __future__ import annotations

import io
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, r"C:/Users/tunag/.claude/lib")
import warnings

warnings.filterwarnings("ignore")

import gspread
from secrets_age import load_service_account

SHEET_ID = "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q"
LIB_DIR = Path(__file__).resolve().parent.parent / "src" / "lib"
OUT_NORMAL = LIB_DIR / "wholesale-catalog.generated.json"
OUT_SPECIAL = LIB_DIR / "wholesale-catalog.special.generated.json"
PLACEHOLDER = "/wholesale-assets/image-pending.png"

MAIN_SET_MODELS = {"eSteer 10セット": "eSteer 10", "eSteer 20セット": "eSteer 20", "eSteer 20MAX　セット": "eSteer 20MAX"}


def as_text(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def as_int(value) -> int:
    s = str(value or "").replace(",", "").strip()
    if not s or s.startswith("#"):
        return 0
    try:
        return int(round(float(s)))
    except ValueError:
        return 0


def price_inc_tax(price_ex_tax: int | None) -> int | None:
    if price_ex_tax is None:
        return None
    # 消費税は切り捨て（税抜が税込÷1.1の切り上げ値のとき、四捨五入だと+1円ズレる: 1181819×1.1=1300000.9）
    return price_ex_tax * 11 // 10


def slug(value: str, fallback: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return text or fallback


def normalize_part(value: str) -> str:
    text = as_text(value).upper()
    text = re.sub(r"[^A-Z0-9]+", "", text)
    return text.lstrip("0") if text.isdigit() else text


def normalize_name(value: str) -> str:
    text = as_text(value).lower().replace("ｅ", "e").replace("　", " ")
    return re.sub(r"[^a-z0-9ぁ-んァ-ヶ一-龥]+", "", text)


# ---- 画像マッチング（旧 generate_wholesale_catalog.py と同等ロジック）----

def is_model_compatible(item_model: str, asset_model: str) -> bool:
    if not asset_model or asset_model == "共用":
        return True
    item_norm = item_model.lower().replace(" ", "")
    asset_norm = asset_model.lower().replace(" ", "")
    if "esteer10" in item_norm:
        return "esteer10" in asset_norm
    if "esteer20" in item_norm:
        return "esteer20" in asset_norm
    return True


def sheet_score(item: dict, asset: dict) -> int:
    sheet = asset.get("sheet", "")
    item_model = item.get("model", "").lower().replace(" ", "")
    category = item.get("category", "")
    score = 0
    if category == "ブラケット":
        score += 260 if "ブラケット" in sheet else -260
    elif "ブラケット" in sheet:
        score -= 180
    if "esteer10" in item_model:
        if "eSteer10" in sheet:
            score += 240
        elif "20" in sheet:
            score -= 260
    elif "esteer20" in item_model:
        if "20" in sheet:
            score += 240
        elif "eSteer10" in sheet:
            score -= 260
    return score


def score_asset(item: dict, asset: dict) -> int:
    score = sheet_score(item, asset)
    part_key = normalize_part(item.get("partNumber", ""))
    name_key = normalize_name(item.get("name", ""))
    short_key = normalize_name(item.get("shortName", ""))
    asset_part = asset.get("partKey", "")
    asset_name = asset.get("nameKey", "")
    if part_key and asset_part == part_key:
        score += 1000
    elif part_key and asset_part and (part_key in asset_part or asset_part in part_key):
        score += 320
    if name_key and asset_name == name_key:
        score += 520
    elif name_key and asset_name and (name_key in asset_name or asset_name in name_key):
        score += 220
    elif short_key and asset_name and (short_key in asset_name or asset_name in short_key):
        score += 80
    if is_model_compatible(item.get("model", ""), asset.get("modelHint", "")):
        score += 60
    else:
        score -= 200
    category = item.get("category", "")
    if category and category == asset.get("categoryHint", ""):
        score += 40
    return score


def pick_image(item: dict, assets: list[dict], inherited: dict) -> str:
    key = (normalize_part(item.get("partNumber", "")), item.get("model", ""), normalize_name(item.get("name", "")))
    loose_key = (normalize_part(item.get("partNumber", "")), normalize_name(item.get("name", "")))
    if key in inherited:
        return inherited[key]
    if loose_key in inherited.get("__loose__", {}):
        return inherited["__loose__"][loose_key]
    scored = sorted(((score_asset(item, a), a) for a in assets), key=lambda p: p[0], reverse=True)
    if scored and scored[0][0] >= 450:
        return scored[0][1]["path"]
    return PLACEHOLDER


def build_inherited_images(old_items: list[dict]) -> dict:
    inherited: dict = {"__loose__": {}}
    for it in old_items:
        image = it.get("image", "")
        if not image or image == PLACEHOLDER:
            continue
        key = (normalize_part(it.get("partNumber", "")), it.get("model", ""), normalize_name(it.get("name", "")))
        loose_key = (normalize_part(it.get("partNumber", "")), normalize_name(it.get("name", "")))
        inherited.setdefault(key, image)
        inherited["__loose__"].setdefault(loose_key, image)
    return inherited


def catalog_item(**kw) -> dict:
    ordered = [
        "id", "kind", "shortName", "model", "section", "category", "partNumber", "name",
        "requiredQty", "wholesalePriceExTax", "retailPriceExTax",
        "wholesalePriceIncTax", "retailPriceIncTax", "image", "sourceSheet", "sourceRow",
    ]
    return {k: kw[k] for k in ordered}


def read_rows(sh, title: str) -> list[list[str]]:
    return sh.worksheet(title).get_all_values()


def build_items(sh, price_col_opt: int, price_col_main: int, assets: list[dict], inherited: dict):
    """price_col_opt/main: 卸価格として使う列 index（通常卸 or 特価卸）"""
    main_rows = read_rows(sh, "製品販売卸価格表")
    main_items = []
    for excel_row, row in enumerate(main_rows[1:], start=2):
        row = row + [""] * (11 - len(row))
        short_name, name = as_text(row[0]), as_text(row[1])
        wholesale = as_int(row[price_col_main])
        retail = as_int(row[7])  # 販売価格(税抜)
        if not name or not wholesale or short_name.startswith("※"):
            continue
        model = MAIN_SET_MODELS.get(name, name.replace("セット", "").strip())
        item = {
            "kind": "set", "shortName": short_name, "model": model,
            "category": "本体セット", "partNumber": "", "name": name,
        }
        image = pick_image(item, assets, inherited)
        main_items.append(catalog_item(
            id=f"set-{slug(short_name, str(excel_row))}",
            kind="set", shortName=short_name, model=model, section="本体",
            category="本体セット", partNumber="", name=name, requiredQty=1,
            wholesalePriceExTax=wholesale, retailPriceExTax=retail or None,
            wholesalePriceIncTax=price_inc_tax(wholesale) or 0,
            retailPriceIncTax=price_inc_tax(retail) if retail else None,
            image=image, sourceSheet="製品販売卸価格表", sourceRow=excel_row,
        ))

    opt_rows = read_rows(sh, "オプション価格表")
    option_items = []
    for excel_row, row in enumerate(opt_rows[2:], start=3):
        row = row + [""] * (16 - len(row))
        no = as_int(row[1])
        model, section, category = as_text(row[2]), as_text(row[4]), as_text(row[5])
        part_no, name = as_text(row[6]), as_text(row[7])
        qty = as_int(row[8]) or 1
        wholesale = as_int(row[price_col_opt])
        retail = as_int(row[12])  # 希望小売(税抜)
        short_name = as_text(row[0]) or name
        if not no or not name:
            continue
        if as_text(row[3]) == "構成品":
            continue  # 親SKU注文に連動して手配するBOM子部材 — 単品販売しないためカタログ非掲載
        item = {
            "kind": "part", "shortName": short_name, "model": model,
            "category": category, "partNumber": part_no, "name": name,
        }
        image = pick_image(item, assets, inherited)
        option_items.append(catalog_item(
            id=f"part-{no:03d}-{slug(part_no or name, str(no))}",
            kind="part", shortName=short_name, model=model,
            section=section or "未分類", category=category or "その他",
            partNumber=part_no, name=name, requiredQty=qty,
            wholesalePriceExTax=wholesale, retailPriceExTax=retail or None,
            wholesalePriceIncTax=price_inc_tax(wholesale) or 0,
            retailPriceIncTax=price_inc_tax(retail) if retail else None,
            image=image, sourceSheet="オプション価格表", sourceRow=excel_row,
        ))
    return main_items, option_items


def diagnostics_for(items: list[dict], assets: list[dict]) -> list[dict]:
    by_path = {a["path"]: a for a in assets}
    out = []
    for it in items:
        src = by_path.get(it["image"], {})
        out.append({
            "id": it["id"], "name": it["name"], "partNumber": it["partNumber"],
            "image": it["image"],
            "imageSourceSheet": src.get("sheet", ""),
            "imageSourceRow": src.get("sourceRow"),
            "imageSourceName": src.get("sourceName", ""),
            "matched": it["image"] != PLACEHOLDER,
        })
    return out


def main() -> int:
    sa_path = load_service_account("efix-shop-service-account.json")
    gc = gspread.service_account(filename=sa_path)
    sh = gc.open_by_key(SHEET_ID)

    old_normal = json.loads(OUT_NORMAL.read_text(encoding="utf-8"))
    old_special = json.loads(OUT_SPECIAL.read_text(encoding="utf-8"))
    assets = old_normal["imageAssets"]
    hero = old_normal["heroImage"]
    inherited = build_inherited_images(old_normal["optionItems"] + old_normal["mainItems"])
    manual_items = [it for it in old_normal["optionItems"] if it.get("sourceSheet") == "manual-test"]
    today = date.today().isoformat()

    # (出力先, 卸価格列: オプション価格表, 製品販売卸価格表, 追加フィールド)
    targets = [
        (OUT_NORMAL, 11, 6, {}),               # 通常卸(税抜)
        (OUT_SPECIAL, 10, 5, {"priceTier": old_special.get("priceTier", "special")}),  # 特価卸(税抜)
    ]
    for out_path, opt_col, main_col, extra in targets:
        main_items, option_items = build_items(sh, opt_col, main_col, assets, inherited)
        option_items = manual_items + option_items
        payload = {
            "generatedAt": today,
            "taxRate": 0.1,
            "heroImage": hero,
            "mainItems": main_items,
            "optionItems": option_items,
            "imageAssets": assets,
            "imageDiagnostics": diagnostics_for(main_items + option_items, assets),
        }
        payload.update(extra)
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        matched = sum(1 for d in payload["imageDiagnostics"] if d["matched"])
        print(f"{out_path.name}: main={len(main_items)} options={len(option_items)} "
              f"imageMatched={matched}/{len(payload['imageDiagnostics'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
