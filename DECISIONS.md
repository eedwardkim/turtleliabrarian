# Decisions

1. The follow-up names `eedwardkim/turtleliabrarian`; use it unchanged.
2. The repository is empty. Work starts on a `devin/…-foundation` feature branch,
   never a direct push to main. This functional contract/tooling baseline will
   be the review base for the game branch. No existing files or hooks exist.
3. React 18 is explicit; compatible Fiber 8 and Drei 9 take precedence over
   their React-19-only newest major versions. Pin exact tested versions.
4. Core campaign datasets remain original and seeded, as section 5.9 requires.
   A separately credited public-data sandbox may supplement them if feasible;
   synthetic data must never be described as real-world observations.
5. Slack currently requires OAuth. A login link was requested; keep a local
   reporting outbox and proceed while the integration is unavailable.
6. Follow requested milestone gates. A requirement without executed evidence
   stays unverified; no release-ready claim or fabricated compliance.
7. Five isolated component contributors can work concurrently inside M1:
   engine, worker, Blender/scene, UI, and curriculum/game state. Integration
   and observed UI review gate later milestones. Separate VMs and disjoint file
   ownership avoid sharing mutable state.
