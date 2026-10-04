from datetime import datetime, timezone

from tests.direct.conftest import to_hex
from tests.direct.helpers import CONTRACT_PATH, set_time
from tests.direct.test_delivery_settlement import DELIVERY, cleared_delivery


REVIEW = "The delivered itinerary satisfied the locked booking need with complete timing details."
RESPONSE = "The score omits the confirmed calendar entry and the exact flight identifier in the artifact."


def iso_at(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def settled_delivery(contract, vm, creator, provider, requester):
    cleared_delivery(contract, vm, creator, provider, requester)
    vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    vm.sender = requester
    contract.accept_delivery("round-alpha", "request-alpha")
    return contract.get_accounting()


def submit_review(contract, vm, requester, score: int = 4):
    vm.sender = requester
    contract.submit_reputation("round-alpha", "request-alpha", score, REVIEW)
    return contract.get_reputation("round-alpha", "request-alpha")


def challenge_review(contract, vm, provider):
    vm.sender = provider
    contract.challenge_reputation("round-alpha", "request-alpha", RESPONSE)
    return contract.get_reputation("round-alpha", "request-alpha")


def mock_reputation(vm, verdict: str, reason: str = "The review is supported by the bounded delivery record."):
    vm.clear_mocks()
    vm.mock_llm(
        r"(?s).*SkillSlot reputation dispute adjudicator.*",
        '{"verdict":"' + verdict + '","reason":"' + reason + '"}',
    )


def test_requester_submits_one_review_only_after_terminal_delivery(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, stranger = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    cleared_delivery(contract, direct_vm, creator, provider, requester)

    direct_vm.sender = requester
    with direct_vm.expect_revert("Delivery must be settled before reputation"):
        contract.submit_reputation("round-alpha", "request-alpha", 4, REVIEW)

    direct_vm.sender = provider
    contract.submit_delivery("round-alpha", "request-alpha", DELIVERY)
    direct_vm.sender = requester
    contract.accept_delivery("round-alpha", "request-alpha")
    accounting = contract.get_accounting()

    direct_vm.sender = stranger
    with direct_vm.expect_revert("Only matched requester can submit reputation"):
        contract.submit_reputation("round-alpha", "request-alpha", 4, REVIEW)

    review = submit_review(contract, direct_vm, requester)
    assert review["status"] == "PENDING"
    assert review["score"] == "4"
    assert len(review["evidence_digest"]) == 64
    assert int(review["recovery_at"]) > int(review["challenge_deadline"])
    assert contract.get_accounting() == accounting

    with direct_vm.expect_revert("Reputation review already exists"):
        contract.submit_reputation("round-alpha", "request-alpha", 5, REVIEW)


def test_review_validates_score_and_bounded_evidence(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester = direct_accounts[:3]
    contract = direct_deploy(CONTRACT_PATH)
    settled_delivery(contract, direct_vm, creator, provider, requester)
    direct_vm.sender = requester

    for score in (0, 6):
        with direct_vm.expect_revert("Reputation score must be between 1 and 5"):
            contract.submit_reputation("round-alpha", "request-alpha", score, REVIEW)
    with direct_vm.expect_revert("Reputation evidence is invalid"):
        contract.submit_reputation("round-alpha", "request-alpha", 4, "short")


def test_unchallenged_review_finalizes_permissionlessly_at_exact_boundary(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    accounting = settled_delivery(contract, direct_vm, creator, provider, requester)
    review = submit_review(contract, direct_vm, requester, 5)
    deadline = int(review["challenge_deadline"])

    direct_vm.sender = caller
    set_time(direct_vm, iso_at(deadline - 1))
    with direct_vm.expect_revert("Reputation challenge deadline has not passed"):
        contract.finalize_reputation("round-alpha", "request-alpha")
    set_time(direct_vm, iso_at(deadline))
    contract.finalize_reputation("round-alpha", "request-alpha")

    assert contract.get_reputation("round-alpha", "request-alpha")["status"] == "FINALIZED"
    assert contract.get_provider_reputation(to_hex(provider)) == {
        "provider": to_hex(provider),
        "review_count": "1",
        "score_total": "5",
        "average_milli": "5000",
        "overturned_count": "0",
    }
    assert contract.get_accounting() == accounting
    with direct_vm.expect_revert("Reputation review is not pending"):
        contract.finalize_reputation("round-alpha", "request-alpha")


def test_only_provider_can_challenge_before_exclusive_deadline(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, stranger = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    settled_delivery(contract, direct_vm, creator, provider, requester)
    review = submit_review(contract, direct_vm, requester)
    deadline = int(review["challenge_deadline"])

    direct_vm.sender = stranger
    with direct_vm.expect_revert("Only matched provider can challenge reputation"):
        contract.challenge_reputation("round-alpha", "request-alpha", RESPONSE)
    direct_vm.sender = provider
    set_time(direct_vm, iso_at(deadline - 1))
    challenged = challenge_review(contract, direct_vm, provider)
    assert challenged["status"] == "CHALLENGED"
    assert len(challenged["response_digest"]) == 64



def test_provider_challenge_rejects_at_exact_deadline(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester = direct_accounts[:3]
    contract = direct_deploy(CONTRACT_PATH)
    settled_delivery(contract, direct_vm, creator, provider, requester)
    review = submit_review(contract, direct_vm, requester)
    set_time(direct_vm, iso_at(int(review["challenge_deadline"])))
    direct_vm.sender = provider
    with direct_vm.expect_revert("Reputation challenge deadline has passed"):
        contract.challenge_reputation("round-alpha", "request-alpha", RESPONSE)


def test_validator_upholds_review_and_counts_score_once(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    accounting = settled_delivery(contract, direct_vm, creator, provider, requester)
    submit_review(contract, direct_vm, requester, 4)
    challenge_review(contract, direct_vm, provider)
    mock_reputation(direct_vm, "UPHOLD")
    direct_vm.sender = caller

    assert contract.resolve_reputation("round-alpha", "request-alpha")["verdict"] == "UPHOLD"
    assert contract.get_reputation("round-alpha", "request-alpha")["status"] == "FINALIZED"
    assert contract.get_provider_reputation(to_hex(provider))["average_milli"] == "4000"
    assert contract.get_accounting() == accounting
    with direct_vm.expect_revert("Reputation dispute is not reviewable"):
        contract.resolve_reputation("round-alpha", "request-alpha")


def test_validator_overturns_unsupported_review_without_counting_score(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    settled_delivery(contract, direct_vm, creator, provider, requester)
    submit_review(contract, direct_vm, requester, 1)
    challenge_review(contract, direct_vm, provider)
    mock_reputation(direct_vm, "OVERTURN", "The score conflicts with the bounded artifact and outcome.")
    direct_vm.sender = caller

    assert contract.resolve_reputation("round-alpha", "request-alpha")["verdict"] == "OVERTURN"
    assert contract.get_reputation("round-alpha", "request-alpha")["status"] == "OVERTURNED"
    assert contract.get_provider_reputation(to_hex(provider))["review_count"] == "0"
    assert contract.get_provider_reputation(to_hex(provider))["overturned_count"] == "1"


def test_unverifiable_dispute_is_retryable_then_permissionlessly_void(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    accounting = settled_delivery(contract, direct_vm, creator, provider, requester)
    submit_review(contract, direct_vm, requester)
    review = challenge_review(contract, direct_vm, provider)
    recovery_at = int(review["recovery_at"])
    mock_reputation(direct_vm, "UNVERIFIABLE", "The bounded evidence is contradictory.")
    direct_vm.sender = caller
    assert contract.resolve_reputation("round-alpha", "request-alpha")["verdict"] == "UNVERIFIABLE"
    assert contract.get_reputation("round-alpha", "request-alpha")["status"] == "RETRYABLE"

    set_time(direct_vm, iso_at(recovery_at - 1))
    with direct_vm.expect_revert("Reputation recovery deadline has not passed"):
        contract.recover_reputation("round-alpha", "request-alpha")
    set_time(direct_vm, iso_at(recovery_at))
    with direct_vm.expect_revert("Reputation recovery deadline has passed"):
        contract.resolve_reputation("round-alpha", "request-alpha")
    contract.recover_reputation("round-alpha", "request-alpha")

    assert contract.get_reputation("round-alpha", "request-alpha")["status"] == "VOID"
    assert contract.get_provider_reputation(to_hex(provider))["review_count"] == "0"
    assert contract.get_accounting() == accounting
    with direct_vm.expect_revert("Reputation dispute is already closed"):
        contract.recover_reputation("round-alpha", "request-alpha")


def test_malformed_reputation_judgment_is_retryable_and_preserves_aggregate(direct_vm, direct_deploy, direct_accounts):
    creator, provider, requester, caller = direct_accounts[:4]
    contract = direct_deploy(CONTRACT_PATH)
    settled_delivery(contract, direct_vm, creator, provider, requester)
    submit_review(contract, direct_vm, requester)
    challenge_review(contract, direct_vm, provider)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"(?s).*SkillSlot reputation dispute adjudicator.*", "not-json")
    direct_vm.sender = caller

    result = contract.resolve_reputation("round-alpha", "request-alpha")
    assert result["verdict"] == "UNVERIFIABLE"
    assert contract.get_reputation("round-alpha", "request-alpha")["attempt_count"] == "1"
    assert contract.get_provider_reputation(to_hex(provider))["review_count"] == "0"
