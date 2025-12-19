"""
Comprehensive Baseline Evaluation Suite
=======================================
Run all baseline configurations against EdgeJury API for research paper.

Baselines:
1. Single Model - Chairman only
2. Self-Consistency (k=3) - Same model sampled 3 times
3. Self-Consistency (k=5) - Same model sampled 5 times
4. Majority Vote - All council models, pick most common
5. EdgeJury Full - All 4 stages
6. EdgeJury w/out Stage 2 - No cross-review
7. EdgeJury w/out Stage 3 - No chairman (use top-ranked)
8. EdgeJury w/out Stage 4 - No verification
9. EdgeJury Roles Off - All models same prompt
"""

import asyncio
import aiohttp
import json
import time
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import statistics
import random

API_URL = "https://edge-jury-worker.aayushakumars.workers.dev"

@dataclass
class BaselineConfig:
    name: str
    description: str
    council_size: int = 3
    enable_cross_review: bool = True
    verification_mode: str = "consistency"
    use_roles: bool = True
    use_chairman: bool = True
    samples_per_query: int = 1  # For self-consistency

BASELINE_CONFIGS = {
    "single_model": BaselineConfig(
        name="Single Model",
        description="Single LLM with no council deliberation",
        council_size=1,
        enable_cross_review=False,
        verification_mode="off",
    ),
    "self_consistency_3": BaselineConfig(
        name="Self-Consistency (k=3)",
        description="Same model sampled 3 times, vote on answer",
        council_size=1,
        enable_cross_review=False,
        verification_mode="off",
        samples_per_query=3,
    ),
    "self_consistency_5": BaselineConfig(
        name="Self-Consistency (k=5)", 
        description="Same model sampled 5 times, vote on answer",
        council_size=1,
        enable_cross_review=False,
        verification_mode="off",
        samples_per_query=5,
    ),
    "majority_vote": BaselineConfig(
        name="Majority Vote",
        description="All council models, pick most common answer",
        council_size=3,
        enable_cross_review=False,
        verification_mode="off",
        use_chairman=False,
    ),
    "edgejury_full": BaselineConfig(
        name="EdgeJury Full",
        description="Full 4-stage pipeline with all features",
        council_size=3,
        enable_cross_review=True,
        verification_mode="consistency",
    ),
    "edgejury_no_stage2": BaselineConfig(
        name="EdgeJury (No Cross-Review)",
        description="Skip Stage 2 cross-review",
        council_size=3,
        enable_cross_review=False,
        verification_mode="consistency",
    ),
    "edgejury_no_stage4": BaselineConfig(
        name="EdgeJury (No Verification)",
        description="Skip Stage 4 verification",
        council_size=3,
        enable_cross_review=True,
        verification_mode="off",
    ),
    "edgejury_minimal": BaselineConfig(
        name="EdgeJury Minimal",
        description="No cross-review, no verification",
        council_size=3,
        enable_cross_review=False,
        verification_mode="off",
    ),
}


@dataclass 
class EvalResult:
    question_id: str
    question: str
    expected: str
    response: str
    baseline: str
    correct: bool
    latency_ms: float
    tokens: int = 0
    stage_latencies: Dict[str, float] = field(default_factory=dict)
    claims_verified: int = 0
    claims_uncertain: int = 0
    claims_contradicted: int = 0


class BaselineEvaluator:
    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url
    
    async def query(self, question: str, config: BaselineConfig) -> Dict[str, Any]:
        """Send query with given configuration"""
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            payload = {
                "message": question,
                "council_size": config.council_size,
                "enable_cross_review": config.enable_cross_review,
                "verification_mode": config.verification_mode,
            }
            
            async with session.post(
                f"{self.base_url}/api/chat",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as resp:
                result = {
                    "response": "",
                    "stage1": None,
                    "stage2": None,
                    "stage3": None,
                    "stage4": None,
                    "latencies": {},
                    "total_latency": 0,
                    "tokens": 0,
                }
                
                current_event = None
                stage_start = start_time
                
                async for line in resp.content:
                    line = line.decode('utf-8').strip()
                    
                    if line.startswith('event: '):
                        current_event = line[7:]
                    elif line.startswith('data: ') and current_event:
                        try:
                            data = json.loads(line[6:])
                            
                            if current_event == 'stage1.complete':
                                result['stage1'] = data.get('results', [])
                                result['latencies']['stage1'] = (time.time() - stage_start) * 1000
                                result['tokens'] += sum(r.get('tokens_used', 0) for r in result['stage1'])
                                stage_start = time.time()
                            elif current_event == 'stage2.complete':
                                result['stage2'] = data.get('results', [])
                                result['latencies']['stage2'] = (time.time() - stage_start) * 1000
                                stage_start = time.time()
                            elif current_event == 'stage3.complete':
                                result['stage3'] = data.get('result', {})
                                result['response'] = result['stage3'].get('final_answer', '')
                                result['latencies']['stage3'] = (time.time() - stage_start) * 1000
                                stage_start = time.time()
                            elif current_event == 'stage4.complete':
                                result['stage4'] = data.get('result', {})
                                result['latencies']['stage4'] = (time.time() - stage_start) * 1000
                        except json.JSONDecodeError:
                            pass
                        current_event = None
                
                result['total_latency'] = (time.time() - start_time) * 1000
                return result
    
    async def run_self_consistency(self, question: str, k: int) -> Dict[str, Any]:
        """Run same query k times and vote on answer"""
        config = BaselineConfig(
            name=f"Self-Consistency (k={k})",
            description="",
            council_size=1,
            enable_cross_review=False,
            verification_mode="off",
        )
        
        responses = []
        total_latency = 0
        
        for _ in range(k):
            result = await self.query(question, config)
            responses.append(result['response'])
            total_latency += result['total_latency']
            await asyncio.sleep(0.5)  # Rate limiting
        
        # Simple majority vote (return most common response or first)
        from collections import Counter
        most_common = Counter(responses).most_common(1)[0][0] if responses else ""
        
        return {
            "response": most_common,
            "total_latency": total_latency,
            "samples": k,
            "all_responses": responses,
        }


def semantic_match(response: str, expected: str, keywords: List[str] = None) -> bool:
    """Better matching using key concepts"""
    response_lower = response.lower()
    expected_lower = expected.lower()
    
    # Extract key concepts (words > 3 chars, not common words)
    stop_words = {'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'about', 'into', 'through', 'during', 'before', 'after', 'because', 'just', 'over', 'also', 'some', 'than', 'then', 'only', 'come', 'made', 'find', 'here', 'many', 'like', 'more', 'very', 'your', 'does', 'does'}
    
    key_words = [w for w in expected_lower.split() if len(w) > 3 and w not in stop_words]
    
    if not key_words:
        return expected_lower in response_lower
    
    # Check for keyword matches
    matches = sum(1 for w in key_words if w in response_lower)
    match_ratio = matches / len(key_words) if key_words else 0
    
    # Also check for negation patterns
    expected_negations = ['no', 'not', 'never', 'false', "don't", "doesn't", "won't", "can't"]
    response_negations = sum(1 for n in expected_negations if n in response_lower)
    expected_neg_count = sum(1 for n in expected_negations if n in expected_lower)
    
    # If expected has negation and response doesn't (or vice versa), penalize
    negation_match = (response_negations > 0) == (expected_neg_count > 0)
    
    return match_ratio >= 0.4 and negation_match


async def run_baseline_eval(
    config: BaselineConfig,
    questions: List[Dict],
    evaluator: BaselineEvaluator
) -> List[EvalResult]:
    """Run evaluation for a single baseline configuration"""
    results = []
    
    print(f"\n📊 Running {config.name}...")
    
    for i, q in enumerate(questions):
        print(f"  [{i+1}/{len(questions)}] {q['question'][:50]}...")
        
        try:
            if config.samples_per_query > 1:
                # Self-consistency mode
                resp = await evaluator.run_self_consistency(
                    q['question'], 
                    config.samples_per_query
                )
            else:
                resp = await evaluator.query(q['question'], config)
            
            answer = resp.get('response', '')
            
            # Get verification claims if available
            stage4 = resp.get('stage4', {})
            claims = stage4.get('claims', []) if stage4 else []
            
            result = EvalResult(
                question_id=q.get('id', f'q_{i}'),
                question=q['question'],
                expected=q.get('answer', q.get('expected', '')),
                response=answer,
                baseline=config.name,
                correct=semantic_match(answer, q.get('answer', q.get('expected', ''))),
                latency_ms=resp.get('total_latency', 0),
                tokens=resp.get('tokens', 0),
                stage_latencies=resp.get('latencies', {}),
                claims_verified=sum(1 for c in claims if c.get('label') in ['verified', 'consistent']),
                claims_uncertain=sum(1 for c in claims if c.get('label') == 'uncertain'),
                claims_contradicted=sum(1 for c in claims if c.get('label') == 'contradicted'),
            )
            results.append(result)
            
        except Exception as e:
            print(f"    ⚠️ Error: {e}")
            results.append(EvalResult(
                question_id=q.get('id', f'q_{i}'),
                question=q['question'],
                expected=q.get('answer', q.get('expected', '')),
                response=f"ERROR: {e}",
                baseline=config.name,
                correct=False,
                latency_ms=0,
            ))
        
        await asyncio.sleep(1)  # Rate limiting
    
    return results


def generate_results_table(all_results: Dict[str, List[EvalResult]], dataset_name: str) -> str:
    """Generate markdown results table"""
    
    report = f"""# Baseline Evaluation Results

## Dataset: {dataset_name}
Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}

## Main Results Table

| Baseline | Accuracy | Avg Latency | P95 Latency | Tokens |
|----------|----------|-------------|-------------|--------|
"""
    
    for baseline_name, results in all_results.items():
        if not results:
            continue
            
        accuracy = sum(1 for r in results if r.correct) / len(results) * 100
        latencies = [r.latency_ms for r in results if r.latency_ms > 0]
        tokens = sum(r.tokens for r in results)
        
        avg_lat = statistics.mean(latencies) if latencies else 0
        p95_lat = sorted(latencies)[int(len(latencies)*0.95)] if len(latencies) > 1 else (latencies[0] if latencies else 0)
        
        report += f"| {baseline_name} | {accuracy:.1f}% | {avg_lat:.0f}ms | {p95_lat:.0f}ms | {tokens} |\n"
    
    # Add verification stats for full pipeline
    if "EdgeJury Full" in all_results:
        full_results = all_results["EdgeJury Full"]
        total_verified = sum(r.claims_verified for r in full_results)
        total_uncertain = sum(r.claims_uncertain for r in full_results)
        total_contradicted = sum(r.claims_contradicted for r in full_results)
        total = total_verified + total_uncertain + total_contradicted
        
        if total > 0:
            report += f"""

## Verification Analysis (EdgeJury Full)

| Label | Count | Percentage |
|-------|-------|------------|
| Verified/Consistent | {total_verified} | {total_verified/total*100:.1f}% |
| Uncertain | {total_uncertain} | {total_uncertain/total*100:.1f}% |
| Contradicted | {total_contradicted} | {total_contradicted/total*100:.1f}% |
"""
    
    # Stage latency breakdown
    if "EdgeJury Full" in all_results:
        full_results = all_results["EdgeJury Full"]
        report += "\n## Stage Latency Breakdown (EdgeJury Full)\n\n"
        report += "| Stage | Avg (ms) | P50 (ms) | P95 (ms) |\n"
        report += "|-------|----------|----------|----------|\n"
        
        for stage in ['stage1', 'stage2', 'stage3', 'stage4']:
            lats = [r.stage_latencies.get(stage, 0) for r in full_results if r.stage_latencies.get(stage)]
            if lats:
                avg = statistics.mean(lats)
                p50 = statistics.median(lats)
                p95 = sorted(lats)[int(len(lats)*0.95)] if len(lats) > 1 else lats[0]
                report += f"| {stage.upper()} | {avg:.0f} | {p50:.0f} | {p95:.0f} |\n"
    
    return report


async def main():
    parser = argparse.ArgumentParser(description="Baseline Evaluation Suite")
    parser.add_argument("--dataset", type=str, default="truthfulqa", 
                       help="Dataset to use: truthfulqa, edge_cases, or path to JSON")
    parser.add_argument("--samples", type=int, default=50, help="Number of samples")
    parser.add_argument("--baselines", type=str, default="all",
                       help="Comma-separated baselines or 'all'")
    parser.add_argument("--output", type=str, default="eval/results/baselines.md")
    args = parser.parse_args()
    
    # Load dataset
    dataset_path = Path(__file__).parent.parent / f"datasets/{args.dataset}.json"
    if args.dataset.endswith('.json'):
        dataset_path = Path(args.dataset)
    
    with open(dataset_path) as f:
        dataset = json.load(f)
    
    questions = dataset.get('questions', dataset)[:args.samples]
    print(f"📂 Loaded {len(questions)} questions from {dataset_path.name}")
    
    # Select baselines
    if args.baselines == "all":
        baselines_to_run = list(BASELINE_CONFIGS.keys())
    else:
        baselines_to_run = [b.strip() for b in args.baselines.split(',')]
    
    evaluator = BaselineEvaluator()
    all_results = {}
    
    for baseline_key in baselines_to_run:
        if baseline_key not in BASELINE_CONFIGS:
            print(f"⚠️ Unknown baseline: {baseline_key}")
            continue
        
        config = BASELINE_CONFIGS[baseline_key]
        results = await run_baseline_eval(config, questions, evaluator)
        all_results[config.name] = results
        
        accuracy = sum(1 for r in results if r.correct) / len(results) * 100
        print(f"  ✅ {config.name}: {accuracy:.1f}% accuracy")
    
    # Generate report
    report = generate_results_table(all_results, args.dataset)
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report)
    
    print(f"\n📊 Results saved to {output_path}")
    print(report)
    
    # Also save raw results as JSON
    raw_output = output_path.with_suffix('.json')
    raw_data = {
        baseline: [
            {
                "question_id": r.question_id,
                "question": r.question,
                "expected": r.expected,
                "response": r.response[:500],  # Truncate for size
                "correct": r.correct,
                "latency_ms": r.latency_ms,
            }
            for r in results
        ]
        for baseline, results in all_results.items()
    }
    raw_output.write_text(json.dumps(raw_data, indent=2))
    print(f"📋 Raw results saved to {raw_output}")


if __name__ == "__main__":
    asyncio.run(main())
