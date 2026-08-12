from tests.direct.conftest import to_hex
from tests.direct.helpers import (
    CONTRACT_PATH,
    UNIT_GEN,
    open_round,
    submit_offer,
    submit_request,
)


def test_offer_and_request_are_canonical_and_exactly_bonded(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)

    submit_offer(contract, direct_vm, direct_bob)
    submit_request(contract, direct_vm, direct_charlie)

    assert contract.get_offer("round-alpha", "offer-alpha") == {
        "round_id": "round-alpha",
        "offer_id": "offer-alpha",
        "provider": to_hex(direct_bob),
        "label": "Calendar booking agent",
        "promise_text": "Books flights and calendar slots with confirmed availability.",
        "capability_ids_csv": "CALENDAR.WRITE,FLIGHT.BOOK",
        "deposit_wei": str(UNIT_GEN),
        "matched_request_id": "",
        "active": True,
    }
    assert contract.get_request("round-alpha", "request-alpha") == {
        "round_id": "round-alpha",
        "request_id": "request-alpha",
        "requester": to_hex(direct_charlie),
        "label": "Flight scheduling need",
        "need_text": "Reserve a flight and place it on my calendar without hotel booking.",
        "required_ids_csv": "CALENDAR.WRITE,FLIGHT.BOOK",
        "excluded_ids_csv": "HOTEL.BOOK",
        "deposit_wei": str(UNIT_GEN),
        "matched_offer_id": "",
        "outcome": "PENDING",
    }
    round_view = contract.get_round("round-alpha")
    assert round_view["offer_ids_csv"] == "offer-alpha"
    assert round_view["request_ids_csv"] == "request-alpha"
    assert round_view["offer_count"] == "1"
    assert round_view["request_count"] == "1"
    assert round_view["locked_liability_wei"] == str(2 * UNIT_GEN)


def test_positions_require_exact_one_gen(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)

    for bad_value in (0, UNIT_GEN - 1, UNIT_GEN + 1):
        direct_vm.sender = direct_bob
        direct_vm.value = bad_value
        with direct_vm.expect_revert("Provider bond must be exactly 1 GEN"):
            contract.submit_offer(
                "round-alpha",
                "offer-value",
                "Calendar agent",
                "Books a calendar slot.",
                "CALENDAR.WRITE",
            )

        direct_vm.value = bad_value
        with direct_vm.expect_revert("Booking fee must be exactly 1 GEN"):
            contract.submit_request(
                "round-alpha",
                "request-value",
                "Calendar need",
                "Needs a calendar slot.",
                "CALENDAR.WRITE",
                "",
            )
    direct_vm.value = 0


def test_one_position_per_wallet_per_side_and_unique_ids(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)
    submit_offer(contract, direct_vm, direct_bob)
    submit_request(contract, direct_vm, direct_charlie)

    direct_vm.sender = direct_bob
    direct_vm.value = UNIT_GEN
    with direct_vm.expect_revert("Wallet already submitted an offer"):
        contract.submit_offer("round-alpha", "offer-beta", "Second", "Second promise", "SECOND.CAP")

    direct_vm.sender = direct_alice
    direct_vm.value = UNIT_GEN
    with direct_vm.expect_revert("Offer already exists"):
        contract.submit_offer("round-alpha", "offer-alpha", "Duplicate", "Duplicate promise", "DUP.CAP")

    direct_vm.sender = direct_charlie
    direct_vm.value = UNIT_GEN
    with direct_vm.expect_revert("Wallet already submitted a request"):
        contract.submit_request("round-alpha", "request-beta", "Second", "Second need", "SECOND.CAP", "")
    direct_vm.value = 0


def test_round_enforces_four_positions_per_side(direct_vm, direct_deploy, direct_alice, direct_accounts):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)

    for index, actor in enumerate(direct_accounts[:4]):
        submit_offer(contract, direct_vm, actor, offer_id=f"offer-{index}")
        submit_request(contract, direct_vm, actor, request_id=f"request-{index}")

    direct_vm.sender = direct_accounts[4]
    direct_vm.value = UNIT_GEN
    with direct_vm.expect_revert("Offer limit reached"):
        contract.submit_offer("round-alpha", "offer-four", "Fifth", "Fifth promise", "FIFTH.CAP")
    with direct_vm.expect_revert("Request limit reached"):
        contract.submit_request("round-alpha", "request-four", "Fifth", "Fifth need", "FIFTH.CAP", "")
    direct_vm.value = 0


def test_lock_requires_creator_and_both_sides(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Round needs at least one offer and request"):
        contract.lock_round("round-alpha")

    submit_offer(contract, direct_vm, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Round needs at least one offer and request"):
        contract.lock_round("round-alpha")

    submit_request(contract, direct_vm, direct_charlie)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only round creator can lock"):
        contract.lock_round("round-alpha")

    direct_vm.sender = direct_alice
    contract.lock_round("round-alpha")
    assert contract.get_round("round-alpha")["phase"] == "LOCKED"


def test_locked_round_rejects_mutation_and_duplicate_lock(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    direct_charlie,
    direct_accounts,
):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)
    submit_offer(contract, direct_vm, direct_bob)
    submit_request(contract, direct_vm, direct_charlie)
    direct_vm.sender = direct_alice
    contract.lock_round("round-alpha")

    offer_before = contract.get_offer("round-alpha", "offer-alpha")
    request_before = contract.get_request("round-alpha", "request-alpha")
    direct_vm.sender = direct_accounts[3]
    direct_vm.value = UNIT_GEN
    with direct_vm.expect_revert("Round is not open"):
        contract.submit_offer("round-alpha", "offer-late", "Late", "Late promise", "LATE.CAP")
    with direct_vm.expect_revert("Round is not open"):
        contract.submit_request("round-alpha", "request-late", "Late", "Late need", "LATE.CAP", "")

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Round is not open"):
        contract.lock_round("round-alpha")
    assert contract.get_offer("round-alpha", "offer-alpha") == offer_before
    assert contract.get_request("round-alpha", "request-alpha") == request_before


def test_position_input_bounds_and_csv_normalization(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_round(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = UNIT_GEN

    with direct_vm.expect_revert("Offer ID is invalid"):
        contract.submit_offer("round-alpha", "x|y", "Valid label", "Valid promise", "CAP.ONE")
    with direct_vm.expect_revert("Offer label is invalid"):
        contract.submit_offer("round-alpha", "offer-bad", "  ", "Valid promise", "CAP.ONE")
    with direct_vm.expect_revert("Promise text is invalid"):
        contract.submit_offer("round-alpha", "offer-bad", "Valid label", "", "CAP.ONE")
    with direct_vm.expect_revert("Capability IDs are invalid"):
        contract.submit_offer("round-alpha", "offer-bad", "Valid label", "Valid promise", "CAP.ONE,CAP.ONE")
    direct_vm.value = 0


def test_missing_positions_return_explicit_empty_views(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_offer("missing-round", "missing-offer") == {}
    assert contract.get_request("missing-round", "missing-request") == {}
