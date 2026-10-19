from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from gltest.direct.loader import deploy_contract


DIRECT_SDK_VERSION = os.environ.get("SKILLSLOT_DIRECT_VERSION", "v0.6.0-rc5")


def _install_windows_stdin_patch() -> None:
    if os.name != "nt":
        return

    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    if getattr(loader, "_skillslot_windows_stdin_patch", False):
        return

    def inject_message_to_fd0(vm: VMContext) -> None:
        if DIRECT_SDK_VERSION == "v0.2.16":
            from genlayer.py import calldata
            from genlayer.py.types import Address
        else:
            from genlayer import calldata
            from genlayer.types import Address

        sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
        contract = Address(vm._contract_address) if isinstance(vm._contract_address, bytes) else vm._contract_address
        origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
        encoded = calldata.encode(
            {
                "contract_address": contract,
                "sender_address": sender,
                "origin_address": origin,
                "stack": [],
                "value": vm._value,
                "datetime": vm._datetime,
                "is_init": False,
                "chain_id": vm._chain_id,
                "entry_kind": 0,
                "entry_data": b"",
                "entry_stage_data": None,
            }
        )

        fd, path = tempfile.mkstemp()
        try:
            os.write(fd, encoded)
            os.lseek(fd, 0, os.SEEK_SET)
            vm._original_stdin_fd = os.dup(0)
            os.dup2(fd, 0)
            vm._skillslot_stdin_temp_path = path
        finally:
            os.close(fd)

    original_cleanup = VMContext._cleanup_after_deactivate

    def cleanup_after_deactivate(self: VMContext) -> None:
        try:
            original_cleanup(self)
        finally:
            path = getattr(self, "_skillslot_stdin_temp_path", None)
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
                self._skillslot_stdin_temp_path = None

    loader._inject_message_to_fd0 = inject_message_to_fd0
    loader._skillslot_windows_stdin_patch = True
    VMContext._cleanup_after_deactivate = cleanup_after_deactivate


_install_windows_stdin_patch()


def _install_v03_llm_mock_compatibility() -> None:
    if DIRECT_SDK_VERSION == "v0.2.16":
        return
    import json
    from gltest.direct import wasi_mock

    original = wasi_mock._handle_llm_request

    def textual_json_mock(vm, data):
        result = original(vm, data)
        # The RC mock pre-parses JSON, but v0.3 SDK expects model text and parses it itself.
        # Preserve the fixture's decision; only restore the real response transport shape.
        if isinstance(result, dict) and "ok" in result and not isinstance(result["ok"], str):
            return {"ok": json.dumps(result["ok"])}
        return result

    wasi_mock._handle_llm_request = textual_json_mock


_install_v03_llm_mock_compatibility()


@pytest.fixture
def direct_deploy(direct_vm):
    def _deploy(contract_path: str, *args, sdk_version: str = DIRECT_SDK_VERSION, **kwargs):
        path = Path(os.environ.get("SKILLSLOT_CANDIDATE_PATH", contract_path))
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        return deploy_contract(path, direct_vm, *args, sdk_version=sdk_version, **kwargs)

    return _deploy


def to_hex(address) -> str:
    if hasattr(address, "as_hex"):
        return address.as_hex
    if DIRECT_SDK_VERSION == "v0.2.16":
        from genlayer.py.types import Address
    else:
        from genlayer.types import Address

    return Address(address).as_hex
