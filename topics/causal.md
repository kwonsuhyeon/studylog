---
title: 인과효과
updated: 2026-10-13
---

## 한 줄 정의

처치(개입)가 결과에 미치는 효과를 관찰 자료에서 추정하는 방법론. 인과 그래프(DAG)로 변수 사이의 가정을 그리고, 그 가정 아래 무엇을 통제해야 하는지 판단한다.

## 지금까지 정리한 것

- **인과 그래프 기초**: 뒷문 기준의 원전 [[papers:Pearl_2009_Causality\|Pearl (2009)]], 입문서 [[papers:Pearl_2018_Book-of-Why\|The Book of Why]], 강의 교재 [[papers:Neal_2020_Introduction-to-Causal-Inference\|Neal (2020)]], 조건화와 개입의 차이 [[papers:Shalizi_ADA_ch22_Graphical-Causal-Models\|Shalizi ch.22]]
- **통제변수와 편향**: 편향 증폭 (Pearl, 2010), 충돌변수 편향 (Elwert & Winship, 2014), 좋은 통제와 나쁜 통제 (Cinelli, Forney & Pearl, 2024)
- **교육연구 적용**: 통제변수를 인과 그래프로 다시 설명 ([[papers:Jung_2026_Control-Variables-Causal-Graph\|정, 2026]]), 매개변수 통제가 충돌변수를 열어 생기는 거짓 완전매개 ([[papers:Kim_2021_Validity-of-Full-Mediation-and-Control-Variables\|김, 2021]]), 도구변수의 세 조건 ([[papers:Gwak_2023_Instrumental-Variable-Analysis-Education\|곽, 2023]])
- **Causal ML**: ML + 식별 전략 (Hünermund, Kaminski & Schmitt, 2021)
- SCM 특강 대비로 만든 인과 그래프 스터디 HTML이 있다 (papers-wiki `wiki/study/`)

## 이어서 정리할 것

- [ ] 좋은 통제·나쁜 통제 사례집 (Cinelli et al., 2024) 읽고 교육연구 예시로 바꿔 보기
- [ ] 예측용 변수 선택과 인과 추정용 통제변수 선택의 차이 정리 ([[papers:Lee_2026_Multilevel-ML-Variable-Selection-Hierarchical-Prediction]])
