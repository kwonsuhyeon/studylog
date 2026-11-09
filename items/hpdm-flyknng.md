---
title: flyKNNG 논문 배경지식 노트 (Tensor Core로 정확한 KNNG 만들기)
section: study
topics: [datamining]
kind: site
url: assets/hpdm-flyknng/index.html
date: 2026-11-09
course: 고성능데이터마이닝 (2026-2)
tags: [논문 발표, GPU, CUDA, Tensor Core, exact kNN, KNNG, top-k, 커널 융합, warp, flyKNNG]
public: false
source: 2026_phd/datamining/발표/논문발표/03_flyKNNG/flyKNNG_배경지식_노트.html
---

ICS '22 논문 flyKNNG(Ji & Wang)를 발표하기 전에 필요한 GPU 기초를 정리한 노트. thread·warp·block과 메모리 계층, Tiling과 Tensor Core MMA, 거리 계산을 행렬곱으로 바꾸는 항등식, on-the-fly top-k와 융합 커널, warp shuffle·divergence·pruning, Algorithm 1을 숫자 예제와 확인 문제로 풀었다. 절마다 Gemini TTS 음성 해설(4개)이 붙어 있다. 원본을 고치면 `assets/hpdm-flyknng/` 사본(index.html, audio/)도 다시 복사해야 한다.
