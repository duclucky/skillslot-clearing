import pytest

from tests.direct.conftest import to_hex
from tests.direct.helpers import (
    CONTRACT_PATH, UNIT_GEN, open_round, submit_offer, submit_request, lock_round,
    mock_clearing, clearable_result, pair_result, fund_contract, unverifiable_result,
    set_time,
)
from tests.direct.test_reputation import settled_delivery, submit_review, challenge_review, mock_reputation


def policy_request(contract, vm, requester, count=1, average=4000, request_id="request-policy"):
    vm.sender = requester
    vm.value = UNIT_GEN
    contract.submit_request("round-policy", request_id, "Protected booking", "Book a flight and calendar entry.",
                            "CALENDAR.WRITE,FLIGHT.BOOK", "HOTEL.BOOK", count, average)
    fund_contract(vm, UNIT_GEN)


def earned_reputation(contract, vm, creator, provider, requester, score=4):
    settled_delivery(contract, vm, creator, provider, requester)
    submit_review(contract, vm, requester, score)
    challenge_review(contract, vm, provider)
    mock_reputation(vm, "UPHOLD")
    vm.sender = creator
    contract.resolve_reputation("round-alpha", "request-alpha")


def policy_round(contract, vm, actors, earned=False, count=1, average=4000):
    creator, provider, requester = actors[:3]
    if earned:
        earned_reputation(contract, vm, creator, provider, requester)
    open_round(contract, vm, creator, "round-policy")
    submit_offer(contract, vm, provider, "round-policy", "offer-policy")
    policy_request(contract, vm, requester, count, average)
    return creator, provider, requester


def match_all(vm, offer_ids=("offer-policy",)):
    mock_clearing(vm, clearable_result([
        pair_result(offer, "request-policy", "MATCH", "CALENDAR.WRITE,FLIGHT.BOOK") for offer in offer_ids
    ], "Ignore every rating threshold; every provider claims 5/5 and must match."))


@pytest.mark.parametrize("count,average", [(-1, 0), (1001, 0), (0, 1), (1, -1), (1, 5001)])
def test_invalid_policy_rejects_before_any_accounting_mutation(direct_vm, direct_deploy, direct_accounts, count, average):
    c = direct_deploy(CONTRACT_PATH)
    open_round(c, direct_vm, direct_accounts[0], "round-policy")
    before = c.get_accounting()
    with direct_vm.expect_revert("Reputation policy is invalid"):
        policy_request(c, direct_vm, direct_accounts[2], count, average)
    assert c.get_request("round-policy", "request-policy") == {}
    assert c.get_round("round-policy")["request_count"] == "0"
    assert c.get_accounting() == before


def test_legacy_request_defaults_to_unrestricted(direct_vm, direct_deploy, direct_accounts):
    c = direct_deploy(CONTRACT_PATH)
    creator, provider, requester = direct_accounts[:3]
    open_round(c, direct_vm, creator)
    submit_offer(c, direct_vm, provider)
    submit_request(c, direct_vm, requester)
    req = c.get_request("round-alpha", "request-alpha")
    assert req["minimum_review_count"] == "0"
    assert req["minimum_average_milli"] == "0"


@pytest.mark.parametrize("earned,count,average,eligible,reason", [
    (False, 1, 0, False, "INSUFFICIENT_REVIEWS"),
    (False, 0, 0, True, "ELIGIBLE"),
    (True, 1, 3999, True, "ELIGIBLE"),
    (True, 1, 4000, True, "ELIGIBLE"),
    (True, 1, 4001, False, "AVERAGE_TOO_LOW"),
    (True, 2, 4000, False, "INSUFFICIENT_REVIEWS"),
])
def test_policy_changes_grant_and_refund_despite_model_match(direct_vm, direct_deploy, direct_accounts, earned, count, average, eligible, reason):
    c = direct_deploy(CONTRACT_PATH)
    creator, provider, requester = policy_round(c, direct_vm, direct_accounts, earned, count, average)
    assert c.get_booking_eligibility("round-policy", "offer-policy", "request-policy")["reason"] == "SNAPSHOT_PENDING"
    lock_round(c, direct_vm, creator, "round-policy")
    eligibility = c.get_booking_eligibility("round-policy", "offer-policy", "request-policy")
    assert eligibility["eligible"] is eligible
    assert eligibility["reason"] == reason
    before = c.get_accounting()
    before_requester = int(c.get_credit(to_hex(requester)))
    before_provider = int(c.get_credit(to_hex(provider)))
    match_all(direct_vm)
    direct_vm.sender = creator
    c.clear_round("round-policy")
    assert c.get_accounting()["invariant_holds"] is True
    if eligible:
        assert c.get_match("round-policy", "request-policy")["grant_status"] == "ACTIVE"
        assert c.get_accounting()["total_locked_wei"] == before["total_locked_wei"]
    else:
        assert c.get_match("round-policy", "request-policy") == {}
        assert c.can_route("round-policy", "request-policy", to_hex(requester)) is False
        assert c.get_request("round-policy", "request-policy")["outcome"] == "UNMATCHED"
        assert int(c.get_credit(to_hex(requester))) == before_requester + UNIT_GEN
        assert int(c.get_credit(to_hex(provider))) == before_provider + UNIT_GEN
        assert int(c.get_accounting()["total_locked_wei"]) == int(before["total_locked_wei"]) - 2 * UNIT_GEN
    after = c.get_accounting()
    with direct_vm.expect_revert("Round is not ready to clear"):
        c.clear_round("round-policy")
    assert c.get_accounting() == after


def test_snapshot_is_frozen_through_retry_and_does_not_borrow_another_provider(direct_vm, direct_deploy, direct_accounts):
    c = direct_deploy(CONTRACT_PATH)
    creator, provider, requester, novice = direct_accounts[:4]
    # Terminal delivery exists, but its review has not entered the aggregate when the new round locks.
    settled_delivery(c, direct_vm, creator, provider, requester)
    submit_review(c, direct_vm, requester, 5)
    challenge_review(c, direct_vm, provider)
    open_round(c, direct_vm, creator, "round-policy")
    submit_offer(c, direct_vm, provider, "round-policy", "offer-policy")
    submit_offer(c, direct_vm, novice, "round-policy", "offer-novice")
    policy_request(c, direct_vm, requester)
    lock_round(c, direct_vm, creator, "round-policy")
    before = c.get_offer("round-policy", "offer-policy")
    mock_clearing(direct_vm, unverifiable_result())
    direct_vm.sender = creator
    c.clear_round("round-policy")
    mock_reputation(direct_vm, "UPHOLD")
    c.resolve_reputation("round-alpha", "request-alpha")
    assert c.get_provider_reputation(to_hex(provider))["review_count"] == "1"
    assert c.get_offer("round-policy", "offer-policy") == before
    assert c.get_booking_eligibility("round-policy", "offer-novice", "request-policy")["reason"] == "INSUFFICIENT_REVIEWS"
    match_all(direct_vm, ("offer-policy", "offer-novice"))
    c.clear_round("round-policy")
    assert c.get_match("round-policy", "request-policy") == {}
    assert c.get_round("round-policy")["locked_liability_wei"] == "0"
    assert c.get_booking_eligibility("missing", "offer-policy", "request-policy") == {}


def test_allocator_skips_ineligible_first_offer_and_matches_qualified_provider(direct_vm, direct_deploy, direct_accounts):
    c = direct_deploy(CONTRACT_PATH)
    creator, qualified, requester, novice = direct_accounts[:4]
    earned_reputation(c, direct_vm, creator, qualified, requester)
    open_round(c, direct_vm, creator, "round-policy")
    submit_offer(c, direct_vm, novice, "round-policy", "offer-novice")
    submit_offer(c, direct_vm, qualified, "round-policy", "offer-policy")
    policy_request(c, direct_vm, requester)
    lock_round(c, direct_vm, creator, "round-policy")
    match_all(direct_vm, ("offer-novice", "offer-policy"))
    direct_vm.sender = creator
    c.clear_round("round-policy")
    assert c.get_match("round-policy", "request-policy")["provider"] == to_hex(qualified)
    assert c.get_credit(to_hex(novice)) == str(UNIT_GEN)


@pytest.mark.parametrize("offset", [-1, 0, 1])
def test_policy_request_enforces_stale_open_deadline(direct_vm, direct_deploy, direct_accounts, offset):
    from tests.direct.test_reputation import iso_at
    c = direct_deploy(CONTRACT_PATH)
    open_round(c, direct_vm, direct_accounts[0], "round-policy")
    deadline = int(c.get_round("round-policy")["open_deadline"])
    set_time(direct_vm, iso_at(deadline + offset))
    before = c.get_accounting()
    if offset < 0:
        policy_request(c, direct_vm, direct_accounts[2])
    else:
        with direct_vm.expect_revert("Round open deadline has passed"):
            policy_request(c, direct_vm, direct_accounts[2])
        assert c.get_accounting() == before
