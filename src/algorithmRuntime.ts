export const algorithmRuntime = String.raw`
def run_amphi_zero_code_algorithm(
    dataframe,
    algorithm,
    kind,
    target_column=None,
    feature_columns=None,
    output_column="ml_output",
    options=None,
    random_seed=42,
):
    import math
    import json
    import re
    import numpy as np
    import pandas as pd

    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Input must be a pandas DataFrame.")
    if len(dataframe) == 0:
        raise ValueError("Input DataFrame must not be empty.")

    result = dataframe.copy()
    features = list(feature_columns or [])
    target = str(target_column or "").strip()
    output_name = str(output_column or "ml_output").strip() or "ml_output"
    if output_name in result.columns:
        raise ValueError("Output column already exists: %s" % output_name)
    seed = int(random_seed)
    if not isinstance(options, dict):
        options = {"parameter": options if options is not None else 3.0}

    def option(name, default):
        value = options.get(name, default)
        if isinstance(default, bool):
            return bool(value)
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)

    numeric_options = [
        float(value) for value in options.values()
        if isinstance(value, (int, float)) and not isinstance(value, bool)
    ]
    number = numeric_options[0] if numeric_options else 3.0

    def checked_columns(columns):
        missing = [column for column in columns if column not in result.columns]
        if missing:
            raise ValueError("Columns do not exist: %s" % missing)

    def numeric_matrix(columns):
        from sklearn.compose import ColumnTransformer
        from sklearn.impute import SimpleImputer
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OneHotEncoder, StandardScaler

        checked_columns(columns)
        numeric_columns = [column for column in columns if pd.api.types.is_numeric_dtype(result[column])]
        category_columns = [column for column in columns if column not in numeric_columns]
        transforms = []
        if numeric_columns:
            transforms.append(("numeric", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]), numeric_columns))
        if category_columns:
            transforms.append(("category", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]), category_columns))
        if not transforms:
            raise ValueError("Select at least one usable feature column.")
        transformer = ColumnTransformer(transforms, remainder="drop")
        return transformer, transformer.fit_transform(result[columns])

    if kind == "autolearning":
        selected_target = target
        selected_features = list(features)
        if algorithm == "oneClickModeling" and not selected_target:
            if not option("autoTarget", True):
                raise ValueError("Select a target column or enable automatic target selection.")
            selected_target = str(result.columns[-1])
        if algorithm != "autoClustering":
            if not selected_target or selected_target not in result.columns:
                raise ValueError("Automatic supervised learning requires a valid target column.")
            if not selected_features:
                selected_features = [
                    column for column in result.columns if column != selected_target
                ]
        candidate_runs = []
        if algorithm == "autoClustering":
            if not selected_features:
                selected_features = list(result.select_dtypes(include=[np.number]).columns)
            minimum = max(2, int(option("minClusters", 2)))
            maximum = min(
                len(result) - 1,
                max(minimum, int(option("maxClusters", 8)))
            )
            candidates = [
                ("kmeansClustering", "clustering", {"nClusters": count, "nInit": 10})
                for count in range(minimum, maximum + 1)
            ]
        else:
            labeled = result[selected_target].dropna()
            classification_task = (
                algorithm == "autoClassification"
                or (
                    algorithm in ("autoHyperparameterSearch", "oneClickModeling")
                    and (
                        not pd.api.types.is_numeric_dtype(labeled)
                        or int(labeled.nunique()) <= max(20, int(math.sqrt(max(1, len(labeled))))))
                )
            )
            if algorithm == "autoRegression":
                classification_task = False
            if classification_task:
                candidates = [
                    ("logisticClassifier", "classification", {"testSize": option("testSize", 0.2)}),
                    ("randomForestClassifier", "classification", {
                        "testSize": option("testSize", 0.2), "nEstimators": 100,
                        "maxDepth": 0, "minSamplesLeaf": 1
                    }),
                    ("gradientBoostingClassifier", "classification", {
                        "testSize": option("testSize", 0.2), "nEstimators": 100,
                        "learningRate": 0.1, "maxDepth": 3
                    }),
                    ("svmClassifier", "classification", {
                        "testSize": option("testSize", 0.2),
                        "regularization": 1, "gamma": 0.1
                    }),
                ]
            else:
                candidates = [
                    ("linearRegression", "regression", {
                        "testSize": option("testSize", 0.2), "fitIntercept": True
                    }),
                    ("ridgeRegression", "regression", {
                        "testSize": option("testSize", 0.2), "alpha": 1
                    }),
                    ("randomForestRegression", "regression", {
                        "testSize": option("testSize", 0.2), "nEstimators": 100,
                        "maxDepth": 0, "minSamplesLeaf": 1
                    }),
                    ("gradientBoostingRegression", "regression", {
                        "testSize": option("testSize", 0.2), "nEstimators": 100,
                        "learningRate": 0.1, "maxDepth": 3
                    }),
                ]
            candidates = candidates[:max(2, int(option("maxCandidates", len(candidates))))]
        for candidate_id, candidate_kind, candidate_options in candidates:
            try:
                candidate_output, candidate_model, candidate_metrics = run_amphi_zero_code_algorithm(
                    dataframe=result,
                    algorithm=candidate_id,
                    kind=candidate_kind,
                    target_column=selected_target,
                    feature_columns=selected_features,
                    output_column="__auto_candidate__",
                    options=candidate_options,
                    random_seed=seed,
                )
                if candidate_kind == "classification":
                    candidate_score = candidate_metrics.get("test_accuracy")
                    if candidate_score is None:
                        candidate_score = candidate_metrics.get("training_accuracy", 0.0)
                elif candidate_kind == "regression":
                    candidate_rmse = candidate_metrics.get("test_rmse")
                    if candidate_rmse is None:
                        candidate_rmse = candidate_metrics.get("rmse", float("inf"))
                    candidate_score = -float(candidate_rmse)
                else:
                    candidate_score = candidate_metrics.get("silhouette")
                    if candidate_score is None:
                        candidate_score = -1.0
                candidate_runs.append((
                    float(candidate_score), candidate_id, candidate_output,
                    candidate_model, candidate_metrics
                ))
            except Exception as candidate_error:
                candidate_runs.append((
                    -float("inf"), candidate_id, None, None,
                    {"error": str(candidate_error)}
                ))
        successful = [item for item in candidate_runs if item[2] is not None]
        if not successful:
            errors = {
                candidate_id: metrics.get("error")
                for _, candidate_id, _, _, metrics in candidate_runs
            }
            raise ValueError("All automatic candidates failed: %s" % errors)
        best = max(successful, key=lambda item: item[0])
        _, best_id, best_output, best_model, best_metrics = best
        best_output = best_output.rename(columns={"__auto_candidate__": output_name})
        metrics = dict(best_metrics)
        metrics.update({
            "algorithm": algorithm,
            "selected_algorithm": best_id,
            "candidate_scores": {
                candidate_id: (
                    None if not np.isfinite(score) else float(score)
                )
                for score, candidate_id, _, _, _ in candidate_runs
            },
            "automatic_features": selected_features,
            "automatic_target": selected_target,
            "output_column": output_name,
        })
        model = {
            "selected_algorithm": best_id,
            "fitted_model": best_model,
            "candidate_metrics": {
                candidate_id: candidate_metrics
                for _, candidate_id, _, _, candidate_metrics in candidate_runs
            },
        }
        return best_output, model, metrics

    if kind == "text":
        def tokenize_text(value):
            text_value = str(value or "")
            if option("lowercase", True):
                text_value = text_value.lower()
            tokens = re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]", text_value)
            minimum_length = max(1, int(option("minTokenLength", 1)))
            return [token for token in tokens if len(token) >= minimum_length]

        if algorithm == "textClassifier":
            if not target or target not in result.columns or not features:
                raise ValueError("Text classification requires a label column and a text column.")
            text_column = features[0]
            checked_columns([text_column])
            training_mask = result[target].notna()
            if int(training_mask.sum()) < 4 or int(result.loc[training_mask, target].nunique()) < 2:
                raise ValueError("Text classification requires at least four labeled rows and two classes.")
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            from sklearn.metrics import accuracy_score, f1_score
            from sklearn.model_selection import train_test_split
            from sklearn.pipeline import Pipeline
            texts = result[text_column].fillna("").astype(str)
            labels = result.loc[training_mask, target]
            model = Pipeline([
                ("vectorizer", TfidfVectorizer(
                    tokenizer=tokenize_text, token_pattern=None,
                    max_features=max(10, int(option("maxFeatures", 3000)))
                )),
                ("classifier", LogisticRegression(
                    C=max(0.01, option("regularization", 1)),
                    max_iter=500, random_state=seed
                )),
            ])
            test_accuracy = None
            test_f1 = None
            test_rows = 0
            class_count = int(labels.nunique())
            requested_test = min(0.5, max(0.05, option("testSize", 0.2)))
            test_count = max(class_count, int(math.ceil(len(labels) * requested_test)))
            if (
                len(labels) >= 6
                and int(labels.value_counts().min()) >= 2
                and len(labels) - test_count >= class_count
            ):
                x_fit, x_test, y_fit, y_test = train_test_split(
                    texts.loc[training_mask], labels,
                    test_size=test_count,
                    random_state=seed, stratify=labels
                )
                model.fit(x_fit, y_fit)
                test_predictions = model.predict(x_test)
                test_accuracy = float(accuracy_score(y_test, test_predictions))
                test_f1 = float(f1_score(y_test, test_predictions, average="weighted"))
                test_rows = int(len(y_test))
            model.fit(texts.loc[training_mask], labels)
            result[output_name] = model.predict(texts)
            metrics = {
                "algorithm": algorithm, "rows": int(len(result)),
                "training_rows": int(training_mask.sum()), "test_rows": test_rows,
                "test_accuracy": test_accuracy, "test_f1_weighted": test_f1,
                "text_column": text_column, "target_column": target,
                "output_column": output_name,
            }
            return result, model, metrics

        if not target or target not in result.columns:
            raise ValueError("Select a valid text column.")
        texts = result[target].fillna("").astype(str)
        from sklearn.feature_extraction.text import TfidfVectorizer

        if algorithm == "textTokenizer":
            result[output_name] = texts.map(lambda value: " ".join(tokenize_text(value)))
            model = {"tokenizer": "unicode_word_and_cjk", "options": options}
        elif algorithm == "informationExtraction":
            def extract_information(value):
                extracted = {}
                if option("extractEmail", True):
                    extracted["emails"] = re.findall(
                        r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", value
                    )
                if option("extractPhone", True):
                    extracted["phones"] = re.findall(
                        r"(?<!\d)(?:1[3-9]\d{9}|\d{3,4}-\d{7,8})(?!\d)", value
                    )
                if option("extractDate", True):
                    extracted["dates"] = re.findall(
                        r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?", value
                    )
                if option("extractNumber", True):
                    extracted["numbers"] = re.findall(r"[-+]?\d+(?:\.\d+)?", value)
                return json.dumps(extracted, ensure_ascii=False)
            result[output_name] = texts.map(extract_information)
            model = {"extractors": ["email", "phone", "date", "number"], "options": options}
        elif algorithm == "textFiltering":
            stopwords = {
                "的", "了", "和", "是", "在", "我", "有", "与", "及",
                "the", "a", "an", "is", "are", "and", "or", "of", "to"
            }
            def filter_text(value):
                cleaned = value
                if option("removeUrls", True):
                    cleaned = re.sub(r"https?://\S+|www\.\S+", " ", cleaned)
                cleaned = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", " ", cleaned)
                tokens = tokenize_text(cleaned)
                if option("removeStopwords", True):
                    tokens = [token for token in tokens if token not in stopwords]
                return " ".join(tokens)
            result[output_name] = texts.map(filter_text)
            model = {"stopwords": sorted(stopwords), "options": options}
        elif algorithm == "vectorSpaceModel":
            vectorizer = TfidfVectorizer(
                tokenizer=tokenize_text, token_pattern=None,
                max_features=max(10, int(option("maxFeatures", 1000))),
                ngram_range=(1, max(1, min(2, int(option("ngramMax", 1)))))
            )
            matrix = vectorizer.fit_transform(texts)
            result[output_name] = [
                row.toarray().ravel().round(8).tolist() for row in matrix
            ]
            model = vectorizer
        elif algorithm == "keywordExtraction":
            vectorizer = TfidfVectorizer(
                tokenizer=tokenize_text, token_pattern=None,
                max_features=max(10, int(option("maxFeatures", 2000)))
            )
            matrix = vectorizer.fit_transform(texts)
            terms = np.asarray(vectorizer.get_feature_names_out())
            top_k = max(1, int(option("topK", 5)))
            keywords = []
            for row in matrix:
                values = row.toarray().ravel()
                indices = values.argsort()[::-1]
                keywords.append(",".join(terms[indices[:top_k][values[indices[:top_k]] > 0]]))
            result[output_name] = keywords
            model = vectorizer
        elif algorithm == "namedEntityRecognition":
            def recognize_entities(value):
                entities = []
                entities.extend([
                    {"text": item, "type": "PERSON_OR_PROPER_NOUN"}
                    for item in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", value)
                ])
                if option("includeOrganizations", True):
                    entities.extend([
                        {"text": item, "type": "ORGANIZATION"}
                        for item in re.findall(
                            r"[\u4e00-\u9fffA-Za-z0-9]{2,}(?:公司|大学|学院|集团|银行|委员会)",
                            value
                        )
                    ])
                if option("includeDates", True):
                    entities.extend([
                        {"text": item, "type": "DATE"}
                        for item in re.findall(r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?", value)
                    ])
                if option("includeNumbers", True):
                    entities.extend([
                        {"text": item, "type": "NUMBER"}
                        for item in re.findall(r"[-+]?\d+(?:\.\d+)?", value)
                    ])
                return json.dumps(entities, ensure_ascii=False)
            result[output_name] = texts.map(recognize_entities)
            model = {"recognizer": "rule_based_multitype", "options": options}
        elif algorithm == "textSimilarity":
            if not features:
                raise ValueError("Text similarity requires a second text column.")
            second_column = features[0]
            checked_columns([second_column])
            second_texts = result[second_column].fillna("").astype(str)
            vectorizer = TfidfVectorizer(
                tokenizer=tokenize_text, token_pattern=None,
                max_features=max(10, int(option("maxFeatures", 2000))),
                ngram_range=(1, max(1, min(2, int(option("ngramMax", 2)))))
            )
            combined = pd.concat([texts, second_texts], ignore_index=True)
            vectors = vectorizer.fit_transform(combined)
            left = vectors[:len(result)]
            right = vectors[len(result):]
            similarities = np.asarray(left.multiply(right).sum(axis=1)).ravel()
            result[output_name] = similarities
            model = vectorizer
        elif algorithm == "sentimentAnalysis":
            positive = {
                "好", "优秀", "喜欢", "满意", "推荐", "开心", "成功", "赞",
                "good", "great", "excellent", "love", "happy", "recommend"
            }
            negative = {
                "差", "糟糕", "讨厌", "失望", "失败", "生气", "问题", "坏",
                "bad", "poor", "terrible", "hate", "sad", "fail"
            }
            threshold = max(0.0, option("neutralThreshold", 0))
            def sentiment(value):
                normalized_value = value.lower()
                score = sum(word in normalized_value for word in positive) - sum(
                    word in normalized_value for word in negative
                )
                if score > threshold:
                    return "正向"
                if score < -threshold:
                    return "负向"
                return "中性"
            result[output_name] = texts.map(sentiment)
            model = {"positive_words": positive, "negative_words": negative}
        elif algorithm == "topicModeling":
            from sklearn.decomposition import NMF
            vectorizer = TfidfVectorizer(
                tokenizer=tokenize_text, token_pattern=None,
                max_features=max(10, int(option("maxFeatures", 3000)))
            )
            matrix = vectorizer.fit_transform(texts)
            topic_count = max(2, min(
                int(option("nTopics", 5)), len(result), max(2, matrix.shape[1])
            ))
            estimator = NMF(
                n_components=topic_count, init="nndsvda",
                max_iter=max(50, int(option("maxIterations", 300))),
                random_state=seed
            )
            weights = estimator.fit_transform(matrix)
            result[output_name] = weights.argmax(axis=1).astype(int)
            model = {"vectorizer": vectorizer, "estimator": estimator}
        else:
            raise ValueError("Unknown text algorithm: %s" % algorithm)
        metrics = {
            "algorithm": algorithm, "rows": int(len(result)),
            "text_column": target, "output_column": output_name,
        }
        return result, model, metrics

    if kind == "ensemble":
        kind = "classification" if algorithm in (
            "baggingClassifier", "votingClassifier"
        ) else "regression"

    if kind == "deeplearning" and algorithm == "lstmForecast":
        kind = "timeseries"

    if kind == "deeplearning" and algorithm in ("rnnClassifier", "rnnRegressor"):
        if not target or target not in result.columns:
            raise ValueError("RNN requires a valid target column.")
        if not features:
            features = [column for column in result.columns if column != target]
        features = [column for column in features if column != target]
        transformer, matrix = numeric_matrix(features)
        matrix = np.asarray(matrix, dtype=float)
        hidden_units = max(4, int(option("hiddenUnits", 32)))
        radius = min(0.99, max(0.05, option("spectralRadius", 0.85)))
        rng = np.random.default_rng(seed)
        input_weights = rng.normal(
            0.0, 1.0 / math.sqrt(max(1, matrix.shape[1])),
            size=(matrix.shape[1], hidden_units)
        )
        recurrent_weights = rng.normal(
            0.0, 1.0 / math.sqrt(hidden_units),
            size=(hidden_units, hidden_units)
        )
        eigenvalues = np.linalg.eigvals(recurrent_weights)
        spectral = float(np.max(np.abs(eigenvalues)))
        if spectral > 0:
            recurrent_weights *= radius / spectral
        states = np.zeros((len(matrix), hidden_units), dtype=float)
        hidden = np.zeros(hidden_units, dtype=float)
        for row_index, row in enumerate(matrix):
            hidden = np.tanh(row.dot(input_weights) + hidden.dot(recurrent_weights))
            states[row_index] = hidden
        training_mask = result[target].notna()
        if int(training_mask.sum()) < 4:
            raise ValueError("RNN requires at least four labeled rows.")
        from sklearn.linear_model import LogisticRegression, Ridge
        from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
        from sklearn.model_selection import train_test_split
        if algorithm == "rnnClassifier":
            labels = result.loc[training_mask, target]
            if int(labels.nunique()) < 2:
                raise ValueError("RNN classification requires at least two classes.")
            estimator = LogisticRegression(
                C=max(0.01, option("regularization", 1)),
                max_iter=500, random_state=seed
            )
            labeled_states = states[training_mask.to_numpy()]
            test_accuracy = None
            test_f1 = None
            test_rows = 0
            class_count = int(labels.nunique())
            test_count = max(
                class_count,
                int(math.ceil(
                    len(labels) * min(0.5, max(0.05, option("testSize", 0.2)))
                ))
            )
            if (
                len(labels) - test_count >= class_count
                and int(labels.value_counts().min()) >= 2
            ):
                x_fit, x_test, y_fit, y_test = train_test_split(
                    labeled_states, labels, test_size=test_count,
                    random_state=seed, stratify=labels
                )
                evaluation_estimator = LogisticRegression(
                    C=max(0.01, option("regularization", 1)),
                    max_iter=500, random_state=seed
                )
                evaluation_estimator.fit(x_fit, y_fit)
                evaluation_predictions = evaluation_estimator.predict(x_test)
                test_accuracy = float(accuracy_score(y_test, evaluation_predictions))
                test_f1 = float(
                    f1_score(y_test, evaluation_predictions, average="weighted")
                )
                test_rows = int(len(y_test))
            estimator.fit(labeled_states, labels)
            predictions = estimator.predict(states)
            training_predictions = estimator.predict(labeled_states)
            metrics = {
                "algorithm": algorithm, "rows": int(len(result)),
                "training_rows": int(training_mask.sum()),
                "test_rows": test_rows,
                "test_accuracy": test_accuracy,
                "test_f1_weighted": test_f1,
                "training_accuracy": float(accuracy_score(labels, training_predictions)),
                "training_f1_weighted": float(
                    f1_score(labels, training_predictions, average="weighted")
                ),
                "hidden_units": hidden_units, "output_column": output_name,
            }
        else:
            numeric_target = pd.to_numeric(result[target], errors="coerce")
            valid_mask = numeric_target.notna()
            labels = numeric_target.loc[valid_mask]
            estimator = Ridge(alpha=max(0.0001, option("alpha", 1)))
            labeled_states = states[valid_mask.to_numpy()]
            test_mae = None
            test_rmse = None
            test_r2 = None
            test_rows = 0
            if len(labels) >= 6:
                x_fit, x_test, y_fit, y_test = train_test_split(
                    labeled_states, labels,
                    test_size=min(0.5, max(0.05, option("testSize", 0.2))),
                    random_state=seed
                )
                evaluation_estimator = Ridge(alpha=max(0.0001, option("alpha", 1)))
                evaluation_estimator.fit(x_fit, y_fit)
                evaluation_predictions = evaluation_estimator.predict(x_test)
                test_mae = float(mean_absolute_error(y_test, evaluation_predictions))
                test_rmse = float(
                    math.sqrt(mean_squared_error(y_test, evaluation_predictions))
                )
                test_r2 = (
                    float(r2_score(y_test, evaluation_predictions))
                    if len(y_test) > 1 else None
                )
                test_rows = int(len(y_test))
            estimator.fit(labeled_states, labels)
            predictions = estimator.predict(states)
            training_predictions = estimator.predict(labeled_states)
            metrics = {
                "algorithm": algorithm, "rows": int(len(result)),
                "training_rows": int(len(labels)),
                "test_rows": test_rows,
                "test_mae": test_mae,
                "test_rmse": test_rmse,
                "test_r2": test_r2,
                "mae": float(mean_absolute_error(labels, training_predictions)),
                "rmse": float(math.sqrt(mean_squared_error(labels, training_predictions))),
                "r2": float(r2_score(labels, training_predictions)),
                "hidden_units": hidden_units, "output_column": output_name,
            }
        result[output_name] = predictions
        model = {
            "transformer": transformer, "input_weights": input_weights,
            "recurrent_weights": recurrent_weights, "estimator": estimator,
        }
        return result, model, metrics

    if kind == "deeplearning":
        kind = "classification" if algorithm == "dnnClassifier" else "regression"

    if kind in ("classification", "regression"):
        if not target or target not in result.columns:
            raise ValueError("Select a valid target column.")
        if not features:
            features = [column for column in result.columns if column != target]
        features = [column for column in features if column != target]
        if not features:
            raise ValueError("Select at least one feature column.")
        checked_columns(features)
        training_mask = result[target].notna()
        if int(training_mask.sum()) < 3:
            raise ValueError("At least three rows with a non-missing target are required.")

        from sklearn.compose import TransformedTargetRegressor
        from sklearn.impute import SimpleImputer
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OneHotEncoder, StandardScaler
        from sklearn.compose import ColumnTransformer

        numeric_columns = [column for column in features if pd.api.types.is_numeric_dtype(result[column])]
        category_columns = [column for column in features if column not in numeric_columns]
        transforms = []
        if numeric_columns:
            transforms.append(("numeric", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]), numeric_columns))
        if category_columns:
            transforms.append(("category", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encode", OneHotEncoder(handle_unknown="ignore")),
            ]), category_columns))
        preprocess = ColumnTransformer(transforms, remainder="drop")

        if kind == "classification":
            from sklearn.ensemble import (
                BaggingClassifier, GradientBoostingClassifier,
                HistGradientBoostingClassifier, RandomForestClassifier,
                VotingClassifier
            )
            from sklearn.linear_model import LogisticRegression
            from sklearn.metrics import accuracy_score, f1_score
            from sklearn.naive_bayes import GaussianNB
            from sklearn.neighbors import KNeighborsClassifier
            from sklearn.neural_network import MLPClassifier
            from sklearn.svm import SVC
            from sklearn.tree import DecisionTreeClassifier

            y_train = result.loc[training_mask, target]
            if int(y_train.nunique()) < 2:
                raise ValueError("Classification requires at least two target classes.")
            voting_class_weights = [
                max(0.0, option("logisticWeight", 1)),
                max(0.0, option("forestWeight", 1)),
                max(0.0, option("svmWeight", 1)),
            ]
            if sum(voting_class_weights) <= 0:
                voting_class_weights = [1.0, 1.0, 1.0]
            estimators = {
                "c45PlusClassifier": DecisionTreeClassifier(
                    criterion="log_loss",
                    ccp_alpha=0.01 if option("pruning", True) else 0.0,
                    min_samples_leaf=max(1, int(option("minSamplesLeaf", 2))),
                    random_state=seed
                ),
                "xgboostClassifier": HistGradientBoostingClassifier(
                    max_iter=max(20, int(option("nEstimators", 100))),
                    learning_rate=max(0.001, option("learningRate", 0.1)),
                    max_depth=max(1, int(option("maxDepth", 6))),
                    random_state=seed
                ),
                "knnClassifier": KNeighborsClassifier(
                    n_neighbors=max(1, min(int(option("nNeighbors", 5)), int(training_mask.sum()))),
                    weights="distance" if option("distanceWeight", True) else "uniform"
                ),
                "naiveBayesClassifier": GaussianNB(
                    var_smoothing=max(0.0, option("varSmoothing", 0.000000001))
                ),
                "bpNeuralClassifier": MLPClassifier(
                    hidden_layer_sizes=(max(2, int(option("hiddenUnits", 32))),),
                    max_iter=max(50, int(option("maxIterations", 500))),
                    learning_rate_init=max(0.00001, option("learningRate", 0.001)),
                    random_state=seed
                ),
                "lhalfSparseClassifier": LogisticRegression(
                    penalty="l1", solver="liblinear",
                    C=max(0.01, option("regularization", 1)),
                    max_iter=max(100, int(option("maxIterations", 1000))),
                    random_state=seed
                ),
                "logisticClassifier": LogisticRegression(
                    C=max(0.01, option("regularization", 1)),
                    max_iter=max(100, int(option("maxIterations", 500))),
                    random_state=seed
                ),
                "svmClassifier": SVC(
                    C=max(0.01, option("regularization", 1)),
                    gamma=max(0.000001, option("gamma", 0.1)),
                    probability=True, random_state=seed
                ),
                "randomForestClassifier": RandomForestClassifier(
                    n_estimators=max(10, int(option("nEstimators", 100))),
                    max_depth=(None if int(option("maxDepth", 0)) <= 0 else int(option("maxDepth", 0))),
                    min_samples_leaf=max(1, int(option("minSamplesLeaf", 1))),
                    random_state=seed
                ),
                "gradientBoostingClassifier": GradientBoostingClassifier(
                    n_estimators=max(10, int(option("nEstimators", 100))),
                    learning_rate=max(0.001, option("learningRate", 0.1)),
                    max_depth=max(1, int(option("maxDepth", 3))),
                    random_state=seed
                ),
                "baggingClassifier": BaggingClassifier(
                    estimator=DecisionTreeClassifier(random_state=seed),
                    n_estimators=max(5, int(option("nEstimators", 50))),
                    max_samples=min(1.0, max(0.1, option("maxSamples", 0.8))),
                    max_features=min(1.0, max(0.1, option("maxFeatures", 1))),
                    random_state=seed
                ),
                "votingClassifier": VotingClassifier(
                    estimators=[
                        ("logistic", LogisticRegression(max_iter=500, random_state=seed)),
                        ("forest", RandomForestClassifier(n_estimators=100, random_state=seed)),
                        ("svm", SVC(probability=True, random_state=seed)),
                    ],
                    voting="soft",
                    weights=voting_class_weights,
                ),
                "dnnClassifier": MLPClassifier(
                    hidden_layer_sizes=(
                        max(4, int(option("hiddenUnits1", 64))),
                        max(2, int(option("hiddenUnits2", 32))),
                    ),
                    max_iter=max(50, int(option("maxIterations", 600))),
                    learning_rate_init=max(0.00001, option("learningRate", 0.001)),
                    random_state=seed
                ),
            }
            estimator = estimators.get(algorithm)
            if estimator is None:
                raise ValueError("Unknown classification algorithm: %s" % algorithm)
            if algorithm == "naiveBayesClassifier":
                from sklearn.preprocessing import FunctionTransformer
                preprocess = Pipeline([
                    ("columns", preprocess),
                    ("dense", FunctionTransformer(
                        lambda value: value.toarray() if hasattr(value, "toarray") else value
                    )),
                ])
            model = Pipeline([("preprocess", preprocess), ("model", estimator)])
            from sklearn.base import clone
            from sklearn.model_selection import train_test_split
            x_labeled = result.loc[training_mask, features]
            test_size = min(0.5, max(0.05, option("testSize", 0.2)))
            evaluation_accuracy = None
            evaluation_f1 = None
            evaluation_rows = 0
            if len(y_train) >= 6 and int(y_train.value_counts().min()) >= 2:
                x_fit, x_test, y_fit, y_test = train_test_split(
                    x_labeled, y_train, test_size=test_size,
                    random_state=seed, stratify=y_train
                )
                evaluation_model = clone(model)
                evaluation_model.fit(x_fit, y_fit)
                evaluation_predictions = evaluation_model.predict(x_test)
                evaluation_accuracy = float(accuracy_score(y_test, evaluation_predictions))
                evaluation_f1 = float(
                    f1_score(y_test, evaluation_predictions, average="weighted")
                )
                evaluation_rows = int(len(y_test))
            model.fit(x_labeled, y_train)
            predictions = model.predict(result[features])
            result[output_name] = predictions
            train_predictions = model.predict(result.loc[training_mask, features])
            metrics = {
                "algorithm": algorithm,
                "rows": int(len(result)),
                "training_rows": int(training_mask.sum()),
                "scoring_rows": int((~training_mask).sum()),
                "features": features,
                "test_rows": evaluation_rows,
                "test_accuracy": evaluation_accuracy,
                "test_f1_weighted": evaluation_f1,
                "training_accuracy": float(accuracy_score(y_train, train_predictions)),
                "training_f1_weighted": float(
                    f1_score(y_train, train_predictions, average="weighted")
                ),
                "output_column": output_name,
            }
            return result, model, metrics

        from sklearn.ensemble import (
            BaggingRegressor, GradientBoostingRegressor,
            RandomForestRegressor, VotingRegressor
        )
        from sklearn.isotonic import IsotonicRegression
        from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, Ridge
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        from sklearn.neural_network import MLPRegressor
        from sklearn.svm import SVR
        from sklearn.tree import DecisionTreeRegressor

        y_train = pd.to_numeric(result.loc[training_mask, target], errors="coerce")
        valid_target = y_train.notna()
        training_index = y_train.index[valid_target]
        y_train = y_train.loc[training_index]
        if len(y_train) < 3:
            raise ValueError("Regression requires at least three numeric target values.")
        if algorithm == "isotonicRegression":
            if len(features) != 1:
                raise ValueError("Isotonic regression requires exactly one feature column.")
            x_values = pd.to_numeric(result[features[0]], errors="coerce")
            fill_value = float(x_values.loc[training_index].median())
            x_values = x_values.fillna(fill_value)
            model = IsotonicRegression(
                increasing=option("increasing", True), out_of_bounds="clip"
            )
            model.fit(x_values.loc[training_index].to_numpy(), y_train.to_numpy())
            predictions = model.predict(x_values.to_numpy())
            train_predictions = model.predict(x_values.loc[training_index].to_numpy())
        else:
            voting_regression_weights = [
                max(0.0, option("linearWeight", 1)),
                max(0.0, option("forestWeight", 1)),
                max(0.0, option("boostingWeight", 1)),
            ]
            if sum(voting_regression_weights) <= 0:
                voting_regression_weights = [1.0, 1.0, 1.0]
            estimators = {
                "linearRegression": LinearRegression(
                    fit_intercept=option("fitIntercept", True)
                ),
                "svmRegression": SVR(
                    C=max(0.01, option("regularization", 1)),
                    epsilon=max(0.0, option("epsilon", 0.1)),
                    gamma=max(0.000001, option("gamma", 0.1))
                ),
                "gradientBoostingRegression": GradientBoostingRegressor(
                    n_estimators=max(10, int(option("nEstimators", 100))),
                    learning_rate=max(0.001, option("learningRate", 0.1)),
                    max_depth=max(1, int(option("maxDepth", 3))),
                    random_state=seed
                ),
                "bpNeuralRegression": MLPRegressor(
                    hidden_layer_sizes=(max(2, int(option("hiddenUnits", 32))),),
                    max_iter=max(50, int(option("maxIterations", 600))),
                    learning_rate_init=max(0.00001, option("learningRate", 0.001)),
                    random_state=seed
                ),
                "lhalfSparseRegression": Lasso(
                    alpha=max(0.0001, option("alpha", 0.01)),
                    max_iter=max(100, int(option("maxIterations", 5000)))
                ),
                "ridgeRegression": Ridge(alpha=max(0.0001, option("alpha", 1))),
                "lassoRegression": Lasso(
                    alpha=max(0.0001, option("alpha", 0.01)),
                    max_iter=max(100, int(option("maxIterations", 5000)))
                ),
                "randomForestRegression": RandomForestRegressor(
                    n_estimators=max(10, int(option("nEstimators", 100))),
                    max_depth=(None if int(option("maxDepth", 0)) <= 0 else int(option("maxDepth", 0))),
                    min_samples_leaf=max(1, int(option("minSamplesLeaf", 1))),
                    random_state=seed
                ),
                "elasticNetRegression": ElasticNet(
                    alpha=max(0.0001, option("alpha", 0.01)),
                    l1_ratio=min(1.0, max(0.0, option("l1Ratio", 0.5))),
                    max_iter=5000, random_state=seed
                ),
                "baggingRegressor": BaggingRegressor(
                    estimator=DecisionTreeRegressor(random_state=seed),
                    n_estimators=max(5, int(option("nEstimators", 50))),
                    max_samples=min(1.0, max(0.1, option("maxSamples", 0.8))),
                    max_features=min(1.0, max(0.1, option("maxFeatures", 1))),
                    random_state=seed
                ),
                "votingRegressor": VotingRegressor(
                    estimators=[
                        ("linear", LinearRegression()),
                        ("forest", RandomForestRegressor(n_estimators=100, random_state=seed)),
                        ("boosting", GradientBoostingRegressor(random_state=seed)),
                    ],
                    weights=voting_regression_weights,
                ),
                "dnnRegressor": MLPRegressor(
                    hidden_layer_sizes=(
                        max(4, int(option("hiddenUnits1", 64))),
                        max(2, int(option("hiddenUnits2", 32))),
                    ),
                    max_iter=max(50, int(option("maxIterations", 700))),
                    learning_rate_init=max(0.00001, option("learningRate", 0.001)),
                    random_state=seed
                ),
            }
            estimator = estimators.get(algorithm)
            if estimator is None:
                raise ValueError("Unknown regression algorithm: %s" % algorithm)
            model = Pipeline([("preprocess", preprocess), ("model", estimator)])
            from sklearn.base import clone
            from sklearn.model_selection import train_test_split
            x_labeled = result.loc[training_index, features]
            test_size = min(0.5, max(0.05, option("testSize", 0.2)))
            evaluation_mae = None
            evaluation_rmse = None
            evaluation_r2 = None
            evaluation_rows = 0
            if len(y_train) >= 6:
                x_fit, x_test, y_fit, y_test = train_test_split(
                    x_labeled, y_train, test_size=test_size, random_state=seed
                )
                evaluation_model = clone(model)
                evaluation_model.fit(x_fit, y_fit)
                evaluation_predictions = evaluation_model.predict(x_test)
                evaluation_mae = float(mean_absolute_error(y_test, evaluation_predictions))
                evaluation_rmse = float(
                    math.sqrt(mean_squared_error(y_test, evaluation_predictions))
                )
                evaluation_r2 = (
                    float(r2_score(y_test, evaluation_predictions))
                    if len(y_test) > 1 else None
                )
                evaluation_rows = int(len(y_test))
            model.fit(x_labeled, y_train)
            predictions = model.predict(result[features])
            train_predictions = model.predict(result.loc[training_index, features])
        result[output_name] = predictions
        metrics = {
            "algorithm": algorithm,
            "rows": int(len(result)),
            "training_rows": int(len(y_train)),
            "scoring_rows": int(len(result) - len(y_train)),
            "features": features,
            "test_rows": evaluation_rows if algorithm != "isotonicRegression" else 0,
            "test_mae": evaluation_mae if algorithm != "isotonicRegression" else None,
            "test_rmse": evaluation_rmse if algorithm != "isotonicRegression" else None,
            "test_r2": evaluation_r2 if algorithm != "isotonicRegression" else None,
            "mae": float(mean_absolute_error(y_train, train_predictions)),
            "rmse": float(math.sqrt(mean_squared_error(y_train, train_predictions))),
            "r2": float(r2_score(y_train, train_predictions)) if len(y_train) > 1 else 0.0,
            "output_column": output_name,
        }
        return result, model, metrics

    if kind == "clustering":
        if not features:
            features = list(result.select_dtypes(include=[np.number]).columns)
        if not features:
            raise ValueError("Clustering requires feature columns.")
        transformer, matrix = numeric_matrix(features)
        cluster_count = max(2, min(int(option("nClusters", 3)), len(result)))
        from sklearn.cluster import AgglomerativeClustering, DBSCAN, KMeans, SpectralClustering
        from sklearn.decomposition import PCA
        from sklearn.mixture import GaussianMixture
        from sklearn.metrics import silhouette_score

        if algorithm == "kmeansClustering":
            estimator = KMeans(
                n_clusters=cluster_count,
                n_init=max(1, int(option("nInit", 10))),
                random_state=seed
            )
            labels = estimator.fit_predict(matrix)
        elif algorithm == "emClustering":
            estimator = GaussianMixture(
                n_components=cluster_count,
                max_iter=max(10, int(option("maxIterations", 100))),
                random_state=seed
            )
            labels = estimator.fit_predict(matrix)
        elif algorithm == "twoStepClustering":
            micro_count = min(
                len(result),
                max(cluster_count, int(option("preClusters", cluster_count * 3)))
            )
            micro = KMeans(n_clusters=micro_count, n_init=10, random_state=seed).fit(matrix)
            hierarchy = AgglomerativeClustering(n_clusters=cluster_count).fit(micro.cluster_centers_)
            labels = hierarchy.labels_[micro.labels_]
            estimator = {"precluster": micro, "hierarchy": hierarchy}
        elif algorithm == "fuzzyCMeansClustering":
            estimator = KMeans(n_clusters=cluster_count, n_init=10, random_state=seed).fit(matrix)
            distances = estimator.transform(matrix)
            inverse = 1.0 / np.maximum(distances, 1e-9) ** 2
            memberships = inverse / inverse.sum(axis=1, keepdims=True)
            labels = memberships.argmax(axis=1)
        elif algorithm == "visualClustering":
            projection = PCA(n_components=min(2, matrix.shape[1]), random_state=seed).fit_transform(matrix)
            estimator = DBSCAN(
                eps=max(0.01, option("eps", 0.8)),
                min_samples=max(2, int(option("minSamples", 3)))
            )
            labels = estimator.fit_predict(projection)
        elif algorithm == "dbscanClustering":
            estimator = DBSCAN(
                eps=max(0.01, option("eps", 0.5)),
                min_samples=max(2, int(option("minSamples", 5)))
            )
            labels = estimator.fit_predict(matrix)
        elif algorithm == "agglomerativeClustering":
            estimator = AgglomerativeClustering(n_clusters=cluster_count)
            labels = estimator.fit_predict(matrix)
        elif algorithm == "spectralClustering":
            estimator = SpectralClustering(
                n_clusters=cluster_count, affinity="nearest_neighbors",
                n_neighbors=max(1, min(int(option("nNeighbors", 10)), len(result) - 1)),
                random_state=seed
            )
            labels = estimator.fit_predict(matrix)
        else:
            raise ValueError("Unknown clustering algorithm: %s" % algorithm)
        result[output_name] = np.asarray(labels, dtype=int)
        unique_labels = set(int(value) for value in labels if int(value) >= 0)
        silhouette = None
        if 1 < len(unique_labels) < len(result):
            silhouette = float(silhouette_score(matrix, labels))
        model = {"transformer": transformer, "estimator": estimator}
        metrics = {
            "algorithm": algorithm,
            "rows": int(len(result)),
            "clusters": int(len(unique_labels)),
            "noise_rows": int(np.sum(np.asarray(labels) < 0)),
            "silhouette": silhouette,
            "features": features,
            "output_column": output_name,
        }
        return result, model, metrics

    if kind == "association":
        if not target or target not in result.columns:
            raise ValueError("Select an item or transaction column.")
        min_support = min(1.0, max(0.01, option("minSupport", 0.1)))
        min_confidence = min(1.0, max(0.0, option("minConfidence", 0.5)))
        transactions = []
        for value in result[target].dropna():
            if isinstance(value, (list, tuple, set)):
                items = [str(item).strip() for item in value if str(item).strip()]
            else:
                items = [item.strip() for item in str(value).replace("，", ",").split(",") if item.strip()]
            if items:
                transactions.append(set(items))
        if not transactions:
            raise ValueError("No valid transactions were found.")
        from collections import Counter
        singles = Counter(item for transaction in transactions for item in transaction)
        pairs = Counter()
        for transaction in transactions:
            ordered = sorted(transaction)
            for left_index in range(len(ordered)):
                for right_index in range(left_index + 1, len(ordered)):
                    pairs[(ordered[left_index], ordered[right_index])] += 1
        rules = []
        for pair, count in pairs.items():
            support = count / len(transactions)
            if support < min_support:
                continue
            left, right = pair
            confidence = float(count / singles[left])
            if confidence < min_confidence:
                continue
            rules.append({
                "antecedent": left,
                "consequent": right,
                "support": float(support),
                "confidence": confidence,
                "lift": float((count / singles[left]) / (singles[right] / len(transactions))),
            })
        rules.sort(key=lambda rule: (rule["lift"], rule["support"]), reverse=True)
        top_rule = rules[0] if rules else None
        result[output_name] = None if top_rule is None else (
            top_rule["antecedent"] + " -> " + top_rule["consequent"]
        )
        model = {"frequent_items": dict(singles), "rules": rules, "method": algorithm}
        metrics = {
            "algorithm": algorithm,
            "transactions": int(len(transactions)),
            "frequent_items": int(sum(1 for count in singles.values() if count / len(transactions) >= min_support)),
            "rules": int(len(rules)),
            "min_support": float(min_support),
            "min_confidence": float(min_confidence),
            "output_column": output_name,
        }
        return result, model, metrics

    if kind == "timeseries":
        if not target or target not in result.columns:
            raise ValueError("Select a numeric value column.")
        values = pd.to_numeric(result[target], errors="coerce")
        if int(values.notna().sum()) < 3:
            raise ValueError("Time-series forecasting requires at least three numeric values.")
        values = values.interpolate(limit_direction="both").to_numpy(dtype=float)
        horizon = max(1, int(option("horizon", 3)))
        fitted = np.empty(len(values), dtype=float)
        fitted[0] = values[0]
        model = {"algorithm": algorithm}
        if algorithm == "lstmForecast":
            from sklearn.linear_model import Ridge
            hidden_units = max(4, int(option("hiddenUnits", 24)))
            value_mean = float(np.mean(values))
            value_scale = float(np.std(values))
            if value_scale <= 1e-12:
                value_scale = 1.0
            scaled_values = (values - value_mean) / value_scale
            rng = np.random.default_rng(seed)
            joined_size = hidden_units + 1
            weight_scale = 1.0 / math.sqrt(joined_size)
            input_gate_weights = rng.normal(0.0, weight_scale, size=(joined_size, hidden_units))
            forget_gate_weights = rng.normal(0.0, weight_scale, size=(joined_size, hidden_units))
            output_gate_weights = rng.normal(0.0, weight_scale, size=(joined_size, hidden_units))
            candidate_weights = rng.normal(0.0, weight_scale, size=(joined_size, hidden_units))
            forget_bias = option("forgetBias", 1.0)

            def sigmoid(value):
                return 1.0 / (1.0 + np.exp(-np.clip(value, -30.0, 30.0)))

            def advance_lstm(input_value, hidden_state, cell_state):
                joined = np.concatenate([[input_value], hidden_state])
                input_gate = sigmoid(joined.dot(input_gate_weights))
                forget_gate = sigmoid(joined.dot(forget_gate_weights) + forget_bias)
                output_gate = sigmoid(joined.dot(output_gate_weights))
                candidate = np.tanh(joined.dot(candidate_weights))
                next_cell = forget_gate * cell_state + input_gate * candidate
                next_hidden = output_gate * np.tanh(next_cell)
                return next_hidden, next_cell

            hidden = np.zeros(hidden_units, dtype=float)
            cell = np.zeros(hidden_units, dtype=float)
            states = []
            for value in scaled_values:
                hidden, cell = advance_lstm(value, hidden, cell)
                states.append(hidden.copy())
            states = np.asarray(states)
            estimator = Ridge(alpha=max(0.0001, option("alpha", 0.1)))
            estimator.fit(states[:-1], values[1:])
            fitted[1:] = estimator.predict(states[:-1])
            forecast = []
            forecast_hidden = hidden.copy()
            forecast_cell = cell.copy()
            for _ in range(horizon):
                next_value = float(estimator.predict(forecast_hidden.reshape(1, -1))[0])
                forecast.append(next_value)
                scaled_next = (next_value - value_mean) / value_scale
                forecast_hidden, forecast_cell = advance_lstm(
                    scaled_next, forecast_hidden, forecast_cell
                )
            model.update({
                "estimator": estimator, "hidden_units": hidden_units,
                "input_gate_weights": input_gate_weights,
                "forget_gate_weights": forget_gate_weights,
                "output_gate_weights": output_gate_weights,
                "candidate_weights": candidate_weights,
                "value_mean": value_mean, "value_scale": value_scale,
            })
        elif algorithm in ("movingAverageForecast", "arimaForecast"):
            window = max(2, min(int(option("window", option("p", 2))), len(values)))
            for index in range(1, len(values)):
                fitted[index] = float(np.mean(values[max(0, index - window):index]))
            forecast = [float(np.mean(values[-window:]))] * horizon
            model["window"] = window
        elif algorithm in ("exponentialSmoothingForecast", "holtWintersForecast"):
            alpha = min(1.0, max(0.01, option("alpha", 2.0 / (horizon + 2.0))))
            level = values[0]
            trend = values[1] - values[0]
            for index in range(1, len(values)):
                previous = level
                level = alpha * values[index] + (1.0 - alpha) * (level + trend)
                trend = alpha * (level - previous) + (1.0 - alpha) * trend
                fitted[index] = level
            forecast = [float(level + trend * step) for step in range(1, horizon + 1)]
            model.update({"level": float(level), "trend": float(trend), "alpha": float(alpha)})
        elif algorithm == "greyForecast":
            accumulated = np.cumsum(values)
            background = -0.5 * (accumulated[1:] + accumulated[:-1])
            design = np.column_stack([background, np.ones(len(background))])
            coefficients = np.linalg.lstsq(design, values[1:], rcond=None)[0]
            a_value, b_value = coefficients
            generated = [(values[0] - b_value / a_value) * np.exp(-a_value * index) + b_value / a_value
                         if abs(a_value) > 1e-9 else values[0] + b_value * index
                         for index in range(len(values) + horizon)]
            restored = np.diff([values[0]] + generated)
            fitted = np.asarray(restored[:len(values)], dtype=float)
            forecast = [float(value) for value in restored[len(values):]]
            model.update({"a": float(a_value), "b": float(b_value)})
        else:
            lag_count = max(1, min(int(option("lags", horizon)), len(values) - 2))
            rows = []
            labels = []
            for index in range(lag_count, len(values)):
                rows.append(values[index - lag_count:index])
                labels.append(values[index])
            from sklearn.linear_model import Lasso, Ridge
            estimator = (
                Lasso(alpha=max(0.0001, option("alpha", 0.001)), max_iter=5000)
                if algorithm == "sparseTimeSeriesForecast" else Ridge(alpha=1.0)
            )
            if algorithm == "echoStateNetworkForecast":
                rng = np.random.default_rng(seed)
                reservoir = rng.normal(0.0, 0.2, size=(lag_count, max(4, lag_count * 2)))
                transformed = np.tanh(np.asarray(rows).dot(reservoir))
                estimator.fit(transformed, labels)
                predict_one = lambda history: estimator.predict(np.tanh(np.asarray(history).reshape(1, -1).dot(reservoir)))[0]
                model["reservoir"] = reservoir
            else:
                estimator.fit(rows, labels)
                predict_one = lambda history: estimator.predict(np.asarray(history).reshape(1, -1))[0]
            for index in range(lag_count, len(values)):
                fitted[index] = float(predict_one(values[index - lag_count:index]))
            history = list(values)
            forecast = []
            for _ in range(horizon):
                next_value = float(predict_one(history[-lag_count:]))
                forecast.append(next_value)
                history.append(next_value)
            model["estimator"] = estimator
            model["lags"] = lag_count
        result[output_name] = fitted
        model["forecast"] = forecast
        metrics = {
            "algorithm": algorithm,
            "rows": int(len(result)),
            "horizon": int(horizon),
            "forecast": forecast,
            "mae_fitted": float(np.mean(np.abs(values[1:] - fitted[1:]))),
            "output_column": output_name,
        }
        return result, model, metrics

    if kind == "evaluation":
        if not features:
            features = list(result.select_dtypes(include=[np.number]).columns)
        checked_columns(features)
        matrix = result[features].apply(pd.to_numeric, errors="coerce")
        matrix = matrix.fillna(matrix.median()).fillna(0.0).to_numpy(dtype=float)
        minimum = matrix.min(axis=0)
        span = matrix.max(axis=0) - minimum
        normalized = (matrix - minimum) / np.where(span == 0.0, 1.0, span)
        if algorithm == "entropyWeightEvaluation":
            proportions = normalized / np.where(normalized.sum(axis=0) == 0.0, 1.0, normalized.sum(axis=0))
            log_values = np.where(proportions > 0.0, np.log(proportions), 0.0)
            entropy = -(proportions * log_values).sum(axis=0) / max(1e-9, math.log(len(matrix)))
            diversity = 1.0 - entropy
            weights = diversity / np.where(diversity.sum() == 0.0, 1.0, diversity.sum())
            scores = normalized.dot(weights)
        elif algorithm == "ahpEvaluation":
            weights = np.arange(len(features), 0, -1, dtype=float)
            weights = weights / weights.sum()
            scores = normalized.dot(weights)
        elif algorithm == "fuzzyComprehensiveEvaluation":
            weights = np.ones(len(features), dtype=float) / len(features)
            scores = np.power(
                normalized, max(0.01, option("membershipPower", 0.5))
            ).dot(weights)
        elif algorithm == "topsisEvaluation":
            weights = np.ones(len(features), dtype=float) / len(features)
            weighted = normalized * weights
            positive = weighted.max(axis=0)
            negative = weighted.min(axis=0)
            positive_distance = np.linalg.norm(weighted - positive, axis=1)
            negative_distance = np.linalg.norm(weighted - negative, axis=1)
            scores = negative_distance / np.maximum(positive_distance + negative_distance, 1e-12)
        elif algorithm == "pcaEvaluation":
            from sklearn.decomposition import PCA
            pca = PCA(n_components=1, random_state=seed)
            scores = pca.fit_transform(normalized).ravel()
            if np.corrcoef(scores, normalized.mean(axis=1))[0, 1] < 0:
                scores = -scores
            scores = (scores - scores.min()) / max(1e-12, scores.max() - scores.min())
            weights = np.abs(pca.components_[0])
            weights = weights / weights.sum()
        else:
            raise ValueError("Unknown evaluation algorithm: %s" % algorithm)
        result[output_name] = scores
        model = {"features": features, "weights": dict(zip(features, [float(value) for value in weights]))}
        metrics = {
            "algorithm": algorithm,
            "rows": int(len(result)),
            "features": features,
            "weights": model["weights"],
            "score_min": float(np.min(scores)),
            "score_max": float(np.max(scores)),
            "output_column": output_name,
        }
        return result, model, metrics

    if kind == "recommendation":
        columns = ([target] if target else []) + features
        columns = [column for index, column in enumerate(columns) if column and column not in columns[:index]]
        if len(columns) < 2:
            raise ValueError("Recommendation requires a user column and an item column.")
        checked_columns(columns)
        user_column, item_column = columns[:2]
        rating_column = columns[2] if len(columns) > 2 else None
        ratings = (
            pd.to_numeric(result[rating_column], errors="coerce").fillna(0.0)
            if rating_column else pd.Series(np.ones(len(result)), index=result.index)
        )
        table = pd.DataFrame({
            "user": result[user_column].astype(str),
            "item": result[item_column].astype(str),
            "rating": ratings,
        })
        pivot = table.pivot_table(index="user", columns="item", values="rating", aggfunc="mean", fill_value=0.0)
        if algorithm == "popularityRecommendation":
            item_scores = table.groupby("item")["rating"].agg(["count", "mean"])
            item_scores["score"] = item_scores["count"] * item_scores["mean"]
            scores = table["item"].map(item_scores["score"]).to_numpy(dtype=float)
            model = item_scores
        elif algorithm == "matrixFactorizationRecommendation":
            matrix = pivot.to_numpy(dtype=float)
            rank = max(1, min(int(option("factors", 8)), min(matrix.shape)))
            left, singular, right = np.linalg.svd(matrix, full_matrices=False)
            reconstructed = (left[:, :rank] * singular[:rank]).dot(right[:rank, :])
            scores = np.asarray([
                reconstructed[pivot.index.get_loc(row.user), pivot.columns.get_loc(row.item)]
                for row in table.itertuples()
            ])
            model = {"users": list(pivot.index), "items": list(pivot.columns), "rank": rank}
        else:
            global_mean = float(table["rating"].mean())
            user_mean = table.groupby("user")["rating"].mean()
            item_mean = table.groupby("item")["rating"].mean()
            if algorithm == "userCollaborativeFiltering":
                scores = table["user"].map(user_mean).fillna(global_mean).to_numpy(dtype=float)
            elif algorithm == "itemCollaborativeFiltering":
                scores = table["item"].map(item_mean).fillna(global_mean).to_numpy(dtype=float)
            else:
                scores = (
                    table["user"].map(user_mean).fillna(global_mean).to_numpy(dtype=float)
                    + table["item"].map(item_mean).fillna(global_mean).to_numpy(dtype=float)
                ) / 2.0
            model = {"user_mean": user_mean.to_dict(), "item_mean": item_mean.to_dict()}
        result[output_name] = scores
        metrics = {
            "algorithm": algorithm,
            "rows": int(len(result)),
            "users": int(table["user"].nunique()),
            "items": int(table["item"].nunique()),
            "rating_column": rating_column,
            "output_column": output_name,
        }
        return result, model, metrics

    raise ValueError("Unknown algorithm kind: %s" % kind)
`;
