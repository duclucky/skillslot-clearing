import pytest

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
    unverifiable_result,
)


def setup_open_positions(contract, vm, creator, provider, requester, round_id="round-alpha"):
    open_round(contract, vm, creator, round_id)
    submit_offer(contract, vm, provider, round_id)
    submit_request(contract, vm, requester, round_id)


def clear_single_match(contract, vm, creator, round_id="round-alpha"):
    lock_round(contract, vm, creator, round_id)
    mock_clearing(
        vm,
        clearable_result(
            [pair_result("offer-alpha", "request-alpha", "MATCH", "CALENDAR.WRITE,FLIGHT.BOOK")]
        ),
    )
    vm.sender = creator
    contract.clear_round(round_id)


def test_cancel_open_round_credits_each_deposit_once(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)

    direct_vm.sender = direct_alice
    contract.cancel_round("round-alpha")

    assert contract.get_round("round-alpha")["phase"] == "CANCELLED"
    assert contract.get_round("round-alpha")["locked_liability_wei"] == "0"
    assert contract.get_credit(to_hex(direct_bob)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(direct_charlie)) == str(UNIT_GEN)
    accounting = contract.get_accounting()
    assert accounting["total_locked_wei"] == "0"
    assert accounting["total_credited_wei"] == str(2 * UNIT_GEN)
    assert accounting["invariant_holds"] is True

    contract.cancel_round("round-alpha")
    assert contract.get_credit(to_hex(direct_bob)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(direct_charlie)) == str(UNIT_GEN)


def test_cancel_checks_creator_before_idempotent_terminal_noop(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)
    direct_vm.sender = direct_alice
    contract.cancel_round("round-alpha")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only round creator can cancel"):
        contract.cancel_round("round-alpha")


@pytest.mark.parametrize("terminal_phase", ["LOCKED", "RETRYABLE", "CLEARED"])
def test_cancel_rejects_locked_retryable_and_cleared_states(
    terminal_phase,
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    creator, provider, requester = direct_accounts[:3]
    contract = direct_deploy(CONTRACT_PATH)
    round_id = "round-terminal"
    setup_open_positions(contract, direct_vm, creator, provider, requester, round_id)
    lock_round(contract, direct_vm, creator, round_id)
    if terminal_phase == "RETRYABLE":
        mock_clearing(direct_vm, unverifiable_result())
        direct_vm.sender = creator
        contract.clear_round(round_id)
    elif terminal_phase == "CLEARED":
        mock_clearing(
            direct_vm,
            clearable_result(
                [pair_result("offer-alpha", "request-alpha", "MATCH", "CALENDAR.WRITE,FLIGHT.BOOK")]
            ),
        )
        direct_vm.sender = creator
        contract.clear_round(round_id)

    assert contract.get_round(round_id)["phase"] == terminal_phase
    direct_vm.sender = creator
    with direct_vm.expect_revert("Round cannot be cancelled"):
        contract.cancel_round(round_id)


def test_cancel_isolated_round_does_not_credit_other_round(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    creator, provider_one, requester_one, provider_two, requester_two = direct_accounts[:5]
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, creator, provider_one, requester_one, "round-one")
    setup_open_positions(contract, direct_vm, creator, provider_two, requester_two, "round-two")

    direct_vm.sender = creator
    contract.cancel_round("round-one")

    assert contract.get_round("round-two")["phase"] == "OPEN"
    assert contract.get_round("round-two")["locked_liability_wei"] == str(2 * UNIT_GEN)
    assert contract.get_credit(to_hex(provider_two)) == "0"
    assert contract.get_credit(to_hex(requester_two)) == "0"


def test_matched_requester_consumes_active_grant_once(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)
    clear_single_match(contract, direct_vm, direct_alice)

    assert contract.can_route("round-alpha", "request-alpha", to_hex(direct_charlie)) is True
    direct_vm.sender = direct_charlie
    contract.consume_grant("round-alpha", "request-alpha")

    assert contract.get_match("round-alpha", "request-alpha")["grant_status"] == "CONSUMED"
    assert contract.can_route("round-alpha", "request-alpha", to_hex(direct_charlie)) is False
    with direct_vm.expect_revert("Grant is not active"):
        contract.consume_grant("round-alpha", "request-alpha")


def test_grant_rejects_wrong_wallet_missing_match_and_pre_finalized_round(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Grant does not exist"):
        contract.consume_grant("round-alpha", "request-alpha")

    clear_single_match(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only matched requester can consume"):
        contract.consume_grant("round-alpha", "request-alpha")
    with direct_vm.expect_revert("Grant does not exist"):
        contract.consume_grant("round-alpha", "request-missing")


def test_withdrawal_debits_before_external_send_and_preserves_invariant(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)
    direct_vm.sender = direct_alice
    contract.cancel_round("round-alpha")
    sends = []

    def capture_send(vm, request):
        if "EthSend" in request:
            sends.append(request["EthSend"])
            assert contract.get_credit(to_hex(direct_bob)) == "0"
            assert contract.get_accounting()["total_withdrawn_wei"] == str(UNIT_GEN)
            contract_address = vm._contract_address
            balance = vm._balances.get(bytes(contract_address), 0)
            vm.deal(contract_address, balance - int(request["EthSend"]["value"]))
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = capture_send
    direct_vm.sender = direct_bob
    contract.withdraw_credit(UNIT_GEN)

    assert len(sends) == 1
    assert int(sends[0]["value"]) == UNIT_GEN
    assert sends[0]["address"].as_hex == to_hex(direct_bob)
    assert sends[0]["calldata"] == b""
    assert contract.get_accounting()["invariant_holds"] is True
    with direct_vm.expect_revert("Insufficient credit"):
        contract.withdraw_credit(UNIT_GEN)


def test_withdrawal_rejects_zero_negative_and_over_credit(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)
    direct_vm.sender = direct_alice
    contract.cancel_round("round-alpha")
    direct_vm.sender = direct_bob

    for amount in (0, -1):
        with direct_vm.expect_revert("Withdrawal amount must be positive"):
            contract.withdraw_credit(amount)
    with direct_vm.expect_revert("Insufficient credit"):
        contract.withdraw_credit(UNIT_GEN + 1)


def test_anyone_can_recover_expired_open_round_without_creator(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, direct_alice, direct_bob, direct_charlie)

    set_time(direct_vm, "2026-08-15T11:59:59Z")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Round recovery deadline has not passed"):
        contract.recover_expired_round("round-alpha")

    set_time(direct_vm, "2026-08-15T12:00:00Z")
    direct_vm.sender = direct_charlie
    contract.recover_expired_round("round-alpha")

    assert contract.get_round("round-alpha")["phase"] == "CANCELLED"
    assert contract.get_round("round-alpha")["locked_liability_wei"] == "0"
    assert contract.get_credit(to_hex(direct_bob)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(direct_charlie)) == str(UNIT_GEN)
    assert contract.get_accounting()["invariant_holds"] is True


def test_anyone_can_recover_expired_locked_or_retryable_round_without_payout(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    creator, provider, requester, stranger = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, creator, provider, requester, "round-locked")
    lock_round(contract, direct_vm, creator, "round-locked")
    set_time(direct_vm, "2026-08-15T12:59:59Z")
    direct_vm.sender = stranger
    with direct_vm.expect_revert("Round recovery deadline has not passed"):
        contract.recover_expired_round("round-locked")

    set_time(direct_vm, "2026-08-15T13:00:00Z")
    contract.recover_expired_round("round-locked")

    assert contract.get_round("round-locked")["phase"] == "CANCELLED"
    assert contract.get_credit(to_hex(provider)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(requester)) == str(UNIT_GEN)
    assert contract.get_round("round-locked")["match_count"] == "0"
    assert contract.get_match("round-locked", "request-alpha") == {}

    setup_open_positions(contract, direct_vm, creator, direct_accounts[4], direct_accounts[5], "round-retry")
    lock_round(contract, direct_vm, creator, "round-retry")
    mock_clearing(direct_vm, unverifiable_result())
    set_time(direct_vm, "2026-08-15T11:30:00Z")
    direct_vm.sender = creator
    contract.clear_round("round-retry")
    assert contract.get_round("round-retry")["phase"] == "RETRYABLE"

    set_time(direct_vm, "2026-08-15T13:00:00Z")
    direct_vm.sender = stranger
    contract.recover_expired_round("round-retry")

    assert contract.get_round("round-retry")["phase"] == "CANCELLED"
    assert contract.get_credit(to_hex(direct_accounts[4])) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(direct_accounts[5])) == str(UNIT_GEN)
    assert contract.get_accounting()["invariant_holds"] is True


def test_recovery_is_idempotent_after_terminal_cancel_and_rejects_cleared(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    creator, provider, requester, stranger = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    setup_open_positions(contract, direct_vm, creator, provider, requester)
    set_time(direct_vm, "2026-08-15T12:00:00Z")
    direct_vm.sender = stranger
    contract.recover_expired_round("round-alpha")
    contract.recover_expired_round("round-alpha")

    assert contract.get_credit(to_hex(provider)) == str(UNIT_GEN)
    assert contract.get_credit(to_hex(requester)) == str(UNIT_GEN)
    assert contract.get_accounting()["total_credited_wei"] == str(2 * UNIT_GEN)

    setup_open_positions(contract, direct_vm, creator, direct_accounts[4], direct_accounts[5], "round-cleared")
    clear_single_match(contract, direct_vm, creator, "round-cleared")
    set_time(direct_vm, "2026-08-15T13:00:00Z")
    direct_vm.sender = stranger
    with direct_vm.expect_revert("Round cannot be recovered"):
        contract.recover_expired_round("round-cleared")
