---
title: 영상처리
updated: 2026-10-20
---

## 한 줄 정의

영상의 화소 값을 바꾸는 필터링, 화소 위치를 바꾸는 워핑, 두 영상을 자연스럽게 합치는 블렌딩, 영상 복원을 최적화 문제로 푸는 방법까지 다루는 분야. 지능형영상처리 수업(2026-2) 내용을 기준으로 정리한다.

## 지금까지 정리한 것

- **필터링**: 합성곱 정의, box·Gaussian·sharpening 커널, separable 조건(랭크 1)과 계산량 M²N² → 2NM², Sobel·DoG·LoG
- **주파수 영역**: 합성곱 정리, FFT 계산량 O(N log N), ideal 필터의 ringing과 Gaussian 필터, JPEG
- **에지 보존 필터**: bilateral(공간 × 밝기 가중치), guided filter(q = aI + b), summed area table
- **블렌딩**: 알파 블렌딩과 feathering, 창 크기(ghosting·seam), 다중 대역(주파수 기반), 포아송(gradient 기반)
- **워핑**: 2×2 선형 변환, 동차 좌표, 변환 계층별 자유도(2·3·4·6·8), 정방향·역방향 워핑
- **전역 최적화**: ill-posed·ill-conditioned, 데이터 항 + 정규화 항, MAP과 정규화 에너지의 관계

## 이어서 정리할 것

- [ ] 중간고사 이후 9주차부터의 수업 내용
- [ ] 중간고사 문제와 답 복기
