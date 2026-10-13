---
title: 온톨로지(지식그래프)
papers: [온톨로지, 지식그래프]
updated: 2026-10-13
---

## 한 줄 정의

특정 분야의 개념과 유형이 가진 속성과 관계를 누구나 같은 뜻으로 읽도록 명시해 둔 지식 체계. 개념화의 명시적 명세(explicit specification of a conceptualization)로 정의한다 ([[papers:Gruber_1993_Toward-Principles-Ontology-Design\|Gruber, 1993]]).

## 지금까지 정리한 것

**기본 구성 요소** ([[papers:Ontology-Knowledge-Graph-Ch-1-S01-오리엔테이션-및-기본-개념\|강의 1주차 S01]])

| 요소 | 뜻 | 예 |
|---|---|---|
| 개체 | 사물이나 개념의 구체물 | 서울대학교 |
| 범주 | 사물이나 개념에 붙이는 이름 | 학생, 교수, 교육기관 |
| 속성 | 범주나 개체의 특정한 성질 | 학생-학과, 학번 |
| 관계 | 범주-범주, 개체-개체 사이의 관계 | 교수 a는 학생 b의 지도교수 |

- **온톨로지와 지식 그래프**: 온톨로지는 설계도, 지식 그래프는 구현물. 지식 그래프는 (Head Entity, Relation, Tail Entity) 트리플로 저장한다. 온톨로지 없이도 지식 그래프는 만들 수 있지만, 있으면 개념과 용어가 통일된다.
- **Taxonomy · Thesaurus와의 차이**: Taxonomy는 상하위 분류(트리), Thesaurus는 동의어·상위어·관련어 관계, 온톨로지는 속성과 더 복잡한 관계까지 다룬다.
- **설계 원칙** ([[papers:온톨로지-STUDY\|강의 1주차 S02]]): Gruber 5원칙 — 명확성, 정합성, 확장성, 최소 인코딩 편향, 최소 존재론적 개입. 명확성(빈틈없이 정의)과 최소 개입(꼭 필요한 것만 정의)은 서로 당기는 관계다. 잘 설계한 온톨로지는 LLM 에이전트의 잘못된 도구 사용이나 정책 위반을 걸러 주는 가드레일이 된다.
- **공유**: 만든 온톨로지를 남이 찾고 쓰게 하려면 FAIR 원칙에 맞춰 URI 설계, 버전 관리, 문서화를 갖춘다 ([[papers:Garijo_2020_FAIR-Vocabularies-Ontologies-Web\|Garijo, 2020]]).
- **구축 사례**: 한글 형태소 분석으로 지식 문장을 분해해 SKOS 기반 온톨로지에 매핑하고 여러 도메인의 지식을 연결 ([[papers:Ryu_2022_Knowledge-Graph-Ontology-Learning\|류, 2022]]).
- **LLM과의 결합**: 지식 그래프가 LLM을 보완하는 방식, LLM이 지식 그래프 구축을 돕는 방식, 둘이 따로 추론한 뒤 병합하는 방식 ([[papers:김말희_2025_LLM-Knowledge-Graph-Convergence-Trends\|김말희·허태옥, 2025]]). 벡터·그래프·온톨로지를 함께 쓰는 Triple-Hybrid RAG는 단일 벡터 RAG보다 F1이 19.4% 높았다 ([[papers:Shin_2026_Hybrid-RAG-Vector-Graph-Ontology\|Shin, 2026]]).

## 이어서 정리할 것

- [ ] 강의 1주차 S01의 대표 예시(WordNet 등) 정리
- [ ] Gruber 5원칙을 학교 데이터 온톨로지(평가 에이전트 프로젝트)에 적용해 보기
- [ ] 지식추적의 개념 구조(SINKT 등)와 어떻게 연결되는지 정리
