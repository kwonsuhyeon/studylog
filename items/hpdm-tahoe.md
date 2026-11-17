---
title: Tahoe 학습 노트 (GPU 결정트리 앙상블 추론 엔진)
section: study
topics: [datamining]
kind: site
url: assets/hpdm-tahoe/index.html
date: 2026-11-16
course: 고성능데이터마이닝 (2026-2)
tags: [데이터마이닝, GPU, 결정트리, 추론엔진, Tahoe, FIL, SimHash, LSH, 성능 모델]
public: false
source: 2026_phd/papers-study/Xie_2021_Tahoe/Xie_2021_Tahoe_배경지식_노트.html
---

EuroSys '21 논문 Tahoe(Xie 외)를 읽기 위한 학습 자료다. Tahoe는 학습이 끝난 결정트리 앙상블을 GPU에서 빠르게 추론하는 엔진으로, 간선 확률과 트리 유사도로 노드와 트리를 재배치한 적응형 포레스트 형식, 추론 전략 네 가지, 전략을 고르는 성능 모델로 이루어진다. 배경지식 노트는 결정트리 추론, 간선·노드 확률, reorg 형식, 메모리 병합 접근, 부하 불균형, 리덕션, shared memory 전략, SimHash, LSH, 분석적 성능 모델을 숫자 예제와 확인 문제로 풀었다. 논문 해설은 본문 1~9절을 절 순서대로 따라간다. 그림·표 해설은 모든 Figure와 Table의 축·범례 읽는 법과 저자의 주장을 카드로 정리했다. 결정 트리 앙상블 노트는 random forest와 GBDT가 트리를 만들고 합치는 과정을 광고 클릭 예측 예시 하나로 따라간다. 원본을 고치면 `assets/hpdm-tahoe/` 사본도 다시 복사해야 한다.

- [듣기 전용 페이지](../assets/hpdm-tahoe/listen.html) — 휴대폰에서 연속 재생
- [배경지식 노트](../assets/hpdm-tahoe/index.html)
- [결정 트리 앙상블 노트](../assets/hpdm-tahoe/Xie_2021_Tahoe_결정트리_앙상블_노트.html) — random forest와 GBDT, 포레스트와 앙상블 용어 정리
- [논문 해설](../assets/hpdm-tahoe/Xie_2021_Tahoe_논문_해설.html)
- [그림·표 해설](../assets/hpdm-tahoe/Xie_2021_Tahoe_그림표_해설.html) — Figure 9개와 Table 3개를 카드 한 장씩으로
- [번역 읽기](../assets/hpdm-tahoe/Xie_2021_Tahoe_번역.html) — 원문 CC BY 4.0
- [개념 색인](../assets/concepts-datamining/index.html)
- 음성 8개, 약 43분: 노트 A 5.4분 · B 5.3분 · C 5.2분 · D 5.5분, 해설 E 5.3분 · F 5.4분 · G 5.5분 · H 5.4분
- [[papers:Xie_2021_Tahoe-Tree-Structure-Aware-High-Performance|papers-wiki 노트]]
- 서재 번역: http://127.0.0.1:8780/library/itbb0228 (이 PC에서만 열림)
- 질문하며 읽기: 터미널에서 `/paper-coach Xie_2021_Tahoe`
