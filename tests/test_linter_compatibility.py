"""The RC spelling adapter adds recognition, never disables safety rules."""
import subprocess
import sys
import os
import json
from tempfile import TemporaryDirectory
from pathlib import Path
import pytest

SOURCE = Path("contracts/skill_slot_clearing.py").read_text(encoding="utf-8")


@pytest.fixture
def candidate_dir():
    # Keep disposable generated fixtures in this checkout, not a shared OS temp.
    scratch = Path(".local")
    scratch.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="lint-fixture-", dir=scratch) as directory:
        yield Path(directory)


def lint(tmp_path, source):
    candidate = tmp_path / "candidate.py"
    candidate.write_text(source, encoding="utf-8")
    result = subprocess.run([sys.executable, "scripts/lint_contract.py", "check", str(candidate), "--json"], capture_output=True, text=True, encoding="utf-8", timeout=90,
                            env={**os.environ, "PYTHONUTF8": "1", "GENVM_VERSION": "v0.6.0-rc5"})
    return result, json.loads(result.stdout)


def test_v03_contract_recognizes_safe_sandbox_and_storage(candidate_dir):
    result, payload = lint(candidate_dir, SOURCE)
    assert result.returncode == 0, result.stdout + result.stderr
    assert payload["ok"] is True


def test_naked_nondeterminism_is_still_rejected(candidate_dir):
    candidate = SOURCE.replace("normalized_title = _validate_title(title)", 'gl.nondet.exec_prompt("unsafe")\n        normalized_title = _validate_title(title)', 1)
    result, payload = lint(candidate_dir, candidate)
    assert result.returncode != 0 and payload["lint"]["ok"] is False


def test_unmarked_storage_is_still_rejected(candidate_dir):
    result, payload = lint(candidate_dir, SOURCE.replace("@gl.storage.allow\n", "", 1))
    assert result.returncode != 0 and payload["ok"] is False
