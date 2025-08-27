"""CSV export functionality for experiment data."""

import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from align_browser.experiment_models import (
    ExperimentData,
    InputOutputItem,
    parse_alignment_target_id,
)


def format_kdma_config(kdma_values: List[Dict[str, Any]]) -> str:
    """Format KDMA values as a configuration string."""
    if not kdma_values:
        return "unaligned"

    kdma_strings = []
    for kdma in kdma_values:
        kdma_name = kdma.get("kdma", "unknown")
        value = kdma.get("value", 0.0)
        kdma_strings.append(f"{kdma_name}:{value}")

    return ",".join(kdma_strings)


def extract_scene_id(item: InputOutputItem) -> str:
    """Extract the scene_id from an input/output item."""
    if not item.input.full_state:
        return ""

    meta_info = item.input.full_state.get("meta_info", {})
    return meta_info.get("scene_id", "")


def extract_choice_text(item: InputOutputItem) -> str:
    """Extract the human-readable choice text from an input/output item."""
    if not item.output or "choice" not in item.output:
        return ""

    choice_index = item.output.get("choice")
    if choice_index is None:
        return ""

    choices = item.input.choices
    if not choices or choice_index >= len(choices):
        return ""

    selected_choice = choices[choice_index]
    return selected_choice.get("unstructured", "")


def extract_choice_kdma(item: InputOutputItem) -> str:
    """Extract the KDMA association for the selected choice."""
    if not item.output or "choice" not in item.output:
        return ""

    choice_index = item.output.get("choice")
    if choice_index is None:
        return ""

    choices = item.input.choices
    if not choices or choice_index >= len(choices):
        return ""

    selected_choice = choices[choice_index]
    kdma_association = selected_choice.get("kdma_association", "")

    # Format the KDMA association dictionary as a string
    if isinstance(kdma_association, dict) and kdma_association:
        kdma_strings = []
        for kdma_name, value in kdma_association.items():
            kdma_strings.append(f"{kdma_name}:{value}")
        return ",".join(kdma_strings)

    return str(kdma_association) if kdma_association else ""


def extract_justification(item: InputOutputItem) -> str:
    """Extract the justification from an input/output item."""
    if not item.output:
        return ""

    action = item.output.get("action", {})
    return action.get("justification", "")


def extract_choice_info(item: InputOutputItem) -> str:
    """Extract the choice_info as a JSON string, truncating ICL examples."""
    if not item.choice_info:
        return ""

    import json

    # Create a copy to avoid modifying the original
    filtered_choice_info = {}

    for key, value in item.choice_info.items():
        if key == "icl_example_responses" and isinstance(value, dict):
            # Keep only first example for each KDMA, truncate the rest
            truncated_icl = {}
            for kdma, examples in value.items():
                if isinstance(examples, list) and len(examples) > 0:
                    # Keep first example, replace rest with "truncated"
                    truncated_icl[kdma] = [examples[0]]
                    if len(examples) > 1:
                        truncated_icl[kdma].append("truncated")
                else:
                    truncated_icl[kdma] = examples
            filtered_choice_info[key] = truncated_icl
        else:
            filtered_choice_info[key] = value

    return json.dumps(filtered_choice_info, separators=(",", ":"))


def get_decision_time(
    timing_data: Optional[Dict[str, Any]], item_index: int
) -> Optional[float]:
    """Get the decision time for a specific item index from timing data."""
    if not timing_data or "scenarios" not in timing_data:
        return None

    scenarios = timing_data.get("scenarios", [])
    if item_index >= len(scenarios):
        return None

    scenario_timing = scenarios[item_index]
    raw_times = scenario_timing.get("raw_times_s", [])

    # Use the first raw time as the decision time for this scenario
    if raw_times:
        return raw_times[0]

    # Fallback to average time if raw times not available
    return scenario_timing.get("avg_time_s")


def get_score(
    scores_data: Optional[Dict[str, Any]], item_index: int
) -> Optional[float]:
    """Get the score for a specific item index from scores data."""
    if not scores_data or "scores" not in scores_data:
        return None

    scores_list = scores_data.get("scores", [])
    if item_index >= len(scores_list):
        return None

    score_item = scores_list[item_index]
    return score_item.get("score")


def experiment_to_csv_rows(
    experiment: ExperimentData, experiments_root: Path
) -> List[Dict[str, Any]]:
    """Convert an experiment to CSV rows (one per scenario decision)."""
    rows = []

    # Get relative experiment path
    relative_path = experiment.experiment_path.relative_to(experiments_root)
    experiment_path_str = str(relative_path)

    # Get experiment metadata
    config = experiment.config
    adm_name = config.adm.name if config.adm else "unknown"
    llm_backbone = (
        config.adm.llm_backbone if config.adm and config.adm.llm_backbone else "no_llm"
    )
    run_variant = config.run_variant if config.run_variant else "default"

    # Parse alignment target to get KDMA config
    alignment_target_id = (
        config.alignment_target.id if config.alignment_target else "unaligned"
    )
    kdma_values = parse_alignment_target_id(alignment_target_id)
    kdma_config = format_kdma_config(
        [{"kdma": kv.kdma, "value": kv.value} for kv in kdma_values]
    )

    # Load timing data if available
    timing_data = None
    if experiment.timing:
        timing_data = experiment.timing.model_dump()

    # Load scores data if available
    scores_data = None
    if experiment.scores:
        scores_data = experiment.scores.model_dump()

    # Process each input/output item
    for idx, item in enumerate(experiment.input_output.data):
        row = {
            "experiment_path": experiment_path_str,
            "adm_name": adm_name,
            "llm_backbone": llm_backbone,
            "run_variant": run_variant,
            "kdma_config": kdma_config,
            "alignment_target_id": alignment_target_id,
            "scenario_id": item.input.scenario_id,
            "scene_id": extract_scene_id(item),
            "state_description": item.input.state
            if hasattr(item.input, "state")
            else "",
            "choice_text": extract_choice_text(item),
            "choice_kdma_association": extract_choice_kdma(item),
            "choice_info": extract_choice_info(item),
            "justification": extract_justification(item),
            "decision_time_s": get_decision_time(timing_data, idx),
            "score": get_score(scores_data, idx),
        }

        # Convert None values to empty strings for CSV
        for key, value in row.items():
            if value is None:
                row[key] = ""

        rows.append(row)

    return rows


def write_experiments_to_csv(
    experiments: List[ExperimentData], experiments_root: Path, output_file: Path
) -> None:
    """Write all experiments to a CSV file."""

    # Define CSV columns in order
    fieldnames = [
        "experiment_path",
        "adm_name",
        "llm_backbone",
        "run_variant",
        "kdma_config",
        "alignment_target_id",
        "scenario_id",
        "scene_id",
        "state_description",
        "choice_kdma_association",
        "choice_text",
        "choice_info",
        "justification",
        "decision_time_s",
        "score",
    ]

    all_rows = []

    # Convert all experiments to CSV rows
    for experiment in experiments:
        try:
            rows = experiment_to_csv_rows(experiment, experiments_root)
            all_rows.extend(rows)
        except Exception as e:
            print(
                f"Warning: Failed to export experiment {experiment.experiment_path}: {e}"
            )
            continue

    # Write CSV file
    with open(output_file, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)
