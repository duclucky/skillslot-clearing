from tests.direct.helpers import CONTRACT_PATH, UNIT_GEN, open_round, submit_offer, submit_request


def assert_accounting(contract, received, locked, credited=0, withdrawn=0):
    assert contract.get_accounting() == {
        "total_received_wei": str(received),
        "total_locked_wei": str(locked),
        "total_credited_wei": str(credited),
        "total_withdrawn_wei": str(withdrawn),
        "invariant_holds": received == locked + credited + withdrawn,
    }


def test_each_payable_position_preserves_global_and_round_accounting(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)
    assert_accounting(contract, 0, 0)

    submit_offer(contract, direct_vm, direct_bob)
    assert_accounting(contract, UNIT_GEN, UNIT_GEN)
    assert contract.get_round("round-alpha")["locked_liability_wei"] == str(UNIT_GEN)

    submit_request(contract, direct_vm, direct_charlie)
    assert_accounting(contract, 2 * UNIT_GEN, 2 * UNIT_GEN)
    assert contract.get_round("round-alpha")["locked_liability_wei"] == str(2 * UNIT_GEN)


def test_accounting_and_actor_indexes_are_isolated_across_rounds(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice, "round-one", "First access window")
    open_round(contract, direct_vm, direct_alice, "round-two", "Second access window")

    submit_offer(contract, direct_vm, direct_bob, "round-one", "offer-one")
    submit_request(contract, direct_vm, direct_charlie, "round-one", "request-one")
    submit_offer(contract, direct_vm, direct_bob, "round-two", "offer-two")
    submit_request(contract, direct_vm, direct_charlie, "round-two", "request-two")

    assert_accounting(contract, 4 * UNIT_GEN, 4 * UNIT_GEN)
    assert contract.get_round("round-one")["locked_liability_wei"] == str(2 * UNIT_GEN)
    assert contract.get_round("round-two")["locked_liability_wei"] == str(2 * UNIT_GEN)
    assert contract.get_offer("round-one", "offer-two") == {}
    assert contract.get_request("round-two", "request-one") == {}
