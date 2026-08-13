export const chartRuntime = String.raw`
import base64
import html
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd


_AMPHI_AI22_COLORS = [
    "#1677ff", "#13a8a8", "#722ed1", "#fa8c16", "#eb2f96",
    "#52c41a", "#2f54eb", "#faad14", "#a0d911", "#08979c",
]


def _amphi_ai22_decode(value):
    if not value:
        return ""
    return base64.b64decode(str(value)).decode("utf-8")


def _amphi_ai22_path(value):
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Chart output path is required.")
    path = Path(raw).expanduser()
    if path.suffix.lower() not in (".html", ".htm"):
        path = path.with_suffix(".html")
    if path.is_absolute() and not path.parent.exists():
        jupyter_path = Path.cwd() / raw.lstrip("/\\")
        if jupyter_path.parent.exists():
            path = jupyter_path
    elif not path.is_absolute():
        path = Path.cwd() / path
    return path.absolute()


def _amphi_ai22_roles(encoded):
    try:
        value = json.loads(_amphi_ai22_decode(encoded) or "null")
    except Exception as error:
        raise ValueError("Chart column configuration is invalid.") from error
    if value is None:
        value = dict()
    if not isinstance(value, dict):
        raise ValueError("Chart column configuration must be an object.")
    return value


def _amphi_ai22_column(dataframe, roles, role, required=True):
    value = roles.get(role, "")
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    name = str(value or "").strip()
    if required and not name:
        raise ValueError("Select chart field: %s" % role)
    if name and name not in dataframe.columns:
        raise ValueError("Chart field does not exist: %s" % name)
    return name


def _amphi_ai22_numeric(dataframe, column):
    if column not in dataframe.columns:
        raise ValueError("Chart numeric field does not exist: %s" % column)
    values = pd.to_numeric(dataframe[column], errors="coerce")
    if not values.notna().any():
        raise ValueError("Chart field has no numeric values: %s" % column)
    return values


def _amphi_ai22_aggregate(dataframe, label_column, value_column, aggregation, top_n):
    selected = dataframe[[label_column, value_column]].copy()
    selected[value_column] = pd.to_numeric(selected[value_column], errors="coerce")
    selected = selected.dropna(subset=[value_column])
    if selected.empty:
        raise ValueError("Chart has no valid numeric rows.")
    grouped = selected.groupby(label_column, dropna=False)[value_column]
    operations = {
        "sum": grouped.sum,
        "mean": grouped.mean,
        "count": grouped.count,
        "max": grouped.max,
        "min": grouped.min,
    }
    operation = operations.get(str(aggregation or "sum").lower())
    if operation is None:
        raise ValueError("Unsupported chart aggregation: %s" % aggregation)
    result = operation().reset_index().head(int(top_n))
    labels = result[label_column].fillna("(空)").astype(str).tolist()
    values = result[value_column].astype(float).tolist()
    return labels, values


def _amphi_ai22_scale(values, low, high):
    numeric = [float(value) for value in values]
    minimum = min(numeric)
    maximum = max(numeric)
    if math.isclose(minimum, maximum):
        return [float((low + high) / 2) for _value in numeric]
    return [low + (value - minimum) * (high - low) / (maximum - minimum) for value in numeric]


def _amphi_ai22_svg_start(title, width, height):
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 %s %s">'
        % (width, height, width, height),
        '<rect width="100%" height="100%" rx="8" fill="#ffffff"/>',
        '<text x="%s" y="34" text-anchor="middle" font-size="22" font-weight="700" fill="#172033">%s</text>'
        % (width / 2, html.escape(title)),
    ]


def _amphi_ai22_html_document(title, body):
    return (
        '<!doctype html><html><head><meta charset="utf-8"><title>%s</title></head>'
        '<body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">%s</body></html>'
        % (html.escape(title), body)
    )


def _amphi_ai22_cartesian(labels, values, title, width, height, style, second_values=None, sizes=None, realtime=False, refresh_seconds=3):
    left, right, top, bottom = 70, width - 30, 60, height - 70
    count = len(values)
    if count == 0:
        raise ValueError("Chart has no data points.")
    x_positions = [left + (index + 0.5) * (right - left) / count for index in range(count)]
    all_values = list(values) + (list(second_values) if second_values else [])
    y_positions = _amphi_ai22_scale(all_values, bottom, top)[:count]
    elements = _amphi_ai22_svg_start(title, width, height)
    elements.extend(
        [
            '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#64748b"/>' % (left, bottom, right, bottom),
            '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#64748b"/>' % (left, top, left, bottom),
        ]
    )
    if style in ("bar", "time_bar", "vertical_combo"):
        bar_width = max(3, (right - left) / count * 0.62)
        for index, (x_value, y_value) in enumerate(zip(x_positions, y_positions)):
            elements.append(
                '<rect x="%s" y="%s" width="%s" height="%s" rx="2" fill="%s"/>'
                % (x_value - bar_width / 2, y_value, bar_width, bottom - y_value, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)])
            )
    elif style == "waterfall":
        cumulative = np.cumsum([0.0] + list(values))
        scaled = _amphi_ai22_scale(cumulative.tolist(), bottom, top)
        bar_width = max(3, (right - left) / count * 0.62)
        for index, x_value in enumerate(x_positions):
            y1, y2 = scaled[index], scaled[index + 1]
            elements.append(
                '<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
                % (x_value - bar_width / 2, min(y1, y2), bar_width, abs(y2 - y1), "#52c41a" if values[index] >= 0 else "#ff4d4f")
            )
    if style in ("line", "area", "scatter", "bubble", "combo", "parallel", "time_line", "time_area", "time_scatter", "density", "realtime_line"):
        points = " ".join("%s,%s" % pair for pair in zip(x_positions, y_positions))
        if style in ("area", "time_area", "density"):
            area_points = "%s,%s %s %s,%s" % (left, bottom, points, right, bottom)
            elements.append('<polygon points="%s" fill="#91caff" opacity="0.55"/>' % area_points)
        if style not in ("scatter", "bubble", "time_scatter"):
            elements.append('<polyline id="ai22-live-line" points="%s" fill="none" stroke="#1677ff" stroke-width="3">' % points)
            if realtime and len(values) > 2:
                frames = []
                for offset in range(len(values)):
                    rotated = list(values[offset:]) + list(values[:offset])
                    rotated_y = _amphi_ai22_scale(rotated, bottom, top)
                    frames.append(" ".join("%s,%s" % pair for pair in zip(x_positions, rotated_y)))
                elements.append(
                    '<animate attributeName="points" values="%s" dur="%ss" repeatCount="indefinite"/>'
                    % (";".join(frames), max(1, int(refresh_seconds)) * len(frames))
                )
            elements.append('</polyline>')
        for index, (x_value, y_value) in enumerate(zip(x_positions, y_positions)):
            radius = 5
            if sizes:
                scaled_sizes = _amphi_ai22_scale(sizes, 5, 24)
                radius = scaled_sizes[index]
            elements.append('<circle cx="%s" cy="%s" r="%s" fill="#1677ff" opacity="0.8"/>' % (x_value, y_value, radius))
    if style in ("combo", "vertical_combo", "parallel") and second_values:
        second_y = _amphi_ai22_scale(all_values, bottom, top)[count:]
        second_points = " ".join("%s,%s" % pair for pair in zip(x_positions, second_y))
        elements.append('<polyline points="%s" fill="none" stroke="#fa8c16" stroke-width="3"/>' % second_points)
    label_step = max(1, int(math.ceil(len(labels) / 12)))
    for index, (label, x_value) in enumerate(zip(labels, x_positions)):
        if index % label_step == 0:
            elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="11" fill="#475569">%s</text>' % (x_value, bottom + 20, html.escape(str(label)[:14])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_polar(labels, values, title, width, height, style):
    elements = _amphi_ai22_svg_start(title, width, height)
    center_x, center_y = width / 2, height / 2 + 20
    radius = min(width, height) * 0.28
    total = sum(abs(float(value)) for value in values)
    if math.isclose(total, 0.0):
        raise ValueError("Polar chart values cannot all be zero.")
    if style == "jade_ring":
        total *= 1.15
    circumference = 2 * math.pi * radius
    offset = 0.0
    for index, (label, value) in enumerate(zip(labels, values)):
        fraction = abs(float(value)) / total
        current_radius = radius * (0.45 + 0.55 * abs(float(value)) / max(abs(float(item)) for item in values)) if style == "rose" else radius
        dash = 2 * math.pi * current_radius * fraction
        gap = 2 * math.pi * current_radius - dash
        stroke_width = current_radius * (0.62 if style in ("donut", "jade_ring") else 0.95)
        elements.append(
            '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="%s %s" stroke-dashoffset="%s" transform="rotate(-90 %s %s)"/>'
            % (center_x, center_y, current_radius, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)], stroke_width, dash, gap, -offset, center_x, center_y)
        )
        offset += circumference * fraction
        legend_y = 62 + index * 18
        if legend_y < height - 20:
            elements.append('<text x="24" y="%s" font-size="12" fill="#334155">%s  %s</text>' % (legend_y, html.escape(str(label)[:14]), round(float(value), 3)))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_gauge(value, title, width, height, style, animated_values=None, refresh_seconds=3):
    numeric = float(value)
    ratio = max(0.0, min(1.0, numeric if abs(numeric) <= 1 else numeric / 100.0))
    elements = _amphi_ai22_svg_start(title, width, height)
    center_x, center_y = width / 2, height * 0.58
    radius = min(width, height) * 0.28
    if style in ("liquid", "time_liquid"):
        fill_height = radius * 2 * ratio
        elements.extend(
            [
                '<defs><clipPath id="ai22-liquid-clip"><circle cx="%s" cy="%s" r="%s"/></clipPath></defs>' % (center_x, center_y, radius),
                '<circle cx="%s" cy="%s" r="%s" fill="#e6f4ff" stroke="#1677ff" stroke-width="4"/>' % (center_x, center_y, radius),
                '<rect x="%s" y="%s" width="%s" height="%s" fill="#69b1ff" clip-path="url(#ai22-liquid-clip)"/>' % (center_x - radius, center_y + radius - fill_height, radius * 2, fill_height),
            ]
        )
    else:
        circumference = 2 * math.pi * radius
        elements.extend(
            [
                '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="#e2e8f0" stroke-width="26"/>' % (center_x, center_y, radius),
                '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="#1677ff" stroke-width="26" stroke-dasharray="%s %s" transform="rotate(-90 %s %s)"/>' % (center_x, center_y, radius, circumference * ratio, circumference, center_x, center_y),
            ]
        )
    display_values = [str(round(float(item), 3)) for item in (animated_values or [numeric])]
    elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="38" font-weight="700" fill="#172033">%s' % (center_x, center_y + 12, display_values[0]))
    if len(display_values) > 1:
        elements.append('<animate attributeName="textContent" values="%s" dur="%ss" repeatCount="indefinite"/>' % (";".join(display_values), max(1, int(refresh_seconds)) * len(display_values)))
    elements.append('</text></svg>')
    return "\n".join(elements)


def _amphi_ai22_kpi(value, title, width, height, labels=None, realtime=False, refresh_seconds=3):
    values = [str(round(float(item), 3)) for item in (value if isinstance(value, list) else [value])]
    elements = _amphi_ai22_svg_start(title, width, height)
    elements.append('<rect x="%s" y="%s" width="%s" height="%s" rx="18" fill="#e6f4ff" stroke="#91caff"/>' % (width * 0.18, height * 0.25, width * 0.64, height * 0.48))
    elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="64" font-weight="700" fill="#0958d9">%s' % (width / 2, height * 0.54, values[0]))
    if realtime and len(values) > 1:
        elements.append('<animate attributeName="textContent" values="%s" dur="%ss" repeatCount="indefinite"/>' % (";".join(values), max(1, int(refresh_seconds)) * len(values)))
    elements.append('</text>')
    if labels:
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="18" fill="#475569">%s</text>' % (width / 2, height * 0.65, html.escape(str(labels[0])[:32])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_table(dataframe, title, display_columns, top_n, crosstab=None, free_report=False):
    selected_columns = display_columns or list(dataframe.columns)
    missing = [column for column in selected_columns if column not in dataframe.columns]
    if missing:
        raise ValueError("Table fields do not exist: %s" % missing)
    table = crosstab if crosstab is not None else dataframe[selected_columns].head(top_n)
    heading = '<h1 style="color:#172033">%s</h1>' % html.escape(title)
    summary = ""
    if free_report:
        numeric = dataframe.select_dtypes(include=[np.number])
        cards = ['<div style="padding:14px;background:#e6f4ff;border-radius:8px"><b>记录数</b><br><span style="font-size:28px">%s</span></div>' % len(dataframe)]
        for column in list(numeric.columns)[:3]:
            cards.append('<div style="padding:14px;background:#f6ffed;border-radius:8px"><b>%s 平均值</b><br><span style="font-size:28px">%s</span></div>' % (html.escape(str(column)), round(float(numeric[column].mean()), 3)))
        summary = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">%s</div>' % "".join(cards)
    return '<div style="padding:24px">%s%s%s</div>' % (heading, summary, table.to_html(index=False, escape=True, border=0, classes="ai22-table"))


def _amphi_ai22_network(dataframe, source_column, target_column, value_column, title, width, height, style, top_n):
    selected = dataframe[[source_column, target_column, value_column]].copy().head(top_n)
    selected[value_column] = pd.to_numeric(selected[value_column], errors="coerce").fillna(1.0)
    source_nodes = list(dict.fromkeys(selected[source_column].astype(str).tolist()))
    target_nodes = list(dict.fromkeys(selected[target_column].astype(str).tolist()))
    nodes = list(dict.fromkeys(source_nodes + target_nodes))
    if not nodes:
        raise ValueError("Relationship chart has no nodes.")
    if style == "sankey":
        elements = _amphi_ai22_svg_start(title, width, height)
        source_positions = {
            node: (120, 75 + index * (height - 130) / max(1, len(source_nodes)))
            for index, node in enumerate(source_nodes)
        }
        target_positions = {
            node: (width - 120, 75 + index * (height - 130) / max(1, len(target_nodes)))
            for index, node in enumerate(target_nodes)
        }
        maximum = max(selected[value_column].abs().max(), 1.0)
        for row in selected.itertuples(index=False, name=None):
            source, target, value = str(row[0]), str(row[1]), float(row[2])
            x1, y1 = source_positions[source]
            x2, y2 = target_positions[target]
            stroke_width = 2 + abs(value) / maximum * 18
            elements.append('<path d="M%s %s C%s %s %s %s %s %s" fill="none" stroke="#69b1ff" stroke-width="%s" opacity="0.5"/>' % (x1, y1, width * 0.4, y1, width * 0.6, y2, x2, y2, stroke_width))
        for index, (node, position) in enumerate(source_positions.items()):
            elements.append('<rect x="%s" y="%s" width="18" height="28" rx="3" fill="%s"/>' % (position[0] - 9, position[1] - 14, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
            elements.append('<text x="%s" y="%s" text-anchor="end" font-size="11">%s</text>' % (position[0] - 14, position[1] + 4, html.escape(node[:12])))
        for index, (node, position) in enumerate(target_positions.items()):
            elements.append('<rect x="%s" y="%s" width="18" height="28" rx="3" fill="%s"/>' % (position[0] - 9, position[1] - 14, _AMPHI_AI22_COLORS[(index + len(source_nodes)) % len(_AMPHI_AI22_COLORS)]))
            elements.append('<text x="%s" y="%s" text-anchor="start" font-size="11">%s</text>' % (position[0] + 14, position[1] + 4, html.escape(node[:12])))
        elements.append('</svg>')
        return "\n".join(elements)
    center_x, center_y = width / 2, height / 2 + 20
    radius = min(width, height) * 0.34
    positions = {}
    for index, node in enumerate(nodes):
        angle = 2 * math.pi * index / len(nodes) - math.pi / 2
        positions[node] = (center_x + radius * math.cos(angle), center_y + radius * math.sin(angle))
    elements = _amphi_ai22_svg_start(title, width, height)
    if style == "migration_map":
        elements.append('<rect x="45" y="62" width="%s" height="%s" rx="20" fill="#e6f4ff" stroke="#91caff"/>' % (width - 90, height - 105))
    maximum = max(selected[value_column].abs().max(), 1.0)
    for row in selected.itertuples(index=False, name=None):
        source, target, value = str(row[0]), str(row[1]), float(row[2])
        x1, y1 = positions[source]
        x2, y2 = positions[target]
        stroke_width = 1 + abs(value) / maximum * (12 if style == "sankey" else 5)
        elements.append('<path d="M%s %s Q%s %s %s %s" fill="none" stroke="#69b1ff" stroke-width="%s" opacity="0.55"/>' % (x1, y1, center_x, center_y, x2, y2, stroke_width))
    for index, node in enumerate(nodes):
        x_value, y_value = positions[node]
        elements.append('<circle cx="%s" cy="%s" r="12" fill="%s"/>' % (x_value, y_value, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="11" fill="#172033">%s</text>' % (x_value, y_value + 27, html.escape(node[:12])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_heatmap(dataframe, x_column, y_column, value_column, title, width, height, top_n):
    selected = dataframe[[x_column, y_column, value_column]].copy().head(top_n)
    selected[value_column] = pd.to_numeric(selected[value_column], errors="coerce")
    selected = selected.dropna(subset=[value_column])
    x_labels = list(dict.fromkeys(selected[x_column].astype(str)))
    y_labels = list(dict.fromkeys(selected[y_column].astype(str)))
    values = selected[value_column].astype(float).tolist()
    if not values:
        raise ValueError("Heatmap has no numeric values.")
    intensities = _amphi_ai22_scale(values, 0.15, 1.0)
    elements = _amphi_ai22_svg_start(title, width, height)
    cell_width = (width - 120) / max(1, len(x_labels))
    cell_height = (height - 120) / max(1, len(y_labels))
    for intensity, row in zip(intensities, selected.itertuples(index=False, name=None)):
        x_index = x_labels.index(str(row[0]))
        y_index = y_labels.index(str(row[1]))
        elements.append('<rect x="%s" y="%s" width="%s" height="%s" fill="#1677ff" opacity="%s"/>' % (80 + x_index * cell_width, 60 + y_index * cell_height, cell_width - 2, cell_height - 2, intensity))
    for index, label in enumerate(x_labels):
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="10">%s</text>' % (80 + (index + 0.5) * cell_width, height - 35, html.escape(label[:10])))
    for index, label in enumerate(y_labels):
        elements.append('<text x="72" y="%s" text-anchor="end" font-size="10">%s</text>' % (65 + (index + 0.5) * cell_height, html.escape(label[:10])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_gantt(dataframe, label_column, start_column, end_column, title, width, height, top_n):
    selected = dataframe[[label_column, start_column, end_column]].copy().head(top_n)
    selected[start_column] = pd.to_datetime(selected[start_column], errors="coerce")
    selected[end_column] = pd.to_datetime(selected[end_column], errors="coerce")
    selected = selected.dropna()
    if selected.empty:
        raise ValueError("Gantt chart has no valid start and end values.")
    minimum = selected[start_column].min().timestamp()
    maximum = selected[end_column].max().timestamp()
    if math.isclose(minimum, maximum):
        maximum = minimum + 1
    elements = _amphi_ai22_svg_start(title, width, height)
    row_height = max(18, (height - 100) / len(selected))
    for index, row in enumerate(selected.itertuples(index=False, name=None)):
        label, start, end = str(row[0]), row[1].timestamp(), row[2].timestamp()
        x_value = 160 + (start - minimum) / (maximum - minimum) * (width - 200)
        bar_width = max(4, (end - start) / (maximum - minimum) * (width - 200))
        y_value = 62 + index * row_height
        elements.append('<text x="150" y="%s" text-anchor="end" font-size="11">%s</text>' % (y_value + 12, html.escape(label[:18])))
        elements.append('<rect x="%s" y="%s" width="%s" height="14" rx="4" fill="%s"/>' % (x_value, y_value, bar_width, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_wordcloud(labels, values, title, width, height):
    elements = _amphi_ai22_svg_start(title, width, height)
    sizes = _amphi_ai22_scale(values, 14, 54)
    columns = 5
    for index, (label, size) in enumerate(zip(labels, sizes)):
        x_value = 80 + (index % columns) * (width - 150) / max(1, columns - 1)
        y_value = 85 + (index // columns) * 68
        if y_value > height - 25:
            break
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="%s" fill="%s" transform="rotate(%s %s %s)">%s</text>' % (x_value, y_value, size, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)], -12 if index % 3 == 0 else 0, x_value, y_value, html.escape(str(label)[:20])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_funnel(labels, values, title, width, height):
    order = np.argsort(-np.asarray(values, dtype=float))
    ordered_labels = [labels[index] for index in order]
    ordered_values = [float(values[index]) for index in order]
    maximum = max(abs(value) for value in ordered_values) or 1.0
    elements = _amphi_ai22_svg_start(title, width, height)
    stage_height = (height - 100) / len(ordered_values)
    for index, (label, value) in enumerate(zip(ordered_labels, ordered_values)):
        current_width = (width - 120) * abs(value) / maximum
        next_width = (width - 120) * abs(ordered_values[index + 1]) / maximum if index + 1 < len(ordered_values) else current_width * 0.7
        y_value = 60 + index * stage_height
        points = "%s,%s %s,%s %s,%s %s,%s" % ((width - current_width) / 2, y_value, (width + current_width) / 2, y_value, (width + next_width) / 2, y_value + stage_height - 2, (width - next_width) / 2, y_value + stage_height - 2)
        elements.append('<polygon points="%s" fill="%s" opacity="0.85"/>' % (points, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="12" fill="white">%s  %s</text>' % (width / 2, y_value + stage_height / 2, html.escape(str(label)[:14]), round(value, 2)))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_treemap(labels, values, title, width, height, style):
    total = sum(abs(float(value)) for value in values) or 1.0
    elements = _amphi_ai22_svg_start(title, width, height)
    x_value = 30
    available = width - 60
    for index, (label, value) in enumerate(zip(labels, values)):
        item_width = available * abs(float(value)) / total
        if style == "sunburst":
            item_width = max(2, item_width)
        elements.append('<rect x="%s" y="70" width="%s" height="%s" fill="%s" opacity="0.85"/>' % (x_value, item_width, height - 110, _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
        if item_width > 40:
            elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="12" fill="white">%s</text>' % (x_value + item_width / 2, height / 2, html.escape(str(label)[:12])))
        x_value += item_width
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_boxplot(dataframe, category_column, value_column, title, width, height, top_n):
    selected = dataframe[[category_column, value_column]].copy()
    selected[value_column] = pd.to_numeric(selected[value_column], errors="coerce")
    selected = selected.dropna().head(top_n)
    groups = list(selected.groupby(category_column, dropna=False))
    if not groups:
        raise ValueError("Box plot has no numeric values.")
    all_values = selected[value_column].astype(float).tolist()
    elements = _amphi_ai22_svg_start(title, width, height)
    left, right, top, bottom = 80, width - 40, 60, height - 70
    x_positions = [left + (index + 0.5) * (right - left) / len(groups) for index in range(len(groups))]
    def y_position(value):
        return _amphi_ai22_scale([min(all_values), float(value), max(all_values)], bottom, top)[1]
    for index, ((label, group), x_value) in enumerate(zip(groups, x_positions)):
        values = group[value_column].astype(float)
        q1, median, q3 = values.quantile([0.25, 0.5, 0.75]).tolist()
        minimum, maximum = values.min(), values.max()
        y_q1, y_median, y_q3 = y_position(q1), y_position(median), y_position(q3)
        y_min, y_max = y_position(minimum), y_position(maximum)
        elements.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#334155"/>' % (x_value, y_min, x_value, y_max))
        elements.append('<rect x="%s" y="%s" width="34" height="%s" fill="%s" opacity="0.55" stroke="#334155"/>' % (x_value - 17, min(y_q1, y_q3), abs(y_q3 - y_q1), _AMPHI_AI22_COLORS[index % len(_AMPHI_AI22_COLORS)]))
        elements.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#172033" stroke-width="2"/>' % (x_value - 17, y_median, x_value + 17, y_median))
        elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="11">%s</text>' % (x_value, bottom + 20, html.escape(str(label)[:12])))
    elements.append('</svg>')
    return "\n".join(elements)


def _amphi_ai22_map(dataframe, roles, title, width, height, style, top_n):
    elements = _amphi_ai22_svg_start(title, width, height)
    elements.append('<rect x="55" y="65" width="%s" height="%s" rx="18" fill="#e6f4ff" stroke="#69b1ff"/>' % (width - 110, height - 120))
    if style == "admin_map":
        label_column = _amphi_ai22_column(dataframe, roles, "label")
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        labels, values = _amphi_ai22_aggregate(dataframe, label_column, value_column, "sum", top_n)
        intensity = _amphi_ai22_scale(values, 0.25, 1.0)
        columns = max(1, int(math.ceil(math.sqrt(len(labels)))))
        tile_width = (width - 150) / columns
        tile_height = (height - 170) / max(1, math.ceil(len(labels) / columns))
        for index, (label, opacity) in enumerate(zip(labels, intensity)):
            x_value = 75 + (index % columns) * tile_width
            y_value = 85 + (index // columns) * tile_height
            elements.append('<rect x="%s" y="%s" width="%s" height="%s" rx="8" fill="#1677ff" opacity="%s"/>' % (x_value, y_value, tile_width - 6, tile_height - 6, opacity))
            elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="11" fill="white">%s</text>' % (x_value + tile_width / 2, y_value + tile_height / 2, html.escape(str(label)[:10])))
    else:
        longitude_column = _amphi_ai22_column(dataframe, roles, "longitude")
        latitude_column = _amphi_ai22_column(dataframe, roles, "latitude")
        longitudes = _amphi_ai22_numeric(dataframe, longitude_column)
        latitudes = _amphi_ai22_numeric(dataframe, latitude_column)
        valid = longitudes.notna() & latitudes.notna()
        selected = dataframe.loc[valid].head(top_n)
        xs = _amphi_ai22_scale(longitudes.loc[selected.index].tolist(), 80, width - 80)
        ys = _amphi_ai22_scale(latitudes.loc[selected.index].tolist(), height - 80, 80)
        value_column = _amphi_ai22_column(dataframe, roles, "value", required=False)
        values = _amphi_ai22_numeric(selected, value_column).fillna(1.0).tolist() if value_column else [1.0] * len(selected)
        radii = _amphi_ai22_scale(values, 5, 24)
        label_column = _amphi_ai22_column(dataframe, roles, "label", required=False)
        for index, (x_value, y_value, radius) in enumerate(zip(xs, ys, radii)):
            elements.append('<circle cx="%s" cy="%s" r="%s" fill="#ff4d4f" opacity="0.55"/>' % (x_value, y_value, radius))
            if label_column:
                label = str(selected.iloc[index][label_column])
                elements.append('<text x="%s" y="%s" text-anchor="middle" font-size="10">%s</text>' % (x_value, y_value - radius - 4, html.escape(label[:12])))
    elements.append('</svg>')
    return "\n".join(elements)


def render_amphi_ai22_chart(
    dataframe,
    chart_type,
    chart_id,
    column_roles_base64,
    title_base64,
    output_path_base64,
    aggregation="sum",
    width=960,
    height=560,
    top_n=50,
    refresh_seconds=3,
    window_size=20,
):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Chart input must be a pandas DataFrame.")
    if dataframe.empty:
        raise ValueError("Chart input DataFrame is empty.")
    roles = _amphi_ai22_roles(column_roles_base64)
    title = _amphi_ai22_decode(title_base64).strip() or str(chart_id)
    output_path = _amphi_ai22_path(_amphi_ai22_decode(output_path_base64))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width = max(480, min(2400, int(width)))
    height = max(320, min(1600, int(height)))
    top_n = max(1, min(5000, int(top_n)))
    refresh_seconds = max(1, min(3600, int(refresh_seconds)))
    window_size = max(2, min(500, int(window_size)))
    style = str(chart_type)
    body = ""
    point_count = min(len(dataframe), top_n)

    if style in ("list", "free_report"):
        display_columns = _amphi_ai22_column(dataframe, roles, "display", required=False)
        body = _amphi_ai22_table(dataframe, title, display_columns, top_n, free_report=style == "free_report")
    elif style == "crosstab":
        row_column = _amphi_ai22_column(dataframe, roles, "x")
        column_column = _amphi_ai22_column(dataframe, roles, "series")
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        table = pd.pivot_table(dataframe, index=row_column, columns=column_column, values=value_column, aggfunc=aggregation, fill_value=0).reset_index()
        body = _amphi_ai22_table(dataframe, title, [], top_n, crosstab=table)
    elif style in ("text_kpi", "realtime_label"):
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        values = _amphi_ai22_numeric(dataframe, value_column).dropna().tail(window_size).tolist()
        label_column = _amphi_ai22_column(dataframe, roles, "label", required=False)
        labels = dataframe.loc[_amphi_ai22_numeric(dataframe, value_column).dropna().index, label_column].astype(str).tail(window_size).tolist() if label_column else []
        body = _amphi_ai22_kpi(values if style == "realtime_label" else values[-1], title, width, height, labels=labels, realtime=style == "realtime_label", refresh_seconds=refresh_seconds)
    elif style in ("gauge", "liquid", "time_gauge", "time_liquid", "realtime_gauge"):
        value_role = "value" if style in ("gauge", "liquid") else "y"
        value_column = _amphi_ai22_column(dataframe, roles, value_role)
        gauge_data = dataframe
        if style in ("time_gauge", "time_liquid", "realtime_gauge"):
            time_column = _amphi_ai22_column(dataframe, roles, "x")
            gauge_data = dataframe.assign(
                ai22_time_sort=pd.to_datetime(dataframe[time_column], errors="coerce")
            ).sort_values("ai22_time_sort")
        values = _amphi_ai22_numeric(gauge_data, value_column).dropna().tail(window_size).tolist()
        gauge_style = "liquid" if style in ("liquid", "time_liquid") else "gauge"
        animated = values if style in ("time_gauge", "time_liquid", "realtime_gauge") else None
        body = _amphi_ai22_gauge(values[-1], title, width, height, gauge_style, animated_values=animated, refresh_seconds=refresh_seconds)
    elif style in ("pie", "donut", "rose", "jade_ring", "polar", "radar"):
        label_column = _amphi_ai22_column(dataframe, roles, "label")
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        labels, values = _amphi_ai22_aggregate(dataframe, label_column, value_column, aggregation, top_n)
        body = _amphi_ai22_polar(labels, values, title, width, height, style)
    elif style in ("relationship", "sankey", "force", "chord", "edge_bundling", "migration_map", "sunburst"):
        source_column = _amphi_ai22_column(dataframe, roles, "source")
        target_column = _amphi_ai22_column(dataframe, roles, "target")
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        if style == "sunburst":
            hierarchy = dataframe[[source_column, target_column, value_column]].copy()
            hierarchy["ai22_hierarchy"] = hierarchy[source_column].astype(str) + " / " + hierarchy[target_column].astype(str)
            labels, values = _amphi_ai22_aggregate(hierarchy, "ai22_hierarchy", value_column, aggregation, top_n)
            body = _amphi_ai22_polar(labels, values, title, width, height, "donut")
        else:
            body = _amphi_ai22_network(dataframe, source_column, target_column, value_column, title, width, height, style, top_n)
    elif style in ("heatmap", "time_heatmap"):
        x_column = _amphi_ai22_column(dataframe, roles, "x")
        y_role = "series" if style == "time_heatmap" else "y"
        y_column = _amphi_ai22_column(dataframe, roles, y_role)
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        body = _amphi_ai22_heatmap(dataframe, x_column, y_column, value_column, title, width, height, top_n)
    elif style == "gantt":
        body = _amphi_ai22_gantt(dataframe, _amphi_ai22_column(dataframe, roles, "label"), _amphi_ai22_column(dataframe, roles, "start"), _amphi_ai22_column(dataframe, roles, "end"), title, width, height, top_n)
    elif style == "wordcloud":
        labels, values = _amphi_ai22_aggregate(dataframe, _amphi_ai22_column(dataframe, roles, "label"), _amphi_ai22_column(dataframe, roles, "value"), aggregation, top_n)
        body = _amphi_ai22_wordcloud(labels, values, title, width, height)
    elif style == "funnel":
        labels, values = _amphi_ai22_aggregate(dataframe, _amphi_ai22_column(dataframe, roles, "label"), _amphi_ai22_column(dataframe, roles, "value"), aggregation, top_n)
        body = _amphi_ai22_funnel(labels, values, title, width, height)
    elif style in ("treemap",):
        labels, values = _amphi_ai22_aggregate(dataframe, _amphi_ai22_column(dataframe, roles, "label"), _amphi_ai22_column(dataframe, roles, "value"), aggregation, top_n)
        body = _amphi_ai22_treemap(labels, values, title, width, height, style)
    elif style in ("boxplot", "violin"):
        body = _amphi_ai22_boxplot(dataframe, _amphi_ai22_column(dataframe, roles, "x"), _amphi_ai22_column(dataframe, roles, "value"), title, width, height, top_n)
    elif style in ("admin_map", "marker_map", "geo_heatmap"):
        body = _amphi_ai22_map(dataframe, roles, title, width, height, style, top_n)
    elif style == "calendar_heatmap":
        date_column = _amphi_ai22_column(dataframe, roles, "x")
        value_column = _amphi_ai22_column(dataframe, roles, "value")
        calendar = dataframe[[date_column, value_column]].copy()
        calendar[date_column] = pd.to_datetime(calendar[date_column], errors="coerce")
        calendar = calendar.dropna().head(top_n)
        calendar["ai22_week"] = calendar[date_column].dt.isocalendar().week.astype(str)
        calendar["ai22_weekday"] = calendar[date_column].dt.day_name().str.slice(0, 3)
        body = _amphi_ai22_heatmap(calendar, "ai22_week", "ai22_weekday", value_column, title, width, height, top_n)
    else:
        x_column = _amphi_ai22_column(dataframe, roles, "x", required=style not in ("density",))
        y_role = "value" if style == "density" else "y"
        y_column = _amphi_ai22_column(dataframe, roles, y_role)
        selected = dataframe.copy()
        if style.startswith("time_") or style.startswith("realtime_"):
            selected["ai22_time_sort"] = pd.to_datetime(selected[x_column], errors="coerce")
            selected = selected.sort_values("ai22_time_sort").drop(columns=["ai22_time_sort"])
        if style.startswith("realtime_"):
            selected = selected.tail(window_size)
        if style == "density":
            values = _amphi_ai22_numeric(selected, y_column).dropna().head(top_n).tolist()
            counts, edges = np.histogram(values, bins=min(20, max(5, int(math.sqrt(len(values))))), density=True)
            labels = [round(float(value), 3) for value in edges[:-1]]
            values = counts.astype(float).tolist()
        elif style == "scatter" or style == "bubble":
            x_values = _amphi_ai22_numeric(selected, x_column)
            y_values = _amphi_ai22_numeric(selected, y_column)
            valid = x_values.notna() & y_values.notna()
            selected = selected.loc[valid].head(top_n)
            labels = x_values.loc[selected.index].astype(float).round(3).astype(str).tolist()
            values = y_values.loc[selected.index].astype(float).tolist()
        else:
            labels, values = _amphi_ai22_aggregate(selected, x_column, y_column, aggregation, top_n)
        second_values = None
        if style in ("combo", "vertical_combo", "parallel"):
            second_column = _amphi_ai22_column(dataframe, roles, "value")
            _second_labels, second_values = _amphi_ai22_aggregate(selected, x_column, second_column, aggregation, top_n)
            second_values = second_values[:len(values)]
        sizes = None
        if style == "bubble":
            size_column = _amphi_ai22_column(selected, roles, "size")
            sizes = _amphi_ai22_numeric(selected, size_column).fillna(0).head(len(values)).tolist()
        body = _amphi_ai22_cartesian(labels, values, title, width, height, style, second_values=second_values, sizes=sizes, realtime=style == "realtime_line", refresh_seconds=refresh_seconds)

    document = _amphi_ai22_html_document(title, body)
    output_path.write_text(document, encoding="utf-8")
    result = dataframe.copy()
    output_column = "ai22_chart_path"
    if output_column in result.columns:
        output_column = "ai22_chart_path_output"
    result[output_column] = str(output_path)
    result["ai22_chart_type"] = str(chart_id)
    result["ai22_chart_rows"] = int(len(dataframe))
    try:
        from IPython.display import HTML, display
        display(HTML(filename=str(output_path)))
    except Exception:
        pass
    metrics = {
        "chart_id": str(chart_id),
        "chart_type": style,
        "chart_path": str(output_path),
        "input_rows": int(len(dataframe)),
        "rendered_points": int(point_count),
        "width": int(width),
        "height": int(height),
        "realtime": bool(style.startswith("realtime_")),
    }
    return result, metrics
`;
