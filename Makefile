.PHONY: setup verify verify-m1 verify-m2 calibrate check-text check-captures build dev models previews

setup:
	node scripts/setup.mjs

verify:
	node scripts/verify.mjs

verify-m1:
	node scripts/verify.mjs --milestone=m1

verify-m2:
	node scripts/verify.mjs --milestone=m2

# Remeasures the stochastic tolerances against the real engine (~5 min, 8 workers) and
# rewrites content/calibration/stochastic-tolerances.json. `make verify` checks freshness only.
calibrate:
	.venv/bin/python scripts/calibrate-content.py --engine engine

check-text:
	node scripts/check-release-text.mjs

check-captures:
	node scripts/check-captures.mjs

build:
	npm run prepare:runtime
	npm run build

dev:
	npm run prepare:runtime
	npm run dev

models:
	node scripts/models.mjs
	node scripts/validate-models.mjs --report

previews:
	node scripts/models.mjs --preview
	node scripts/models.mjs --scene-preview
