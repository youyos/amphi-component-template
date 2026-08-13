export const modelEvaluationRuntime = String.raw`
import base64
import hashlib
import json
import math
import pickle
from pathlib import Path

import numpy as np
import pandas as pd


def _amphi_ai14_decode(value):
    if not value:
        return ""
    return base64.b64decode(str(value)).decode("utf-8")


def _amphi_ai14_dataframe(value, label):
    if not isinstance(value, pd.DataFrame):
        raise TypeError("%s must be a pandas DataFrame." % label)
    return value


def _amphi_ai14_column(dataframe, encoded_name, label, required=True):
    name = _amphi_ai14_decode(encoded_name).strip()
    if not name and required:
        raise ValueError("Select %s." % label)
    if name and name not in dataframe.columns:
        raise ValueError("Column does not exist: %s" % name)
    return name


def _amphi_ai14_model_identity(model_name_base64, model_path_base64):
    model_name = _amphi_ai14_decode(model_name_base64).strip() or "model"
    model_path = _amphi_ai14_decode(model_path_base64).strip()
    return model_name, model_path


def _amphi_ai14_binary_target(series, positive_label):
    values = series.dropna()
    unique = list(pd.unique(values))
    if len(unique) != 2:
        raise ValueError("Binary evaluation requires exactly two target classes.")
    requested = str(positive_label).strip()
    if requested:
        matched = [value for value in unique if str(value) == requested]
        if not matched:
            raise ValueError("Positive label does not exist: %s" % requested)
        positive = matched[0]
    else:
        positive = sorted(unique, key=lambda value: str(value))[-1]
    return (series == positive).astype(int), str(positive)


def _amphi_ai14_summary_frame(method, model_name, model_path, metric_name, metric_value, details):
    row = {
        "evaluation_method": method,
        "model_name": model_name,
        "model_path": model_path,
        "metric_name": metric_name,
        "metric_value": float(metric_value),
    }
    row.update(details)
    return pd.DataFrame([row])


def evaluate_amphi_ai14_model(
    dataframe,
    method,
    target_column_base64,
    prediction_column_base64,
    score_column_base64="",
    positive_label_base64="",
    model_name_base64="",
    model_path_base64="",
):
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        balanced_accuracy_score,
        f1_score,
        mean_absolute_error,
        mean_absolute_percentage_error,
        mean_squared_error,
        precision_recall_curve,
        precision_score,
        r2_score,
        recall_score,
        roc_auc_score,
        roc_curve,
    )

    source = _amphi_ai14_dataframe(dataframe, "Input")
    target_column = _amphi_ai14_column(
        source, target_column_base64, "the actual target column"
    )
    prediction_required = method in ("classification", "regression")
    prediction_column = _amphi_ai14_column(
        source,
        prediction_column_base64,
        "the prediction column",
        required=prediction_required,
    )
    score_column = _amphi_ai14_column(
        source, score_column_base64, "the probability or score column", required=False
    )
    model_name, model_path = _amphi_ai14_model_identity(
        model_name_base64, model_path_base64
    )
    positive_label = _amphi_ai14_decode(positive_label_base64)

    if method in ("ks", "pr", "roc"):
        selected_score = score_column or prediction_column
        if not selected_score:
            raise ValueError("Select a numeric probability or score column.")
        selected = source[[target_column, selected_score]].copy()
        selected[selected_score] = pd.to_numeric(selected[selected_score], errors="coerce")
        selected = selected.dropna()
        if len(selected) < 2:
            raise ValueError("At least two valid scored rows are required.")
        binary_target, actual_positive = _amphi_ai14_binary_target(
            selected[target_column], positive_label
        )
        scores = selected[selected_score].astype(float).to_numpy()
        y_true = binary_target.to_numpy()

        if method == "roc":
            fpr, tpr, thresholds = roc_curve(y_true, scores)
            metric_value = float(roc_auc_score(y_true, scores))
            result = pd.DataFrame(
                {"threshold": thresholds, "false_positive_rate": fpr, "true_positive_rate": tpr}
            )
            metric_name = "roc_auc"
        elif method == "pr":
            precision, recall, thresholds = precision_recall_curve(y_true, scores)
            padded_thresholds = np.append(thresholds, np.nan)
            metric_value = float(average_precision_score(y_true, scores))
            result = pd.DataFrame(
                {"threshold": padded_thresholds, "precision": precision, "recall": recall}
            )
            metric_name = "average_precision"
        else:
            order = np.argsort(-scores, kind="mergesort")
            ordered_scores = scores[order]
            ordered_target = y_true[order]
            positive_total = int(ordered_target.sum())
            negative_total = int(len(ordered_target) - positive_total)
            if positive_total == 0 or negative_total == 0:
                raise ValueError("K-S evaluation requires positive and negative rows.")
            cumulative_positive = np.cumsum(ordered_target) / positive_total
            cumulative_negative = np.cumsum(1 - ordered_target) / negative_total
            ks_values = np.abs(cumulative_positive - cumulative_negative)
            best_index = int(np.argmax(ks_values))
            metric_value = float(ks_values[best_index])
            result = pd.DataFrame(
                {
                    "threshold": ordered_scores,
                    "cumulative_positive_rate": cumulative_positive,
                    "cumulative_negative_rate": cumulative_negative,
                    "ks_value": ks_values,
                }
            )
            result["is_best_threshold"] = False
            result.loc[best_index, "is_best_threshold"] = True
            metric_name = "ks_statistic"

        result["evaluation_method"] = method
        result["model_name"] = model_name
        result["model_path"] = model_path
        result["metric_name"] = metric_name
        result["metric_value"] = metric_value
        result["positive_label"] = actual_positive
        metrics = {
            "method": method,
            "rows": int(len(selected)),
            "metric_name": metric_name,
            "metric_value": metric_value,
            "positive_label": actual_positive,
            "model_name": model_name,
        }
        if method == "ks":
            metrics["best_threshold"] = float(result.loc[result["is_best_threshold"], "threshold"].iloc[0])
        return result, metrics

    selected = source[[target_column, prediction_column]].dropna().copy()
    if len(selected) < 2:
        raise ValueError("At least two valid prediction rows are required.")

    if method == "classification":
        y_true = selected[target_column]
        y_prediction = selected[prediction_column]
        details = {
            "accuracy": float(accuracy_score(y_true, y_prediction)),
            "balanced_accuracy": float(balanced_accuracy_score(y_true, y_prediction)),
            "precision_weighted": float(precision_score(y_true, y_prediction, average="weighted", zero_division=0)),
            "recall_weighted": float(recall_score(y_true, y_prediction, average="weighted", zero_division=0)),
            "f1_weighted": float(f1_score(y_true, y_prediction, average="weighted", zero_division=0)),
            "rows": int(len(selected)),
        }
        metric_name = "f1_weighted"
        metric_value = details[metric_name]
    elif method == "regression":
        y_true = pd.to_numeric(selected[target_column], errors="coerce")
        y_prediction = pd.to_numeric(selected[prediction_column], errors="coerce")
        valid = y_true.notna() & y_prediction.notna()
        y_true = y_true.loc[valid].astype(float)
        y_prediction = y_prediction.loc[valid].astype(float)
        if len(y_true) < 2:
            raise ValueError("Regression evaluation requires two valid numeric rows.")
        mse = float(mean_squared_error(y_true, y_prediction))
        nonzero = y_true != 0
        mape = float(mean_absolute_percentage_error(y_true.loc[nonzero], y_prediction.loc[nonzero])) if nonzero.any() else math.nan
        details = {
            "mae": float(mean_absolute_error(y_true, y_prediction)),
            "mse": mse,
            "rmse": float(math.sqrt(mse)),
            "r2": float(r2_score(y_true, y_prediction)),
            "mape": mape,
            "rows": int(len(y_true)),
        }
        metric_name = "rmse"
        metric_value = details[metric_name]
    else:
        raise ValueError("Unsupported evaluation method: %s" % method)

    result = _amphi_ai14_summary_frame(
        method, model_name, model_path, metric_name, metric_value, details
    )
    metrics = dict(details)
    metrics.update(
        {
            "method": method,
            "metric_name": metric_name,
            "metric_value": float(metric_value),
            "model_name": model_name,
        }
    )
    return result, metrics


def select_amphi_ai14_best_model(
    dataframe,
    metric_column_base64="",
    model_column_base64="",
    path_column_base64="",
    direction="auto",
):
    source = _amphi_ai14_dataframe(dataframe, "Evaluation input").copy()
    metric_column = _amphi_ai14_decode(metric_column_base64).strip() or "metric_value"
    model_column = _amphi_ai14_decode(model_column_base64).strip() or "model_name"
    path_column = _amphi_ai14_decode(path_column_base64).strip() or "model_path"
    for column in (metric_column, model_column):
        if column not in source.columns:
            raise ValueError("Column does not exist: %s" % column)
    source[metric_column] = pd.to_numeric(source[metric_column], errors="coerce")
    source = source.dropna(subset=[metric_column])
    if source.empty:
        raise ValueError("No valid model metric values were found.")
    if path_column not in source.columns:
        source[path_column] = ""
    candidates = source.drop_duplicates(subset=[model_column], keep="first").copy()
    requested_direction = str(direction or "auto").lower()
    if requested_direction == "auto":
        lower_names = ("loss", "error", "mae", "mse", "rmse", "mape")
        direction_hint = metric_column.lower()
        if metric_column == "metric_value" and "metric_name" in candidates.columns:
            metric_names = candidates["metric_name"].dropna().astype(str).unique()
            if len(metric_names) == 1:
                direction_hint = metric_names[0].lower()
        requested_direction = "min" if any(name in direction_hint for name in lower_names) else "max"
    if requested_direction not in ("min", "max"):
        raise ValueError("Direction must be auto, min, or max.")
    ascending = requested_direction == "min"
    candidates = candidates.sort_values(metric_column, ascending=ascending, kind="mergesort").reset_index(drop=True)
    candidates["model_rank"] = np.arange(1, len(candidates) + 1)
    candidates["is_best_model"] = candidates["model_rank"] == 1
    best = candidates.iloc[0]
    metrics = {
        "candidate_count": int(len(candidates)),
        "best_model": str(best[model_column]),
        "best_model_path": str(best[path_column]),
        "metric_column": metric_column,
        "best_metric": float(best[metric_column]),
        "direction": requested_direction,
    }
    return candidates, metrics


def _amphi_ai14_absolute_path(value, must_exist=False):
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Model file path is empty.")
    path = Path(raw).expanduser()
    candidates = [path]
    if path.is_absolute():
        candidates.append(Path.cwd() / raw.lstrip("/\\"))
    else:
        candidates.append(Path.cwd() / path)
    if must_exist:
        for candidate in candidates:
            if candidate.is_file():
                return candidate.resolve()
        raise FileNotFoundError("Model file does not exist: %s" % raw)
    if path.is_absolute() and not path.parent.exists():
        jupyter_path = Path.cwd() / raw.lstrip("/\\")
        if jupyter_path.parent.exists():
            path = jupyter_path
    elif not path.is_absolute():
        path = Path.cwd() / path
    return path.absolute()


def _amphi_ai14_file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _amphi_ai14_dump_model(model, path, serialization_format):
    selected_format = str(serialization_format or "joblib").lower()
    if selected_format == "auto":
        selected_format = "pickle" if path.suffix.lower() in (".pkl", ".pickle") else "joblib"
    if selected_format == "joblib":
        import joblib
        joblib.dump(model, path)
    elif selected_format == "pickle":
        with path.open("wb") as stream:
            pickle.dump(model, stream, protocol=pickle.HIGHEST_PROTOCOL)
    else:
        raise ValueError("Serialization format must be joblib, pickle, or auto.")
    return selected_format


def _amphi_ai14_load_model(path):
    if path.suffix.lower() in (".pkl", ".pickle"):
        with path.open("rb") as stream:
            return pickle.load(stream), "pickle"
    import joblib
    return joblib.load(path), "joblib"


def _amphi_ai14_descriptor(model, path, serialization_format, registry_key, rows=0, model_variable=""):
    features = list(getattr(model, "feature_names_in_", []))
    return pd.DataFrame(
        [
            {
                "amphi_model_path": str(path),
                "amphi_model_format": serialization_format,
                "amphi_model_sha256": _amphi_ai14_file_sha256(path),
                "amphi_model_registry_key": registry_key,
                "amphi_model_variable": model_variable,
                "amphi_model_type": type(model).__name__,
                "amphi_model_rows": int(rows),
                "amphi_model_features_json": json.dumps(features, ensure_ascii=False),
            }
        ]
    )


def export_amphi_ai14_model(
    dataframe,
    model_variable_base64,
    output_path_base64,
    serialization_format="joblib",
):
    source = _amphi_ai14_dataframe(dataframe, "Model output input")
    model_variable = _amphi_ai14_decode(model_variable_base64).strip()
    output_path = _amphi_ai14_decode(output_path_base64).strip()
    if not model_variable:
        raise ValueError("Model variable name is empty.")
    if model_variable not in globals():
        raise ValueError("Model variable does not exist: %s" % model_variable)
    if not output_path:
        raise ValueError("Model output path is empty.")
    model = globals()[model_variable]
    path = _amphi_ai14_absolute_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    actual_format = _amphi_ai14_dump_model(model, path, serialization_format)
    registry = globals().setdefault("_amphi_ai14_model_registry", {})
    registry_key = path.stem
    registry[registry_key] = model
    descriptor = _amphi_ai14_descriptor(
        model, path, actual_format, registry_key, len(source), model_variable
    )
    metrics = descriptor.iloc[0].to_dict()
    metrics["artifact_bytes"] = int(path.stat().st_size)
    print("Model exported to:", path)
    return descriptor, metrics


def read_amphi_ai14_model(model_path_base64, registry_key_base64=""):
    model_path = _amphi_ai14_decode(model_path_base64).strip()
    if not model_path:
        raise ValueError("Model input path is empty.")
    path = _amphi_ai14_absolute_path(model_path, must_exist=True)
    model, actual_format = _amphi_ai14_load_model(path)
    registry_key = _amphi_ai14_decode(registry_key_base64).strip() or path.stem
    registry = globals().setdefault("_amphi_ai14_model_registry", {})
    registry[registry_key] = model
    descriptor = _amphi_ai14_descriptor(
        model, path, actual_format, registry_key
    )
    metrics = descriptor.iloc[0].to_dict()
    metrics["artifact_bytes"] = int(path.stat().st_size)
    return descriptor, metrics


def _amphi_ai14_unwrap_model(model):
    current = model
    visited = set()
    while isinstance(current, dict) and id(current) not in visited:
        visited.add(id(current))
        next_model = None
        for key in ("fitted_model", "model", "estimator"):
            candidate = current.get(key)
            if candidate is not None:
                next_model = candidate
                break
        if next_model is None:
            break
        current = next_model
    return current


def use_amphi_ai14_model(
    first_dataframe,
    second_dataframe,
    feature_columns=None,
    output_column_base64="",
    include_probability=True,
):
    first = _amphi_ai14_dataframe(first_dataframe, "First input")
    second = _amphi_ai14_dataframe(second_dataframe, "Second input")
    first_is_descriptor = "amphi_model_path" in first.columns
    second_is_descriptor = "amphi_model_path" in second.columns
    if first_is_descriptor == second_is_descriptor:
        raise ValueError("Connect one scoring DataFrame and one model descriptor DataFrame.")
    descriptor = first if first_is_descriptor else second
    scoring = second if first_is_descriptor else first
    if descriptor.empty:
        raise ValueError("Model descriptor is empty.")
    descriptor_row = descriptor.iloc[0]
    registry_key = str(descriptor_row.get("amphi_model_registry_key", ""))
    registry = globals().setdefault("_amphi_ai14_model_registry", {})
    model = registry.get(registry_key) if registry_key else None
    if model is None:
        path = _amphi_ai14_absolute_path(
            descriptor_row["amphi_model_path"], must_exist=True
        )
        model, _ = _amphi_ai14_load_model(path)
        if registry_key:
            registry[registry_key] = model
    estimator = _amphi_ai14_unwrap_model(model)
    if not hasattr(estimator, "predict"):
        raise TypeError("Loaded model does not provide predict().")
    features = [str(column) for column in (feature_columns or []) if str(column)]
    if not features:
        features = [str(column) for column in getattr(estimator, "feature_names_in_", [])]
    if not features:
        features = [column for column in scoring.columns if not str(column).startswith("amphi_model_")]
    missing = [column for column in features if column not in scoring.columns]
    if missing:
        raise ValueError("Feature columns do not exist: %s" % missing)
    if not features:
        raise ValueError("Select at least one model feature column.")
    output_column = _amphi_ai14_decode(output_column_base64).strip() or "model_prediction"
    result = scoring.copy()
    if output_column in result.columns:
        output_column = "%s_ai14" % output_column
    predictions = estimator.predict(result[features])
    result[output_column] = predictions
    probability_column = ""
    if include_probability and hasattr(estimator, "predict_proba"):
        probabilities = np.asarray(estimator.predict_proba(result[features]))
        if probabilities.ndim == 2 and probabilities.shape[1] >= 2:
            probability_column = "%s_probability" % output_column
            result[probability_column] = probabilities[:, -1]
    metrics = {
        "rows": int(len(result)),
        "features": features,
        "output_column": output_column,
        "probability_column": probability_column,
        "model_type": type(estimator).__name__,
        "registry_key": registry_key,
    }
    return result, metrics
`;
