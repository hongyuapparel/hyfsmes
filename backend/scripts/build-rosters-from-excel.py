"""
读取「鸿宇服饰员工花名册.xlsx」生成导入 JSON。

用法:
    python backend/scripts/build-rosters-from-excel.py "<xlsx 路径>" [<输出 JSON 路径>]
默认输出: backend/scripts/import-rosters.data.json

聚合规则:
  - 去重 key：身份证号 -> (姓名+联系方式) -> 姓名
  - 静态字段（性别/身份证号/籍贯）：取首次非空
  - 易变字段（部门/岗位/家庭地址/紧急联系人...）：取最新年度（按 sheet 排序最大）
  - 入职日期：employees.entryDate 取最新一次入职日期（在 2026 表里看到的就是首入或最近一次再入职的）
  - 状态：
      * 出现在 2026 表  -> active
      * 否则若离职明细有 -> left
      * 否则若仅在 2020/2021 出现且离职明细无 -> left（按最后一次出现的年末 12-31）
  - history 时间线：把所有"在职段"按入职/离职日期拼装；离职明细记录闭合段
  - yearly_records: 2021 放假/上班、2022 备注列、2024 春节回家
  - 生日：从身份证号解析 birthMonth/birthDay（出错则置 null）
"""
from __future__ import annotations
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
import pandas as pd

ROSTER_SHEETS = ["2020年", "2021年", "2022年", "2023年", "2024年", "2025年", "2026年"]
LEAVE_SHEET = "离职明细"
CURRENT_ROSTER_YEAR = 2026


def norm(v):
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    s = str(v).strip()
    if s.lower() in ("nan", "none", "nat"):
        return ""
    return s


def to_iso_date(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    s = norm(v)
    if not s:
        return None
    if re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", s):
        y, m, d = s.split("-")
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    m = re.match(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        f = float(s)
        if 20000 < f < 60000:
            base = datetime(1899, 12, 30)
            d = (base + pd.Timedelta(days=f)).date()
            return d.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        pass
    return None


def parse_id_card(id_card: str):
    s = re.sub(r"\s", "", id_card or "")
    if len(s) == 18 and re.fullmatch(r"\d{17}[\dXx]", s):
        try:
            y, mo, d = int(s[6:10]), int(s[10:12]), int(s[12:14])
            if 1900 < y < 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
                return {"birthYear": y, "birthMonth": mo, "birthDay": d}
        except ValueError:
            return None
    if len(s) == 15 and s.isdigit():
        try:
            y, mo, d = 1900 + int(s[6:8]), int(s[8:10]), int(s[10:12])
            if 1 <= mo <= 12 and 1 <= d <= 31:
                return {"birthYear": y, "birthMonth": mo, "birthDay": d}
        except ValueError:
            return None
    return None


def detect_gender(g):
    s = norm(g)
    if s in ("男", "M", "male"):
        return "male"
    if s in ("女", "F", "female"):
        return "female"
    return "unknown"


def find_header_row(df: pd.DataFrame) -> int:
    for i in range(min(5, len(df))):
        row = [norm(v) for v in df.iloc[i].tolist()]
        if "姓名" in row and ("入职日期" in row or any("入职" in v for v in row)):
            return i
    return 1


def col_finder(header: list[str]):
    def f(*keys):
        for k in keys:
            for i, h in enumerate(header):
                if h == k:
                    return i
        for k in keys:
            for i, h in enumerate(header):
                if k in h:
                    return i
        return -1
    return f


def read_roster_sheet(xlsx: str, sheet: str):
    raw = pd.read_excel(xlsx, sheet_name=sheet, header=None)
    hi = find_header_row(raw)
    header = [norm(v).replace("\n", "") for v in raw.iloc[hi].tolist()]
    body = raw.iloc[hi + 1:].reset_index(drop=True)
    f = col_finder(header)
    cols = {
        "employeeNo": f("工号"),
        "name": f("姓名"),
        "gender": f("性别"),
        "department": f("部门"),
        "jobTitle": f("岗位"),
        "entryDate": f("入职日期"),
        "education": f("学历"),
        "dormitory": f("宿舍"),
        "contactPhone": f("联系方式", "联系电话"),
        "idCardNo": f("身份证号码", "身份证"),
        "nativePlace": f("籍贯"),
        "homeAddress": f("家庭住址", "家庭地址"),
        "emergencyContact": f("紧急联系人"),
        "vacationStart": f("放假时间"),
        "workStart": f("上班时间"),
        "birthMonthCell": f("生日月份"),
        "springFestivalReturn": f("春节回家时间"),
    }
    emergency_phone_idx = -1
    ec_idx = cols.get("emergencyContact", -1)
    if ec_idx >= 0:
        for i in range(ec_idx + 1, len(header)):
            if header[i] in ("联系方式", "联系电话"):
                emergency_phone_idx = i
                break
    cols["emergencyPhone"] = emergency_phone_idx
    cols["remark"] = -1

    rows = []
    for _, r in body.iterrows():
        name = norm(r.iloc[cols["name"]]) if cols["name"] >= 0 else ""
        if not name or name in ("姓名", "序号"):
            continue
        rec = {"_sheet": sheet}
        for k, idx in cols.items():
            if idx >= 0 and idx < len(r):
                rec[k] = norm(r.iloc[idx])
            else:
                rec[k] = ""
        rec["entryDate"] = to_iso_date(rec.get("entryDate"))
        for k in ("vacationStart", "workStart", "springFestivalReturn"):
            v = rec.get(k)
            if v:
                iso = to_iso_date(v)
                if iso:
                    rec[k] = iso
        rows.append(rec)
    return rows


def read_leave_sheet(xlsx: str):
    raw = pd.read_excel(xlsx, sheet_name=LEAVE_SHEET, header=None)
    hi = find_header_row(raw)
    header = [norm(v).replace("\n", "") for v in raw.iloc[hi].tolist()]
    body = raw.iloc[hi + 1:].reset_index(drop=True)
    f = col_finder(header)
    cols = {
        "name": f("姓名"),
        "gender": f("性别"),
        "department": f("部门"),
        "jobTitle": f("岗位"),
        "entryDate": f("入职日期"),
        "leaveDate": f("离职日期"),
        "contactPhone": f("联系方式", "联系电话"),
        "leaveReason": f("离职类型/原因", "离职原因", "原因"),
        "nativePlace": f("籍贯"),
        "homeAddress": f("家庭住址", "家庭地址"),
        "emergencyContact": f("紧急联系人"),
        "remark": f("备注"),
    }
    emergency_phone_idx = -1
    for i, h in enumerate(header):
        if i <= cols["contactPhone"]:
            continue
        if h == "联系方式" or ("联系" in h and "人" not in h):
            emergency_phone_idx = i
            break
    cols["emergencyPhone"] = emergency_phone_idx

    rows = []
    for _, r in body.iterrows():
        name = norm(r.iloc[cols["name"]]) if cols["name"] >= 0 else ""
        if not name or name in ("姓名", "序号"):
            continue
        rec = {}
        for k, idx in cols.items():
            if idx >= 0 and idx < len(r):
                rec[k] = norm(r.iloc[idx])
            else:
                rec[k] = ""
        rec["entryDate"] = to_iso_date(rec.get("entryDate"))
        rec["leaveDate"] = to_iso_date(rec.get("leaveDate"))
        if rec["leaveDate"] is None and rec.get("leaveDate"):
            pass
        rows.append(rec)
    return rows


def make_key(rec: dict) -> str:
    idc = re.sub(r"\s", "", rec.get("idCardNo", "") or "")
    if idc and len(idc) >= 15:
        return f"id::{idc.upper()}"
    name = (rec.get("name") or "").strip()
    phone = re.sub(r"\D", "", rec.get("contactPhone", "") or "")
    if name and phone:
        return f"np::{name}::{phone}"
    if name:
        return f"n::{name}"
    return ""


def sheet_year(sheet: str) -> int:
    m = re.match(r"(\d{4})", sheet)
    return int(m.group(1)) if m else 0


def aggregate(rosters: dict[str, list], leaves: list):
    by_key: dict[str, dict] = {}

    sorted_sheets = sorted(rosters.keys(), key=sheet_year)
    for sheet in sorted_sheets:
        for rec in rosters[sheet]:
            key = make_key(rec)
            if not key:
                continue
            ent = by_key.setdefault(key, {
                "key": key,
                "appearances": [],
                "leaveEvents": [],
            })
            ent["appearances"].append({**rec, "_year": sheet_year(sheet)})

    name_phone_index: dict[str, str] = {}
    for key, ent in by_key.items():
        for a in ent["appearances"]:
            n = (a.get("name") or "").strip()
            p = re.sub(r"\D", "", a.get("contactPhone", "") or "")
            if n and p:
                name_phone_index[f"{n}::{p}"] = key
            if n:
                name_phone_index.setdefault(f"n::{n}", key)

    unmatched_leaves = []
    for rec in leaves:
        n = (rec.get("name") or "").strip()
        p = re.sub(r"\D", "", rec.get("contactPhone", "") or "")
        key = None
        if n and p:
            key = name_phone_index.get(f"{n}::{p}")
        if not key and n:
            key = name_phone_index.get(f"n::{n}")
        if not key:
            synthetic = f"leave-only::{n}::{p}::{rec.get('entryDate') or ''}"
            by_key[synthetic] = {
                "key": synthetic,
                "appearances": [],
                "leaveEvents": [rec],
            }
            unmatched_leaves.append(rec)
            continue
        by_key[key]["leaveEvents"].append(rec)

    return by_key, unmatched_leaves


def pick_latest(appearances: list, field: str) -> str:
    for a in sorted(appearances, key=lambda x: -(x.get("_year") or 0)):
        v = a.get(field)
        if v:
            return v
    return ""


def pick_first(appearances: list, field: str) -> str:
    for a in sorted(appearances, key=lambda x: (x.get("_year") or 0)):
        v = a.get(field)
        if v:
            return v
    return ""


def build_employee(key: str, ent: dict):
    apps = ent["appearances"]
    leaves = ent["leaveEvents"]
    name = pick_latest(apps, "name") or pick_latest(leaves, "name")
    if not name:
        return None

    id_card = pick_first(apps, "idCardNo") or ""
    birth = parse_id_card(id_card) if id_card else None

    in_2026 = any(a["_year"] == CURRENT_ROSTER_YEAR for a in apps)
    years_seen = sorted({a["_year"] for a in apps})

    entry_dates = sorted({a.get("entryDate") for a in apps if a.get("entryDate")})
    history_segments = []
    if entry_dates:
        history_segments.append({"entryDate": entry_dates[0], "leaveDate": None, "leaveReason": "", "remark": ""})
    leave_events_sorted = sorted(
        [le for le in leaves if le.get("leaveDate")],
        key=lambda le: le["leaveDate"],
    )
    for le in leave_events_sorted:
        le_entry = le.get("entryDate")
        le_leave = le.get("leaveDate")
        if not history_segments:
            history_segments.append({
                "entryDate": le_entry,
                "leaveDate": le_leave,
                "leaveReason": le.get("leaveReason", ""),
                "remark": le.get("remark", ""),
            })
            continue
        last = history_segments[-1]
        if last["leaveDate"] is None and (not le_entry or le_entry <= le_leave):
            if le_entry and (not last["entryDate"] or le_entry < last["entryDate"]):
                last["entryDate"] = le_entry
            last["leaveDate"] = le_leave
            last["leaveReason"] = le.get("leaveReason", "")
            last["remark"] = le.get("remark", "")
        else:
            history_segments.append({
                "entryDate": le_entry or le_leave,
                "leaveDate": le_leave,
                "leaveReason": le.get("leaveReason", ""),
                "remark": le.get("remark", ""),
            })

    if in_2026:
        latest_entry_2026 = next((a.get("entryDate") for a in apps if a["_year"] == CURRENT_ROSTER_YEAR and a.get("entryDate")), None)
        if latest_entry_2026:
            if history_segments and history_segments[-1]["leaveDate"]:
                history_segments.append({"entryDate": latest_entry_2026, "leaveDate": None, "leaveReason": "", "remark": ""})
            elif not history_segments:
                history_segments.append({"entryDate": latest_entry_2026, "leaveDate": None, "leaveReason": "", "remark": ""})

    if in_2026:
        status = "active"
        last_open = next((s for s in reversed(history_segments) if s["leaveDate"] is None), None)
        entry_date = last_open["entryDate"] if last_open else pick_latest(apps, "entryDate")
        leave_date = None
        leave_reason = ""
    else:
        status = "left"
        last_segment = history_segments[-1] if history_segments else None
        entry_date = (last_segment or {}).get("entryDate") or pick_latest(apps, "entryDate")
        leave_date = (last_segment or {}).get("leaveDate")
        leave_reason = (last_segment or {}).get("leaveReason", "")

    employee_no = pick_latest(apps, "employeeNo")

    yearly_records = []
    for a in apps:
        year = a["_year"]
        vac = norm(a.get("vacationStart"))
        wk = norm(a.get("workStart"))
        spring = norm(a.get("springFestivalReturn"))
        if vac:
            yearly_records.append({"year": year, "type": "vacation_start", "value": vac})
        if wk:
            yearly_records.append({"year": year, "type": "work_start", "value": wk})
        if spring:
            yearly_records.append({"year": year, "type": "spring_festival_return", "value": spring})

    emp = {
        "key": key,
        "employeeNo": employee_no,
        "name": name,
        "gender": detect_gender(pick_latest(apps, "gender") or pick_latest(leaves, "gender")),
        "department": pick_latest(apps, "department") or pick_latest(leaves, "department"),
        "jobTitle": pick_latest(apps, "jobTitle") or pick_latest(leaves, "jobTitle"),
        "entryDate": entry_date,
        "leaveDate": leave_date,
        "leaveReason": leave_reason,
        "status": status,
        "education": pick_latest(apps, "education"),
        "dormitory": pick_latest(apps, "dormitory"),
        "contactPhone": pick_latest(apps, "contactPhone") or pick_latest(leaves, "contactPhone"),
        "idCardNo": id_card,
        "nativePlace": pick_latest(apps, "nativePlace") or pick_latest(leaves, "nativePlace"),
        "homeAddress": pick_latest(apps, "homeAddress") or pick_latest(leaves, "homeAddress"),
        "emergencyContact": pick_latest(apps, "emergencyContact") or pick_latest(leaves, "emergencyContact"),
        "emergencyPhone": pick_latest(apps, "emergencyPhone") or pick_latest(leaves, "emergencyPhone"),
        "birthYear": birth["birthYear"] if birth else None,
        "birthMonth": birth["birthMonth"] if birth else None,
        "birthDay": birth["birthDay"] if birth else None,
        "yearsSeen": years_seen,
        "history": history_segments,
        "yearlyRecords": yearly_records,
        "remark": "",
    }
    return emp


def main():
    if len(sys.argv) < 2:
        print("Usage: python build-rosters-from-excel.py <xlsx> [<out.json>]")
        sys.exit(1)
    xlsx = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).parent / "import-rosters.data.json")

    rosters = {sheet: read_roster_sheet(xlsx, sheet) for sheet in ROSTER_SHEETS}
    leaves = read_leave_sheet(xlsx)

    by_key, unmatched_leaves = aggregate(rosters, leaves)
    employees = []
    for key, ent in by_key.items():
        emp = build_employee(key, ent)
        if emp:
            employees.append(emp)

    employees.sort(key=lambda e: (-(2026 in e["yearsSeen"]), -(e["yearsSeen"][-1] if e["yearsSeen"] else 0), e["name"]))
    for i, e in enumerate(employees, 1):
        e["sortOrder"] = i

    stats = {
        "rosterSheetCounts": {s: len(rosters[s]) for s in ROSTER_SHEETS},
        "leaveRows": len(leaves),
        "uniqueEmployees": len(employees),
        "active": sum(1 for e in employees if e["status"] == "active"),
        "left": sum(1 for e in employees if e["status"] == "left"),
        "withIdCard": sum(1 for e in employees if e["idCardNo"]),
        "withBirth": sum(1 for e in employees if e["birthMonth"]),
        "withReentry": sum(1 for e in employees if len(e["history"]) > 1),
        "unmatchedLeaveEvents": len(unmatched_leaves),
    }
    print(json.dumps(stats, ensure_ascii=False, indent=2))

    payload = {"generatedAt": datetime.now().isoformat(), "stats": stats, "employees": employees}
    Path(out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWritten to: {out}")


if __name__ == "__main__":
    main()
