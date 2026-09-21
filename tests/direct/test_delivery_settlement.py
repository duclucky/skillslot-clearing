from datetime import datetime, timezone

from tests.direct.conftest import to_hex
from tests.direct.helpers import (
    CONTRACT_PATH,
    UNIT_GEN,
    clearable_result,
    lock_round,
    mock_clearing,
    open_round,
    pair_result,
    set_time,
    submit_offer,
    submit_request,
)


DELIVERY = "Confirmed itinerary: flight GL-203 departs at 09:30 and was added to the requester calendar."


def iso_at(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cleared_delivery(contract, vm, creator, provider, requester):
    open_round(contract, vm, creator)
    submit_offer(contract, vm, provider)
    submit_request(contract, vm, requester)
    lock_round(contract, vm, creator)
    mock_clearing(
        vm,
        clearable_result(
            [pair_result("offer-alpha", "request-alpha", "MATCH", "CALENDAR.WRITE,FLIGHT.BOOK")]
        ),
    )
    vm.sender = creator
    contract.clear_round("round-alpha")
    return contract.get_match("round-alpha", "request-alpha")


def mock_delivery(vm, verdict: str, reason: str = "Artifact satisfies the locked need and promise."):
    vm.clear_mocks()
    vm.mock_llm(
        r"(?s).*SkillSlot delivery fulfillment adjudicator.*",
        '{"verdict":"' + verdict + '","reason":"' + reason + '"}',
    )


def test_match_keeps_fee_and_bond_escrowed_until_delivery(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    match = cleared_delivery(contract, direct_vm, direct_alice, direct_bob, direct_charlie)

    assert match["delivery_status"] == "AWAITING_DELIVERY"
    assert int(match["delivery_deadline"]) > 0
    assert int(match["delivery_recovery_at"]) > int(match["delivery_deadline"])
    assert contract.get_credit(to_hex(direct_bob)) == "0"
    assert contract.get_accounting() == {
        "total_received_wei": str(2 * UNIT_GEN),
        "total_locked_wei": str(2 * UNIT_GEN),
        "total_credited_wei": "0",
        "total_withdrawn_wei": "0",
        "invariant_holds": True,
    }


def test_provider_submission_and_requester_acceptance_release_exact_escrow(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, direct_alice, direct_bob, direct_charlie)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only matched provider can submit delivery"):
        contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)

    direct_vm.sender = direct_bob
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    submitted = contract.get_match("round-alpha", "request-alpha")
    assert submitted["delivery_status"] == "SUBMITTED"
    assert len(submitted["delivery_digest"]) == 64

    direct_vm.sender = direct_charlie
    contract.accept_delivery("round-alpha", "request-alpha")
    assert contract.get_match("round-alpha", "request-alpha")["delivery_status"] == "FULFILLED"
    assert contract.get_credit(to_hex(direct_bob)) == str(2 * UNIT_GEN)
    assert contract.get_accounting()["total_locked_wei"] == "0"


def test_validator_fulfilled_result_pays_provider(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    mock_delivery(direct_vm, "FULFILLED")
    direct_vm.sender = caller
    assert contract.review_delivery("round-alpha", "request-alpha")["verdict"] == "FULFILLED"
    assert contract.get_credit(to_hex(provider)) == str(2 * UNIT_GEN)


def test_validator_failed_result_pays_requester(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", "Unrelated placeholder output with no itinerary.")
    mock_delivery(direct_vm, "FAILED", "Artifact does not satisfy the locked need.")
    direct_vm.sender = caller
    assert contract.review_delivery("round-alpha", "request-alpha")["verdict"] == "FAILED"
    assert contract.get_credit(to_hex(requester)) == str(2 * UNIT_GEN)


def test_unverifiable_review_moves_no_value_and_recovery_splits_fee_and_bond(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    mock_delivery(direct_vm, "UNVERIFIABLE", "Validators could not agree.")
    direct_vm.sender = caller
    assert contract.review_delivery("round-alpha", "request-alpha")["verdict"] == "UNVERIFIABLE"
    assert contract.get_accounting()["total_locked_wei"] == str(2 * UNIT_GEN)

    recovery_at = int(contract.get_match("round-alpha", "request-alpha")["delivery_recovery_at"])
    set_time(direct_vm, iso_at(recovery_at))
    contract.recover_delivery("round-alpha", "request-alpha")
    assert contract.get_credit(to_hex(requester)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(provider)) == str(UNIT_GEN)
    assert contract.get_match("round-alpha", "request-alpha")["delivery_status"] == "RECOVERED"


def test_no_delivery_timeout_awards_fee_and_bond_to_requester_at_exact_boundary(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    match = cleared_delivery(contract, direct_vm, creator, provider, requester)
    recovery_at = int(match["delivery_recovery_at"])

    set_time(direct_vm, iso_at(recovery_at - 1))
    direct_vm.sender = caller
    with direct_vm.expect_revert("Delivery recovery deadline has not passed"):
        contract.recover_delivery("round-alpha", "request-alpha")

    set_time(direct_vm, iso_at(recovery_at))
    contract.recover_delivery("round-alpha", "request-alpha")
    assert contract.get_credit(to_hex(requester)) == str(2 * UNIT_GEN)
    assert contract.get_credit(to_hex(provider)) == "0"
    assert contract.get_accounting()["invariant_holds"] is True


def test_requester_acceptance_rejects_wrong_wallet(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    match = cleared_delivery(contract, direct_vm, creator, provider, requester)
    deadline = int(match["delivery_deadline"])

    set_time(direct_vm, iso_at(deadline - 1))
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)

    direct_vm.sender = caller
    with direct_vm.expect_revert("Only matched requester can accept delivery"):
        contract.accept_delivery("round-alpha", "request-alpha")



def test_submission_deadline_is_exclusive(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester = direct_accounts[:3]
    contract = direct_deploy(CONTRACT_PATH)
    match = cleared_delivery(contract, direct_vm, creator, provider, requester)
    set_time(direct_vm, iso_at(int(match["delivery_deadline"])))
    direct_vm.sender = provider
    with direct_vm.expect_revert("Delivery deadline has passed"):
        contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)


def test_malformed_review_is_retryable_and_terminal_settlement_cannot_repeat(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"(?s).*SkillSlot delivery fulfillment adjudicator.*", "not-json")

    direct_vm.sender = caller
    result = contract.review_delivery("round-alpha", "request-alpha")
    assert result["verdict"] == "UNVERIFIABLE"
    assert contract.get_match("round-alpha", "request-alpha")["delivery_status"] == "RETRYABLE"
    assert contract.get_accounting()["total_locked_wei"] == str(2 * UNIT_GEN)

    mock_delivery(direct_vm, "FULFILLED")
    contract.review_delivery("round-alpha", "request-alpha")
    with direct_vm.expect_revert("Delivery is not reviewable"):
        contract.review_delivery("round-alpha", "request-alpha")
    with direct_vm.expect_revert("Delivery is already settled"):
        contract.recover_delivery("round-alpha", "request-alpha")
    assert contract.get_credit(to_hex(provider)) == str(2 * UNIT_GEN)
    assert contract.get_accounting()["total_locked_wei"] == "0"


def test_recovery_boundary_closes_late_review_and_uses_deterministic_recovery(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    recovery_at = int(contract.get_match("round-alpha", "request-alpha")["delivery_recovery_at"])
    set_time(direct_vm, iso_at(recovery_at))

    direct_vm.sender = caller
    with direct_vm.expect_revert("Delivery recovery deadline has passed"):
        contract.review_delivery("round-alpha", "request-alpha")
    contract.recover_delivery("round-alpha", "request-alpha")

    assert contract.get_credit(to_hex(requester)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(provider)) == str(UNIT_GEN)
    assert contract.get_accounting()["total_locked_wei"] == "0"
