param([string]$Only = "")

$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"
# This release contains the exact pinned py-genlayer runner declared by the contract header.
# Newer cached prerelease bundles may not retain historical runner hashes.
$env:GENVM_VERSION = "v0.6.0-rc5"
$Python = ".\.venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
  throw "Missing .venv. Create the Python 3.12 environment and install requirements-dev.txt."
}

function Assert-LastExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

if ($Only -eq "" -or $Only -eq "lint") {
  & $Python scripts/ascii_contract_check.py
  Assert-LastExitCode "ASCII/header contract check"
  & $Python scripts/lint_contract.py check contracts/skill_slot_clearing.py
  Assert-LastExitCode "GenVM AST and semantic schema check"
}

if ($Only -eq "" -or $Only -eq "static") {
  & $Python -m pytest tests/test_static_contract.py tests/test_linter_compatibility.py -v
  Assert-LastExitCode "Static contract tests"
}

if ($Only -eq "" -or $Only -eq "direct") {
  & $Python -m pytest tests/direct -v
  Assert-LastExitCode "Direct contract tests"
}

if ($Only -eq "" -or $Only -eq "deployment") {
  & $Python -m pytest tests/test_deployment_receipts.py -v
  Assert-LastExitCode "Deployment receipt parser tests"
  node --test tests/deployment_script.test.mjs tests/fee_evidence.test.mjs
  Assert-LastExitCode "Deployment script tests"
}

if ($Only -eq "") {
  npm --prefix frontend run test
  Assert-LastExitCode "Frontend tests"
  npm --prefix frontend run build
  Assert-LastExitCode "Frontend production build"
}
