export const analysisRuntime = String.raw`
import base64
import html as _html
import json
from pathlib import Path

import numpy as np
import pandas as pd


def _ai24_decode_options(encoded):
    try:
        payload = base64.b64decode(str(encoded).encode("ascii")).decode("utf-8")
        options = json.loads(payload)
    except Exception as error:
        raise ValueError("分析组件参数无法解析：%s" % error) from error
    if not isinstance(options, dict):
        raise TypeError("分析组件参数必须是 JSON 对象。")
    return options


def _ai24_dataframe(dataframe):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("分析计算组件输入必须是 pandas DataFrame。")
    if dataframe.empty:
        raise ValueError("输入 DataFrame 不能为空。")
    return dataframe.copy()


def _ai24_column(options, key):
    value = options.get(key, "")
    if isinstance(value, list):
        value = value[0] if value else ""
    return str(value or "")


def _ai24_columns(options, key):
    value = options.get(key, [])
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item)]


def _ai24_require_columns(dataframe, columns, label):
    requested = [column for column in columns if column]
    if not requested:
        raise ValueError("请选择%s。" % label)
    missing = [column for column in requested if column not in dataframe.columns]
    if missing:
        raise ValueError("%s不存在：%s" % (label, missing))
    return requested


def _ai24_unique_column(dataframe, base):
    if base not in dataframe.columns:
        return base
    suffix = 2
    while "%s_%d" % (base, suffix) in dataframe.columns:
        suffix += 1
    return "%s_%d" % (base, suffix)


def _ai24_numeric(dataframe, column):
    _ai24_require_columns(dataframe, [column], "数值字段")
    values = pd.to_numeric(dataframe[column], errors="coerce")
    if values.notna().sum() == 0:
        raise ValueError("字段 %s 没有可用于计算的数值。" % column)
    return values.astype(float)


def _ai24_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _ai24_int(value, default, minimum=None, maximum=None):
    try:
        result = int(float(value))
    except (TypeError, ValueError):
        result = int(default)
    if minimum is not None:
        result = max(int(minimum), result)
    if maximum is not None:
        result = min(int(maximum), result)
    return result


def _ai24_bool(value, default=False):
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in ("true", "1", "yes", "on"):
        return True
    if normalized in ("false", "0", "no", "off"):
        return False
    return bool(default)


def _ai24_scalar(value):
    if value is None:
        return ""
    text = str(value)
    try:
        return float(text)
    except ValueError:
        return text


def _ai24_group_columns(dataframe, options):
    groups = _ai24_columns(options, "ai24GroupColumns")
    if groups:
        _ai24_require_columns(dataframe, groups, "分组字段")
    return groups


def _ai24_compare(series, operator, lower, upper=None):
    if operator == "is_null":
        return series.isna()
    if operator == "not_null":
        return series.notna()

    lower_value = _ai24_scalar(lower)
    upper_value = _ai24_scalar(upper)
    numeric = pd.to_numeric(series, errors="coerce")
    use_numeric = isinstance(lower_value, float) and numeric.notna().any()
    comparable = numeric if use_numeric else series.astype("string")
    first = lower_value if use_numeric else str(lower_value)
    second = upper_value if use_numeric else str(upper_value)

    if operator == "gt":
        return comparable > first
    if operator == "ge":
        return comparable >= first
    if operator == "lt":
        return comparable < first
    if operator == "le":
        return comparable <= first
    if operator == "eq":
        return comparable == first
    if operator == "ne":
        return comparable != first
    if operator == "between":
        return comparable.between(first, second, inclusive="both")
    if operator == "outside":
        return ~comparable.between(first, second, inclusive="both")
    raise ValueError("不支持的比较条件：%s" % operator)


def _ai24_aggregate(dataframe, options, method):
    result_source = _ai24_dataframe(dataframe)
    groups = _ai24_group_columns(result_source, options)
    value_column = _ai24_column(options, "ai24ValueColumn")
    output_names = {
        "aggregate_total": "ai24_total",
        "aggregate_count": "ai24_count",
        "aggregate_population_std": "ai24_population_std",
        "aggregate_population_variance": "ai24_population_variance",
        "aggregate_mean": "ai24_mean",
    }
    output_column = output_names[method]

    if method == "aggregate_count" and not value_column:
        if groups:
            result = result_source.groupby(groups, dropna=False, sort=False).size().reset_index(name=output_column)
        else:
            result = pd.DataFrame({output_column: [len(result_source)]})
        return result, None, {"output_column": output_column, "group_count": len(result)}

    _ai24_require_columns(result_source, [value_column], "指标数值字段")
    values = pd.to_numeric(result_source[value_column], errors="coerce")
    missing_policy = str(options.get("ai24MissingPolicy", "ignore"))
    if missing_policy == "error" and values.isna().any():
        raise ValueError("指标字段 %s 包含缺失值或非数值。" % value_column)
    if missing_policy == "fill_zero":
        values = values.fillna(0.0)
    result_source[value_column] = values

    def aggregate_values(series):
        if method == "aggregate_total":
            return series.sum()
        if method == "aggregate_count":
            return series.count()
        if method == "aggregate_population_std":
            return series.std(ddof=0)
        if method == "aggregate_population_variance":
            return series.var(ddof=0)
        if method == "aggregate_mean":
            return series.mean()
        raise ValueError("不支持的聚合方法：%s" % method)

    if groups:
        result = (
            result_source.groupby(groups, dropna=False, sort=False)[value_column]
            .agg(aggregate_values)
            .reset_index(name=output_column)
        )
    else:
        result = pd.DataFrame({output_column: [aggregate_values(values)]})
    metrics = {
        "output_column": output_column,
        "group_count": len(result),
        "missing_values": int(values.isna().sum()),
    }
    return result, None, metrics


def _ai24_numeric_function(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24ValueColumn")
    values = _ai24_numeric(result, column)
    operation = str(options.get("ai24NumericOperation", "abs"))
    output_column = _ai24_unique_column(result, "ai24_numeric_%s" % operation)
    if operation == "abs":
        calculated = values.abs()
    elif operation == "round":
        calculated = values.round(_ai24_int(options.get("ai24Decimals"), 2, 0, 12))
    elif operation == "sqrt":
        if (values.dropna() < 0).any():
            raise ValueError("平方根计算不接受负数。")
        calculated = np.sqrt(values)
    elif operation == "log":
        if (values.dropna() <= 0).any():
            raise ValueError("对数计算要求所有有效值大于 0。")
        calculated = np.log(values)
    elif operation == "exp":
        calculated = np.exp(values)
    elif operation == "power":
        calculated = np.power(values, _ai24_float(options.get("ai24Operand"), 2.0))
    elif operation == "clip":
        lower = _ai24_float(options.get("ai24LowerBound"), 0.0)
        upper = _ai24_float(options.get("ai24UpperBound"), 100.0)
        if lower > upper:
            raise ValueError("截断下限不能大于上限。")
        calculated = values.clip(lower=lower, upper=upper)
    else:
        raise ValueError("不支持的数值函数：%s" % operation)
    result[output_column] = calculated
    return result, None, {"output_column": output_column, "operation": operation}


def _ai24_text_function(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24TextColumn")
    _ai24_require_columns(result, [column], "文本字段")
    values = result[column].astype("string")
    operation = str(options.get("ai24TextOperation", "trim"))
    argument = str(options.get("ai24TextArgument", ""))
    replacement = str(options.get("ai24TextReplacement", ""))
    output_column = _ai24_unique_column(result, "ai24_text_%s" % operation)
    if operation == "trim":
        calculated = values.str.strip()
    elif operation == "upper":
        calculated = values.str.upper()
    elif operation == "lower":
        calculated = values.str.lower()
    elif operation == "length":
        calculated = values.str.len()
    elif operation == "replace":
        calculated = values.str.replace(argument, replacement, regex=False)
    elif operation == "contains":
        calculated = values.str.contains(argument, regex=False, na=False)
    elif operation == "starts_with":
        calculated = values.str.startswith(argument, na=False)
    elif operation == "ends_with":
        calculated = values.str.endswith(argument, na=False)
    else:
        raise ValueError("不支持的文本函数：%s" % operation)
    result[output_column] = calculated
    return result, None, {"output_column": output_column, "operation": operation}


def _ai24_date_function(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24DateColumn")
    _ai24_require_columns(result, [column], "日期时间字段")
    values = pd.to_datetime(result[column], errors="coerce")
    if values.notna().sum() == 0:
        raise ValueError("字段 %s 没有可解析的日期时间。" % column)
    operation = str(options.get("ai24DateOperation", "year"))
    output_column = _ai24_unique_column(result, "ai24_date_%s" % operation)
    if operation == "year":
        calculated = values.dt.year
    elif operation == "quarter":
        calculated = values.dt.quarter
    elif operation == "month":
        calculated = values.dt.month
    elif operation == "day":
        calculated = values.dt.day
    elif operation == "weekday":
        calculated = values.dt.weekday + 1
    elif operation == "week":
        calculated = values.dt.isocalendar().week.astype("Int64")
    elif operation == "days_since":
        baseline = pd.to_datetime(options.get("ai24BaselineDate", ""), errors="coerce")
        if pd.isna(baseline):
            raise ValueError("基准日期无法解析。")
        calculated = (values - baseline).dt.total_seconds() / 86400.0
    else:
        raise ValueError("不支持的日期函数：%s" % operation)
    result[output_column] = calculated
    return result, None, {"output_column": output_column, "operation": operation}


def _ai24_conditional_function(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24ConditionColumn")
    _ai24_require_columns(result, [column], "条件字段")
    operator = str(options.get("ai24ConditionOperator", "gt"))
    condition = _ai24_compare(
        result[column],
        operator,
        options.get("ai24ConditionValue", ""),
        options.get("ai24ConditionUpperValue", ""),
    ).fillna(False)
    output_column = _ai24_unique_column(result, "ai24_condition_result")
    result[output_column] = np.where(
        condition,
        str(options.get("ai24TrueLabel", "是")),
        str(options.get("ai24FalseLabel", "否")),
    )
    return result, None, {
        "output_column": output_column,
        "matched_rows": int(condition.sum()),
        "operator": operator,
    }


def _ai24_window_function(dataframe, options):
    result = _ai24_dataframe(dataframe)
    value_column = _ai24_column(options, "ai24ValueColumn")
    _ai24_require_columns(result, [value_column], "计算数值字段")
    groups = _ai24_group_columns(result, options)
    order_column = _ai24_column(options, "ai24OrderColumn")
    if order_column:
        _ai24_require_columns(result, [order_column], "排序字段")
    operation = str(options.get("ai24WindowOperation", "rank"))
    ascending = _ai24_bool(options.get("ai24Ascending"), False)
    window = _ai24_int(options.get("ai24WindowSize"), 3, 1)
    output_column = _ai24_unique_column(result, "ai24_window_%s" % operation)
    working = result.copy()
    working["_ai24_original_order"] = np.arange(len(working))
    sort_columns = groups + ([order_column] if order_column else [])
    if sort_columns:
        working = working.sort_values(sort_columns, kind="mergesort")
    working["_ai24_numeric_value"] = pd.to_numeric(working[value_column], errors="coerce")

    if groups:
        grouped = working.groupby(groups, dropna=False, sort=False)
        if operation == "rank":
            calculated = grouped["_ai24_numeric_value"].rank(method="average", ascending=ascending)
        elif operation == "dense_rank":
            calculated = grouped["_ai24_numeric_value"].rank(method="dense", ascending=ascending)
        elif operation == "row_number":
            calculated = grouped.cumcount() + 1
        elif operation == "rolling_mean":
            calculated = grouped["_ai24_numeric_value"].transform(
                lambda series: series.rolling(window, min_periods=1).mean()
            )
        elif operation == "rolling_sum":
            calculated = grouped["_ai24_numeric_value"].transform(
                lambda series: series.rolling(window, min_periods=1).sum()
            )
        elif operation == "cumulative_sum":
            calculated = grouped["_ai24_numeric_value"].cumsum()
        else:
            raise ValueError("不支持的窗口函数：%s" % operation)
    else:
        values = working["_ai24_numeric_value"]
        if operation == "rank":
            calculated = values.rank(method="average", ascending=ascending)
        elif operation == "dense_rank":
            calculated = values.rank(method="dense", ascending=ascending)
        elif operation == "row_number":
            calculated = pd.Series(np.arange(1, len(working) + 1), index=working.index)
        elif operation == "rolling_mean":
            calculated = values.rolling(window, min_periods=1).mean()
        elif operation == "rolling_sum":
            calculated = values.rolling(window, min_periods=1).sum()
        elif operation == "cumulative_sum":
            calculated = values.cumsum()
        else:
            raise ValueError("不支持的窗口函数：%s" % operation)
    working[output_column] = calculated
    working = working.sort_values("_ai24_original_order")
    result[output_column] = working[output_column].to_numpy()
    return result, None, {"output_column": output_column, "operation": operation}


def _ai24_period_analysis(dataframe, options, year_over_year):
    source = _ai24_dataframe(dataframe)
    time_column = _ai24_column(options, "ai24TimeColumn")
    value_column = _ai24_column(options, "ai24ValueColumn")
    _ai24_require_columns(source, [time_column, value_column], "时间和指标字段")
    groups = _ai24_group_columns(source, options)
    frequency = str(options.get("ai24Frequency", "M")).upper()
    allowed = ("M", "Q", "Y") if year_over_year else ("D", "M", "Q", "Y")
    if frequency not in allowed:
        raise ValueError("不支持的分析周期：%s" % frequency)
    aggregation = str(options.get("ai24Aggregation", "sum"))
    if aggregation not in ("sum", "mean", "count", "max", "min"):
        raise ValueError("不支持的周期汇总方式：%s" % aggregation)
    working = source[groups + [time_column, value_column]].copy()
    working[time_column] = pd.to_datetime(working[time_column], errors="coerce")
    working[value_column] = pd.to_numeric(working[value_column], errors="coerce")
    working = working.dropna(subset=[time_column])
    if working.empty:
        raise ValueError("时间字段没有可解析的值。")
    working["_ai24_period"] = working[time_column].dt.to_period(frequency)
    keys = groups + ["_ai24_period"]
    period_values = (
        working.groupby(keys, dropna=False, sort=True)[value_column]
        .agg(aggregation)
        .reset_index(name="ai24_period_value")
    )
    shift_periods = {"M": 12, "Q": 4, "Y": 1}[frequency] if year_over_year else 1
    prefix = "ai24_yoy" if year_over_year else "ai24_pop"
    period_values["_ai24_compare_period"] = period_values["_ai24_period"] - shift_periods
    comparison = period_values[groups + ["_ai24_period", "ai24_period_value"]].rename(
        columns={
            "_ai24_period": "_ai24_compare_period",
            "ai24_period_value": prefix + "_previous",
        }
    )
    period_values = period_values.merge(
        comparison,
        on=groups + ["_ai24_compare_period"],
        how="left",
        sort=False,
    )
    period_values[time_column] = period_values.pop("_ai24_period").dt.to_timestamp()
    period_values = period_values.drop(columns=["_ai24_compare_period"])
    period_values = period_values.sort_values(groups + [time_column] if groups else [time_column])
    previous = period_values[prefix + "_previous"]
    period_values[prefix + "_change"] = period_values["ai24_period_value"] - previous
    denominator = previous.replace(0, np.nan)
    period_values[prefix + "_rate"] = period_values[prefix + "_change"] / denominator
    metrics = {
        "frequency": frequency,
        "aggregation": aggregation,
        "comparable_periods": int(previous.notna().sum()),
        "rate_column": prefix + "_rate",
    }
    return period_values.reset_index(drop=True), None, metrics


def _ai24_year_over_year(dataframe, options):
    return _ai24_period_analysis(dataframe, options, True)


def _ai24_period_over_period(dataframe, options):
    return _ai24_period_analysis(dataframe, options, False)


def _ai24_cumulative_share(dataframe, options):
    result = _ai24_dataframe(dataframe)
    value_column = _ai24_column(options, "ai24ValueColumn")
    values = _ai24_numeric(result, value_column)
    groups = _ai24_group_columns(result, options)
    order_column = _ai24_column(options, "ai24OrderColumn")
    if order_column:
        _ai24_require_columns(result, [order_column], "排序字段")
    ascending = _ai24_bool(options.get("ai24Ascending"), False)
    working = result.copy()
    working["_ai24_value"] = values
    working["_ai24_original_order"] = np.arange(len(working))
    sort_column = order_column or "_ai24_value"
    sort_columns = groups + [sort_column] if groups else [sort_column]
    sort_directions = [True] * len(groups) + [ascending] if groups else [ascending]
    working = working.sort_values(sort_columns, ascending=sort_directions, kind="mergesort")
    if groups:
        grouped = working.groupby(groups, dropna=False, sort=False)["_ai24_value"]
        working["ai24_cumulative_value"] = grouped.cumsum()
        working["ai24_group_total"] = grouped.transform("sum")
    else:
        working["ai24_cumulative_value"] = working["_ai24_value"].cumsum()
        working["ai24_group_total"] = working["_ai24_value"].sum()
    denominator = working["ai24_group_total"].replace(0, np.nan)
    working["ai24_item_share"] = working["_ai24_value"] / denominator
    working["ai24_cumulative_share"] = working["ai24_cumulative_value"] / denominator
    working = working.sort_values("_ai24_original_order")
    for column in ("ai24_cumulative_value", "ai24_group_total", "ai24_item_share", "ai24_cumulative_share"):
        result[column] = working[column].to_numpy()
    return result, None, {
        "output_columns": ["ai24_cumulative_value", "ai24_group_total", "ai24_item_share", "ai24_cumulative_share"],
        "group_count": int(result.groupby(groups, dropna=False).ngroups) if groups else 1,
    }


def _ai24_alert(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24ValueColumn")
    _ai24_require_columns(result, [column], "预警指标字段")
    rule = str(options.get("ai24AlertRule", "gt"))
    warning = _ai24_compare(
        result[column],
        rule,
        options.get("ai24AlertThreshold", ""),
        options.get("ai24AlertUpperThreshold", ""),
    ).fillna(False)
    flag_column = _ai24_unique_column(result, "ai24_alert_flag")
    level_column = _ai24_unique_column(result, "ai24_alert_level")
    message_column = _ai24_unique_column(result, "ai24_alert_message")
    level = str(options.get("ai24WarningLevel", "高"))
    message = str(options.get("ai24WarningMessage", "指标超出预警范围"))
    result[flag_column] = warning.astype(bool)
    result[level_column] = np.where(warning, level, "正常")
    result[message_column] = np.where(warning, message, "")
    return result, None, {
        "warning_rows": int(warning.sum()),
        "warning_rate": float(warning.mean()),
        "output_columns": [flag_column, level_column, message_column],
    }


def _ai24_hex_color(value, fallback):
    color = str(value or "").strip()
    if len(color) == 7 and color.startswith("#"):
        try:
            int(color[1:], 16)
            return color
        except ValueError:
            pass
    return fallback


def _ai24_mix_color(start, end, ratio):
    start_values = [int(start[index:index + 2], 16) for index in (1, 3, 5)]
    end_values = [int(end[index:index + 2], 16) for index in (1, 3, 5)]
    mixed = [round(left + (right - left) * ratio) for left, right in zip(start_values, end_values)]
    return "#%02x%02x%02x" % tuple(mixed)


def _ai24_conditional_formatting(dataframe, options):
    result = _ai24_dataframe(dataframe)
    column = _ai24_column(options, "ai24ValueColumn")
    values = _ai24_numeric(result, column)
    format_type = str(options.get("ai24FormatType", "threshold"))
    true_color = _ai24_hex_color(options.get("ai24TrueColor"), "#ffccc7")
    false_color = _ai24_hex_color(options.get("ai24FalseColor"), "#d9f7be")
    threshold = _ai24_float(options.get("ai24AlertThreshold"), 80.0)
    minimum = float(values.min())
    maximum = float(values.max())
    span = maximum - minimum
    normalized = pd.Series(0.5, index=result.index) if span == 0 else (values - minimum) / span
    styles = []
    displays = []
    for value, normalized_value in zip(values.to_numpy(), normalized.to_numpy()):
        ratio = float(normalized_value) if pd.notna(normalized_value) else 0.0
        ratio = min(1.0, max(0.0, ratio))
        if pd.isna(value):
            style = "background-color:#f5f5f5;color:#999999"
            display_value = ""
        elif format_type == "threshold":
            color = true_color if float(value) >= threshold else false_color
            style = "background-color:%s" % color
            display_value = str(value)
        elif format_type == "color_scale":
            style = "background-color:%s" % _ai24_mix_color(false_color, true_color, ratio)
            display_value = str(value)
        elif format_type == "data_bar":
            percentage = round(ratio * 100.0, 2)
            style = "background:linear-gradient(90deg,%s 0%%,%s %s%%,transparent %s%%)" % (
                true_color,
                true_color,
                percentage,
                percentage,
            )
            display_value = str(value)
        elif format_type == "icon_set":
            icon = "▲" if ratio >= 0.67 else ("●" if ratio >= 0.33 else "▼")
            color = "#cf1322" if ratio >= 0.67 else ("#d48806" if ratio >= 0.33 else "#389e0d")
            style = "color:%s;font-weight:700" % color
            display_value = "%s %s" % (icon, value)
        else:
            raise ValueError("不支持的条件格式类型：%s" % format_type)
        styles.append(style)
        displays.append(display_value)
    style_column = _ai24_unique_column(result, "ai24_format_style")
    display_column = _ai24_unique_column(result, "ai24_format_display")
    result[style_column] = styles
    result[display_column] = displays

    output_path = Path(str(options.get("ai24FormatOutputPath", "reports/ai24-conditional-format.html"))).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    headers = "".join("<th>%s</th>" % _html.escape(str(name)) for name in dataframe.columns)
    rows = []
    for position, (_, row) in enumerate(dataframe.iterrows()):
        cells = []
        for name in dataframe.columns:
            value = "" if pd.isna(row[name]) else str(row[name])
            style = styles[position] if name == column else ""
            cells.append("<td style=\"%s\">%s</td>" % (_html.escape(style, quote=True), _html.escape(value)))
        rows.append("<tr>%s</tr>" % "".join(cells))
    report = (
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>条件格式分析</title></head>"
        "<body><h2>条件格式分析</h2><table border=\"1\" cellspacing=\"0\" cellpadding=\"6\">"
        "<thead><tr>%s</tr></thead><tbody>%s</tbody></table></body></html>" % (headers, "".join(rows))
    )
    output_path.write_text(report, encoding="utf-8")
    path_column = _ai24_unique_column(result, "ai24_format_report_path")
    result[path_column] = str(output_path.resolve())
    return result, None, {
        "format_type": format_type,
        "html_path": str(output_path.resolve()),
        "output_columns": [style_column, display_column, path_column],
    }


def _ai24_trendline(dataframe, options):
    result = _ai24_dataframe(dataframe)
    x_column = _ai24_column(options, "ai24XColumn")
    y_column = _ai24_column(options, "ai24YColumn")
    _ai24_require_columns(result, [x_column, y_column], "X 和 Y 数值字段")
    x_values = pd.to_numeric(result[x_column], errors="coerce")
    y_values = pd.to_numeric(result[y_column], errors="coerce")
    method = str(options.get("ai24TrendMethod", "linear"))
    valid = x_values.notna() & y_values.notna()
    minimum_rows = {"linear": 2, "polynomial_2": 3, "polynomial_3": 4, "exponential": 2}.get(method)
    if minimum_rows is None:
        raise ValueError("不支持的趋势线方法：%s" % method)
    if int(valid.sum()) < minimum_rows:
        raise ValueError("趋势线 %s 至少需要 %d 条有效数据。" % (method, minimum_rows))
    x_train = x_values[valid].to_numpy(dtype=float)
    y_train = y_values[valid].to_numpy(dtype=float)
    if method == "exponential":
        if (y_train <= 0).any():
            raise ValueError("指数趋势线要求 Y 有效值全部大于 0。")
        coefficients = np.polyfit(x_train, np.log(y_train), 1)
        predicted = np.exp(np.polyval(coefficients, x_train))
    else:
        degree = {"linear": 1, "polynomial_2": 2, "polynomial_3": 3}[method]
        coefficients = np.polyfit(x_train, y_train, degree)
        predicted = np.polyval(coefficients, x_train)
    fitted_column = _ai24_unique_column(result, "ai24_trend_fitted")
    residual_column = _ai24_unique_column(result, "ai24_trend_residual")
    result[fitted_column] = np.nan
    result.loc[valid, fitted_column] = predicted
    result[residual_column] = y_values - result[fitted_column]
    residuals = y_train - predicted
    denominator = float(np.sum((y_train - y_train.mean()) ** 2))
    r_squared = 1.0 if denominator == 0 and np.allclose(residuals, 0) else (
        0.0 if denominator == 0 else 1.0 - float(np.sum(residuals ** 2)) / denominator
    )
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    model = {"method": method, "coefficients": coefficients.tolist(), "x_column": x_column, "y_column": y_column}
    metrics = {
        "method": method,
        "r_squared": r_squared,
        "rmse": rmse,
        "valid_rows": int(valid.sum()),
        "output_columns": [fitted_column, residual_column],
    }
    return result, model, metrics


def _ai24_reference_line(dataframe, options):
    result = _ai24_dataframe(dataframe)
    value_column = _ai24_column(options, "ai24ValueColumn")
    result[value_column] = _ai24_numeric(result, value_column)
    groups = _ai24_group_columns(result, options)
    reference_type = str(options.get("ai24ReferenceType", "mean"))
    if reference_type == "fixed":
        reference = pd.Series(_ai24_float(options.get("ai24ReferenceValue"), 0.0), index=result.index)
    else:
        if reference_type == "quantile":
            quantile = min(1.0, max(0.0, _ai24_float(options.get("ai24Quantile"), 0.75)))
            aggregate = lambda series: series.quantile(quantile)
        elif reference_type in ("mean", "median", "min", "max"):
            aggregate = reference_type
        else:
            raise ValueError("不支持的参考线类型：%s" % reference_type)
        if groups:
            reference = result.groupby(groups, dropna=False, sort=False)[value_column].transform(aggregate)
        else:
            scalar = getattr(result[value_column], reference_type)() if isinstance(aggregate, str) else aggregate(result[value_column])
            reference = pd.Series(scalar, index=result.index)
    reference_column = _ai24_unique_column(result, "ai24_reference_value")
    deviation_column = _ai24_unique_column(result, "ai24_reference_deviation")
    above_column = _ai24_unique_column(result, "ai24_above_reference")
    result[reference_column] = reference
    result[deviation_column] = result[value_column] - reference
    result[above_column] = result[value_column] >= reference
    return result, None, {
        "reference_type": reference_type,
        "output_columns": [reference_column, deviation_column, above_column],
    }


def _ai24_future_dates(times, horizon, frequency):
    last_time = times.iloc[-1]
    if frequency != "auto":
        aliases = {"D": "D", "W": "W", "M": "MS", "Q": "QS", "Y": "YS"}
        return pd.date_range(start=last_time, periods=horizon + 1, freq=aliases[frequency])[1:]
    inferred = pd.infer_freq(times) if len(times) >= 3 else None
    if inferred:
        return pd.date_range(start=last_time, periods=horizon + 1, freq=inferred)[1:]
    differences = times.diff().dropna()
    step = differences.median() if not differences.empty else pd.Timedelta(days=1)
    if step <= pd.Timedelta(0):
        step = pd.Timedelta(days=1)
    return pd.DatetimeIndex([last_time + step * offset for offset in range(1, horizon + 1)])


def _ai24_time_series_forecast(dataframe, options):
    source = _ai24_dataframe(dataframe)
    time_column = _ai24_column(options, "ai24TimeColumn")
    value_column = _ai24_column(options, "ai24ValueColumn")
    _ai24_require_columns(source, [time_column, value_column], "时间和预测指标字段")
    working = source[[time_column, value_column]].copy()
    working[time_column] = pd.to_datetime(working[time_column], errors="coerce")
    working[value_column] = pd.to_numeric(working[value_column], errors="coerce")
    working = working.dropna().sort_values(time_column).drop_duplicates(time_column, keep="last")
    if len(working) < 2:
        raise ValueError("时序预测至少需要 2 条有效且时间不同的数据。")
    values = working[value_column].to_numpy(dtype=float)
    count = len(values)
    horizon = _ai24_int(options.get("ai24ForecastHorizon"), 6, 1, 1000)
    method = str(options.get("ai24ForecastMethod", "linear_trend"))
    if method == "linear_trend":
        coefficients = np.polyfit(np.arange(count, dtype=float), values, 1)
        fitted = np.polyval(coefficients, np.arange(count, dtype=float))
        forecast = np.polyval(coefficients, np.arange(count, count + horizon, dtype=float))
        model = {"method": method, "coefficients": coefficients.tolist()}
    elif method == "moving_average":
        window = _ai24_int(options.get("ai24WindowSize"), 3, 1, count)
        fitted_series = pd.Series(values).rolling(window, min_periods=1).mean().shift(1)
        fitted_series.iloc[0] = values[0]
        fitted = fitted_series.to_numpy(dtype=float)
        forecast = np.repeat(float(np.mean(values[-window:])), horizon)
        model = {"method": method, "window": window, "level": float(forecast[0])}
    elif method == "exponential_smoothing":
        alpha = min(1.0, max(0.01, _ai24_float(options.get("ai24SmoothingAlpha"), 0.3)))
        level = float(values[0])
        fitted_values = [level]
        for value in values[1:]:
            fitted_values.append(level)
            level = alpha * float(value) + (1.0 - alpha) * level
        fitted = np.asarray(fitted_values, dtype=float)
        forecast = np.repeat(level, horizon)
        model = {"method": method, "alpha": alpha, "level": level}
    else:
        raise ValueError("不支持的时序预测方法：%s" % method)

    configured_frequency = str(options.get("ai24ForecastFrequency", "auto")).upper()
    if configured_frequency not in ("AUTO", "D", "W", "M", "Q", "Y"):
        raise ValueError("不支持的未来时间频率：%s" % configured_frequency)
    frequency = "auto" if configured_frequency == "AUTO" else configured_frequency
    future_dates = _ai24_future_dates(working[time_column].reset_index(drop=True), horizon, frequency)
    result = source.copy()
    fitted_column = _ai24_unique_column(result, "ai24_forecast_fitted")
    forecast_column = _ai24_unique_column(result, "ai24_forecast")
    result[fitted_column] = np.nan
    fitted_by_time = pd.Series(fitted, index=working[time_column])
    parsed_source_time = pd.to_datetime(result[time_column], errors="coerce")
    result[fitted_column] = parsed_source_time.map(fitted_by_time)
    result[forecast_column] = np.nan
    future = pd.DataFrame(np.nan, index=np.arange(horizon), columns=result.columns)
    future[time_column] = future_dates.to_numpy()
    future[forecast_column] = forecast
    result = pd.concat([result, future], ignore_index=True)
    residuals = values - fitted
    metrics = {
        "method": method,
        "training_rows": count,
        "forecast_rows": horizon,
        "rmse": float(np.sqrt(np.mean(residuals ** 2))),
        "output_columns": [fitted_column, forecast_column],
    }
    return result, model, metrics


def _ai24_cluster(dataframe, options):
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler

    result = _ai24_dataframe(dataframe)
    features = _ai24_columns(options, "ai24FeatureColumns")
    _ai24_require_columns(result, features, "聚类特征字段")
    numeric = result[features].apply(pd.to_numeric, errors="coerce")
    all_missing = [column for column in features if numeric[column].notna().sum() == 0]
    if all_missing:
        raise ValueError("聚类特征没有可用数值：%s" % all_missing)
    numeric = numeric.fillna(numeric.median()).fillna(0.0)
    cluster_count = _ai24_int(options.get("ai24ClusterCount"), 3, 2, 100)
    if len(numeric) <= cluster_count:
        raise ValueError("聚类样本数必须大于聚类数 K。")
    standardize = _ai24_bool(options.get("ai24Standardize"), True)
    scaler = StandardScaler() if standardize else None
    matrix = scaler.fit_transform(numeric) if scaler is not None else numeric.to_numpy(dtype=float)
    random_seed = _ai24_int(options.get("ai24RandomSeed"), 42, 0, 2147483647)
    estimator = KMeans(n_clusters=cluster_count, random_state=random_seed, n_init=10)
    labels = estimator.fit_predict(matrix)
    distances = np.linalg.norm(matrix - estimator.cluster_centers_[labels], axis=1)
    label_column = _ai24_unique_column(result, "ai24_cluster_label")
    distance_column = _ai24_unique_column(result, "ai24_cluster_distance")
    result[label_column] = labels
    result[distance_column] = distances
    silhouette = float(silhouette_score(matrix, labels)) if len(set(labels)) > 1 else None
    model = {"estimator": estimator, "scaler": scaler, "features": features}
    metrics = {
        "cluster_count": cluster_count,
        "inertia": float(estimator.inertia_),
        "silhouette_score": silhouette,
        "output_columns": [label_column, distance_column],
    }
    return result, model, metrics


def run_amphi_ai24_analysis(dataframe, analysis_id, options_base64):
    options = _ai24_decode_options(options_base64)
    aggregate_methods = {
        "aggregate_total",
        "aggregate_count",
        "aggregate_population_std",
        "aggregate_population_variance",
        "aggregate_mean",
    }
    if analysis_id in aggregate_methods:
        result, model, metrics = _ai24_aggregate(dataframe, options, analysis_id)
    else:
        handlers = {
            "numeric_function": _ai24_numeric_function,
            "text_function": _ai24_text_function,
            "date_function": _ai24_date_function,
            "conditional_function": _ai24_conditional_function,
            "window_function": _ai24_window_function,
            "year_over_year": _ai24_year_over_year,
            "period_over_period": _ai24_period_over_period,
            "cumulative_share": _ai24_cumulative_share,
            "alert_analysis": _ai24_alert,
            "conditional_formatting": _ai24_conditional_formatting,
            "trendline_fitting": _ai24_trendline,
            "reference_line": _ai24_reference_line,
            "time_series_forecast": _ai24_time_series_forecast,
            "cluster_analysis": _ai24_cluster,
        }
        handler = handlers.get(str(analysis_id))
        if handler is None:
            raise ValueError("不支持的分析组件：%s" % analysis_id)
        result, model, metrics = handler(dataframe, options)
    metrics = dict(metrics or {})
    metrics.update({
        "analysis_id": str(analysis_id),
        "input_rows": int(len(dataframe)),
        "output_rows": int(len(result)),
    })
    return result, model, metrics
`;
