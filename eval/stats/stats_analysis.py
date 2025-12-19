"""
Statistical Analysis for EdgeJury Evaluation
=============================================
Generate confidence intervals, significance tests, and plots.
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple
import random


def bootstrap_ci(data: List[float], n_bootstrap: int = 1000, ci: float = 0.95) -> Tuple[float, float, float]:
    """
    Calculate bootstrap confidence interval for mean.
    Returns (mean, lower_bound, upper_bound)
    """
    if not data:
        return (0, 0, 0)
    
    data = np.array(data)
    n = len(data)
    
    # Generate bootstrap samples
    bootstrap_means = []
    for _ in range(n_bootstrap):
        sample = np.random.choice(data, size=n, replace=True)
        bootstrap_means.append(np.mean(sample))
    
    bootstrap_means = np.array(bootstrap_means)
    
    # Calculate percentiles
    alpha = (1 - ci) / 2
    lower = np.percentile(bootstrap_means, alpha * 100)
    upper = np.percentile(bootstrap_means, (1 - alpha) * 100)
    
    return (np.mean(data), lower, upper)


def paired_t_test(baseline: List[float], treatment: List[float]) -> Tuple[float, float]:
    """
    Paired t-test for significance.
    Returns (t_statistic, p_value)
    """
    from scipy import stats
    
    if len(baseline) != len(treatment):
        raise ValueError("Arrays must have same length")
    
    t_stat, p_value = stats.ttest_rel(treatment, baseline)
    return (t_stat, p_value)


def mcnemar_test(baseline_correct: List[bool], treatment_correct: List[bool]) -> Tuple[float, float]:
    """
    McNemar's test for paired binary outcomes.
    Returns (chi2, p_value)
    """
    from scipy import stats
    
    if len(baseline_correct) != len(treatment_correct):
        raise ValueError("Arrays must have same length")
    
    # Build contingency table
    b = sum(1 for i in range(len(baseline_correct)) 
            if baseline_correct[i] and not treatment_correct[i])  # baseline right, treatment wrong
    c = sum(1 for i in range(len(baseline_correct)) 
            if not baseline_correct[i] and treatment_correct[i])  # baseline wrong, treatment right
    
    # McNemar's test (with continuity correction)
    if b + c == 0:
        return (0, 1.0)
    
    chi2 = ((abs(b - c) - 1) ** 2) / (b + c)
    p_value = 1 - stats.chi2.cdf(chi2, 1)
    
    return (chi2, p_value)


def generate_stats_report(results_path: str, output_path: str = "eval/stats/report.md"):
    """Generate statistical analysis report"""
    
    with open(results_path) as f:
        results = json.load(f)
    
    report = """# Statistical Analysis Report

Generated from evaluation results.

## Confidence Intervals (95%, Bootstrap n=1000)

| Baseline | Accuracy | CI Lower | CI Upper |
|----------|----------|----------|----------|
"""
    
    baseline_data = {}
    
    for baseline_name, items in results.items():
        correct = [1 if item.get('correct', False) else 0 for item in items]
        baseline_data[baseline_name] = correct
        
        mean, lower, upper = bootstrap_ci(correct)
        report += f"| {baseline_name} | {mean*100:.1f}% | {lower*100:.1f}% | {upper*100:.1f}% |\n"
    
    # Significance tests vs strongest baseline
    if 'Single Model' in baseline_data and 'EdgeJury Full' in baseline_data:
        report += """

## Significance Tests (EdgeJury Full vs Single Model)

| Test | Statistic | p-value | Significant (α=0.05) |
|------|-----------|---------|---------------------|
"""
        baseline = baseline_data['Single Model']
        treatment = baseline_data['EdgeJury Full']
        
        chi2, p_val = mcnemar_test(
            [bool(x) for x in baseline],
            [bool(x) for x in treatment]
        )
        sig = "✅ Yes" if p_val < 0.05 else "❌ No"
        report += f"| McNemar's | {chi2:.3f} | {p_val:.4f} | {sig} |\n"
    
    # Ablation analysis
    report += """

## Ablation Analysis

| Configuration | Δ Accuracy | p-value | Contribution |
|---------------|------------|---------|--------------|
"""
    
    if 'EdgeJury Full' in baseline_data:
        full_accuracy = sum(baseline_data['EdgeJury Full']) / len(baseline_data['EdgeJury Full'])
        
        for name, data in baseline_data.items():
            if name == 'EdgeJury Full':
                continue
            if not name.startswith('EdgeJury'):
                continue
                
            accuracy = sum(data) / len(data)
            delta = full_accuracy - accuracy
            
            _, p_val = mcnemar_test(
                [bool(x) for x in data],
                [bool(x) for x in baseline_data['EdgeJury Full']]
            )
            
            contribution = "Significant" if p_val < 0.05 else "Not significant"
            report += f"| {name} | {delta*100:+.1f}% | {p_val:.4f} | {contribution} |\n"
    
    report += """

## Notes

- Confidence intervals calculated using bootstrap resampling (n=1000)
- McNemar's test used for paired binary outcomes
- α = 0.05 significance level
"""
    
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(report)
    print(f"📊 Stats report saved to {output_path}")
    return report


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        results_path = sys.argv[1]
    else:
        results_path = "eval/results/baselines.json"
    
    output_path = sys.argv[2] if len(sys.argv) > 2 else "eval/stats/report.md"
    
    try:
        report = generate_stats_report(results_path, output_path)
        print(report)
    except Exception as e:
        print(f"Error: {e}")
        print("Usage: python stats_analysis.py [results.json] [output.md]")
