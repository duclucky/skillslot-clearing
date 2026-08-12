param([string]$Only = "")

$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"
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
  & ".\.venv\Scripts\genvm-lint.exe" lint contracts/skill_slot_clearing.py
  Assert-LastExitCode "GenVM AST lint"

  # genvm-lint 0.11.0 cannot discover a user class literally named Contract.
  # Keep the deployable source canonical and rename only an ASCII temp copy for schema discovery.
  $TempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $TempDir = Join-Path $TempRoot ("skillslot-genvm-" + [System.Guid]::NewGuid().ToString())
  $ResolvedTempDir = [System.IO.Path]::GetFullPath($TempDir)
  if (-not $ResolvedTempDir.StartsWith($TempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing unsafe temporary lint path"
  }
  New-Item -ItemType Directory -Path $ResolvedTempDir | Out-Null
  $TempContract = Join-Path $ResolvedTempDir "skill_slot_clearing_lint.py"
  try {
    $Source = Get-Content -LiteralPath "contracts/skill_slot_clearing.py" -Raw
    $Source = $Source.Replace("class Contract(gl.Contract):", "class SkillSlotClearing(gl.Contract):")
    Set-Content -LiteralPath $TempContract -Value $Source -Encoding ascii
    & ".\.venv\Scripts\genvm-lint.exe" check $TempContract
    Assert-LastExitCode "GenVM schema check"
  } finally {
    if (Test-Path -LiteralPath $TempContract) {
      Remove-Item -LiteralPath $TempContract -Force
    }
    if (Test-Path -LiteralPath $ResolvedTempDir) {
      [System.IO.Directory]::Delete($ResolvedTempDir, $true)
    }
  }
}

if ($Only -eq "" -or $Only -eq "static") {
  & $Python -m pytest tests/test_static_contract.py -v
  Assert-LastExitCode "Static contract tests"
}

if ($Only -eq "" -or $Only -eq "direct") {
  & $Python -m pytest tests/direct -v
  Assert-LastExitCode "Direct contract tests"
}

if ($Only -eq "") {
  npm --prefix frontend run test
  Assert-LastExitCode "Frontend tests"
  npm --prefix frontend run build
  Assert-LastExitCode "Frontend production build"
}
