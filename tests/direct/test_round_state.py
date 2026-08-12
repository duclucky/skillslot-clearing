from tests.direct.conftest import to_hex
from tests.direct.helpers import CONTRACT_PATH, UNIT_GEN, open_round


def test_open_round_creates_canonical_isolated_state(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)

    open_round(contract, direct_vm, direct_alice)

    round_view = contract.get_round("round-alpha")
    assert round_view == {
        "round_id": "round-alpha",
        "creator": to_hex(direct_alice),
        "title": "Agent access morning window",
        "phase": "OPEN",
        "booking_fee_wei": str(UNIT_GEN),
        "provider_bond_wei": str(UNIT_GEN),
        "offer_ids_csv": "",
        "request_ids_csv": "",
        "offer_count": "0",
        "request_count": "0",
        "attempt_count": "0",
        "match_count": "0",
        "locked_liability_wei": "0",
    }
    assert contract.get_round_ids() == ["round-alpha"]
    assert contract.get_accounting() == {
        "total_received_wei": "0",
        "total_locked_wei": "0",
        "total_credited_wei": "0",
        "total_withdrawn_wei": "0",
        "invariant_holds": True,
    }


def test_open_round_rejects_duplicate_id(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)

    with direct_vm.expect_revert("Round already exists"):
        open_round(contract, direct_vm, direct_alice)


def test_open_round_requires_locked_demo_terms(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    with direct_vm.expect_revert("Booking fee must be exactly 1 GEN"):
        contract.open_round("round-fee", "Fee mismatch round", UNIT_GEN - 1, UNIT_GEN)
    with direct_vm.expect_revert("Provider bond must be exactly 1 GEN"):
        contract.open_round("round-bond", "Bond mismatch round", UNIT_GEN, UNIT_GEN + 1)


def test_open_round_validates_identifier_and_title(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    for invalid_id in ("ab", "round|bad", "x" * 81):
        with direct_vm.expect_revert("Round ID is invalid"):
            contract.open_round(invalid_id, "Valid title", UNIT_GEN, UNIT_GEN)

    for invalid_title in ("  ", "x" * 121):
        with direct_vm.expect_revert("Round title is invalid"):
            contract.open_round("round-title", invalid_title, UNIT_GEN, UNIT_GEN)


def test_two_rounds_remain_isolated_and_discoverable(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice, "round-one", "First access window")
    open_round(contract, direct_vm, direct_bob, "round-two", "Second access window")

    assert contract.get_round_ids() == ["round-one", "round-two"]
    assert contract.get_round("round-one")["creator"] == to_hex(direct_alice)
    assert contract.get_round("round-two")["creator"] == to_hex(direct_bob)
    assert contract.get_round("round-one")["title"] == "First access window"
    assert contract.get_round("round-two")["title"] == "Second access window"


def test_missing_round_returns_explicit_empty_view(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)

    assert contract.get_round("missing-round") == {}
