import pytest

from tests.direct.conftest import to_hex
from tests.direct.helpers import (
    CONTRACT_PATH,
    clearable_result,
    lock_round,
    mock_clearing,
    open_round,
    pair_result,
    submit_offer,
    submit_request,
)


DIGEST = "a" * 64


def cleared_contract(direct_vm, direct_deploy, creator, provider, requester):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, creator, "round-alpha")
    submit_offer(contract, direct_vm, provider, "round-alpha")
    submit_request(contract, direct_vm, requester, "round-alpha")
    lock_round(contract, direct_vm, creator, "round-alpha")
    mock_clearing(
        direct_vm,
        clearable_result(
            [pair_result("offer-alpha", "request-alpha", "MATCH", "CALENDAR.WRITE,FLIGHT.BOOK")]
        ),
    )
    direct_vm.sender = creator
    contract.clear_round("round-alpha")
    return contract


def test_matched_requester_authorizes_one_exact_dispatch_without_accounting_change(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = cleared_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    accounting_before = contract.get_accounting()

    direct_vm.sender = direct_charlie
    contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)

    match = contract.get_match("round-alpha", "request-alpha")
    assert match["dispatch_digest"] == DIGEST
    assert match["dispatch_status"] == "AUTHORIZED"
    assert contract.can_dispatch(
        "round-alpha", "request-alpha", to_hex(direct_charlie), DIGEST
    ) is True
    assert contract.can_dispatch(
        "round-alpha", "request-alpha", to_hex(direct_bob), DIGEST
    ) is False
    assert contract.can_dispatch(
        "round-alpha", "request-alpha", to_hex(direct_charlie), "b" * 64
    ) is False

    contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)
    assert contract.get_accounting() == accounting_before


@pytest.mark.parametrize("malformed", ["a" * 63, "A" * 64, "z" * 64])
def test_dispatch_authorization_rejects_malformed_digest(
    malformed,
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = cleared_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    direct_vm.sender = direct_charlie

    with direct_vm.expect_revert("Task digest must be lowercase SHA-256 hex"):
        contract.authorize_dispatch("round-alpha", "request-alpha", malformed)

    assert contract.get_match("round-alpha", "request-alpha").get("dispatch_digest", "") == ""


def test_dispatch_authorization_rejects_wrong_caller_missing_match_and_uncleared_round(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = cleared_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only matched requester can authorize dispatch"):
        contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Grant does not exist"):
        contract.authorize_dispatch("round-alpha", "request-missing", DIGEST)

    open_round(contract, direct_vm, direct_alice, "round-open")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Grant does not exist"):
        contract.authorize_dispatch("round-open", "request-alpha", DIGEST)


def test_dispatch_digest_is_immutable_and_consumption_revokes_dispatch(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = cleared_contract(
        direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
    )
    direct_vm.sender = direct_charlie
    contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)

    with direct_vm.expect_revert("A different task is already authorized"):
        contract.authorize_dispatch("round-alpha", "request-alpha", "b" * 64)

    contract.consume_grant("round-alpha", "request-alpha")
    assert contract.can_dispatch(
        "round-alpha", "request-alpha", to_hex(direct_charlie), DIGEST
    ) is False
    with direct_vm.expect_revert("Grant is not active"):
        contract.authorize_dispatch("round-alpha", "request-alpha", DIGEST)
