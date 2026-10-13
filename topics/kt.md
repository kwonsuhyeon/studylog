---
title: 지식추적
parent: la
updated: 2026-10-13
---

## 한 줄 정의

학습자의 문항 풀이 기록으로 지식 상태가 시간에 따라 어떻게 변하는지 추정하고, 다음 응답을 예측하는 모형 계열 (knowledge tracing, KT).

## 지금까지 정리한 것

| 시기 | 흐름 | 대표 연구 |
|---|---|---|
| 1994~ | 확률모형 | BKT (Corbett & Anderson, 1994) |
| 2015~ | 딥러닝 | DKT (Piech et al., 2015), DKVMN (Zhang et al., 2017) |
| 2019~ | 어텐션 | SAKT (Pandey & Karypis, 2019), AKT (Ghosh et al., 2020) |
| 2019~ | 그래프·구조 | GKT (Nakagawa et al., 2019), [[papers:Fu_2024_SINKT-Structure-Aware-Inductive-Knowledge-Tracing-LLM\|SINKT]] |
| 2024~ | LLM | [[papers:Scarlatos_2025_Knowledge-Tracing-Tutor-Student-Dialogues-LLMKT\|LLMKT]], [[papers:Norris_2025_Next-Token-Knowledge-Tracing\|Next-Token KT]] |

- 확률모형 -> 딥러닝 -> 어텐션 -> 그래프 -> LLM 순으로 모형이 바뀌었다.
- 데이터와 지식요소(KC): 모형 비교 벤치마크 pyKT (Liu et al., 2022), 멀티모달 데이터셋 [[papers:Kim_2024_ES-KT-24-Multimodal-Knowledge-Tracing-Benchmark\|ES-KT-24]], LMM으로 KC 추출 [[papers:Moon_2025_LMM-Knowledge-Component-Extraction-Multimedia-Questions\|Moon 2025]] (인지진단의 Q행렬 구성과 같은 문제)

## 이어서 정리할 것

- [ ] BKT 원전(Corbett & Anderson, 1994) 읽고 핵심 가정 정리
- [ ] DKT · SAKT · AKT 비교표 (입력, 구조, 망각 반영 여부)
- [ ] KC 추출과 Q행렬 구성의 공통점을 인지진단 주제와 연결
