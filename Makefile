.PHONY: setup verify verify-m1 build dev models previews

setup:
	node scripts/setup.mjs

verify:
	node scripts/verify.mjs

verify-m1:
	node scripts/verify.mjs --milestone=m1

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
