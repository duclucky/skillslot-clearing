import pytest

from tests.direct.conftest import to_hex
from tests.direct.helpers import set_time
from tests.direct.test_dispatch_authorization import DIGEST, cleared_contract


NOW = 1_786_791_600
ONE_HOUR = 60 * 60
MAX_EXECUTOR_WINDOW = 7 * 24 * 60 * 60


def authorized_contract(direct_vm, direct_deploy, creator, provider, requester):
    contract = cleared_contract(direct_vm, direct_deploy, creator, provider, requester)
    direct_vm.sender = requester
    contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)
    return contract


def test_requester_authorizes_exact_executor_without_accounting_change(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = authorized_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    accounting_before = contract.get_accounting()
    executor = to_hex(direct_bob)
    expiry = NOW + ONE_HOUR

    direct_vm.sender = direct_charlie
    contract.authorize_executor("round-alpha", "request-alpha", executor, expiry)

    match = contract.get_match("round-alpha", "request-alpha")
    assert match["executor"] == executor.lower()
    assert match["executor_status"] == "AUTHORIZED"
    assert match["executor_expires_at"] == str(expiry)
    assert match["executor_epoch"] == "1"
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 1, expiry
    ) is True
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", to_hex(direct_alice), DIGEST, 1, expiry
    ) is False
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, "b" * 64, 1, expiry
    ) is False
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 0, expiry
    ) is False

    contract.authorize_executor("round-alpha", "request-alpha", executor, expiry)
    assert contract.get_match("round-alpha", "request-alpha")["executor_epoch"] == "1"
    assert contract.get_accounting() == accounting_before


@pytest.mark.parametrize(
    ("executor", "expiry", "message"),
    [
        ("not-an-address", NOW + ONE_HOUR, "Executor must be a non-zero EVM address"),
        ("0x" + "0" * 40, NOW + ONE_HOUR, "Executor must be a non-zero EVM address"),
        ("0x" + "1" * 40, NOW, "Executor expiry must be in the future"),
        ("0x" + "1" * 40, NOW - 1, "Executor expiry must be in the future"),
        (
            "0x" + "1" * 40,
            NOW + MAX_EXECUTOR_WINDOW + 1,
            "Executor expiry exceeds seven days",
        ),
    ],
)
def test_executor_authorization_rejects_invalid_address_and_expiry(
    executor,
    expiry,
    message,
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = authorized_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    direct_vm.sender = direct_charlie

    with direct_vm.expect_revert(message):
        contract.authorize_executor("round-alpha", "request-alpha", executor, expiry)

    assert contract.get_match("round-alpha", "request-alpha")["executor_status"] == "NONE"


def test_executor_authorization_requires_requester_active_grant_and_dispatch(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = cleared_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    executor = to_hex(direct_bob)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only matched requester can authorize executor"):
        contract.authorize_executor("round-alpha", "request-alpha", executor, NOW + ONE_HOUR)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Task dispatch is not authorized"):
        contract.authorize_executor("round-alpha", "request-alpha", executor, NOW + ONE_HOUR)

    with direct_vm.expect_revert("Grant does not exist"):
        contract.authorize_executor("round-alpha", "request-missing", executor, NOW + ONE_HOUR)

    contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)
    contract.consume_grant("round-alpha", "request-alpha")
    with direct_vm.expect_revert("Grant is not active"):
        contract.authorize_executor("round-alpha", "request-alpha", executor, NOW + ONE_HOUR)


def test_revoke_is_idempotent_and_reauthorization_increments_epoch(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = authorized_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    executor = to_hex(direct_bob)
    accounting_before = contract.get_accounting()
    direct_vm.sender = direct_charlie

    contract.revoke_executor("round-alpha", "request-alpha")
    assert contract.get_match("round-alpha", "request-alpha")["executor_status"] == "NONE"

    contract.authorize_executor("round-alpha", "request-alpha", executor, NOW + ONE_HOUR)
    with direct_vm.expect_revert("Revoke the active executor before replacing it"):
        contract.authorize_executor(
            "round-alpha", "request-alpha", to_hex(direct_alice), NOW + ONE_HOUR
        )

    contract.revoke_executor("round-alpha", "request-alpha")
    contract.revoke_executor("round-alpha", "request-alpha")
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 1, NOW + ONE_HOUR
    ) is False

    contract.authorize_executor(
        "round-alpha", "request-alpha", to_hex(direct_alice), NOW + ONE_HOUR
    )
    match = contract.get_match("round-alpha", "request-alpha")
    assert match["executor"] == to_hex(direct_alice).lower()
    assert match["executor_epoch"] == "2"
    assert contract.get_accounting() == accounting_before


def test_executor_expiry_boundary_and_grant_consumption_fail_closed(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = authorized_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    executor = to_hex(direct_bob)
    expiry = NOW + ONE_HOUR
    direct_vm.sender = direct_charlie
    contract.authorize_executor("round-alpha", "request-alpha", executor, expiry)

    set_time(direct_vm, "2026-08-15T11:59:59Z")
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 1, expiry
    ) is True

    set_time(direct_vm, "2026-08-15T12:00:00Z")
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 1, expiry
    ) is False

    contract.revoke_executor("round-alpha", "request-alpha")
    set_time(direct_vm, "2026-08-15T11:30:00Z")
    contract.authorize_executor("round-alpha", "request-alpha", executor, NOW + 2 * ONE_HOUR)
    contract.consume_grant("round-alpha", "request-alpha")
    assert contract.can_execute_dispatch(
        "round-alpha", "request-alpha", executor, DIGEST, 2, NOW + 2 * ONE_HOUR
    ) is False


def test_revoke_rejects_wrong_caller_and_missing_match(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = authorized_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only matched requester can revoke executor"):
        contract.revoke_executor("round-alpha", "request-alpha")

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Grant does not exist"):
        contract.revoke_executor("round-alpha", "request-missing")
