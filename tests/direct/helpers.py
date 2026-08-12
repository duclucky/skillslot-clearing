import json


CONTRACT_PATH = "contracts/skill_slot_clearing.py"
UNIT_GEN = 10**18


def open_round(contract, vm, creator, round_id="round-alpha", title="Agent access morning window"):
    vm.sender = creator
    vm.value = 0
    contract.open_round(round_id, title, UNIT_GEN, UNIT_GEN)


def fund_contract(vm, value):
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + value)
    vm.value = 0


def submit_offer(
    contract,
    vm,
    provider,
    round_id="round-alpha",
    offer_id="offer-alpha",
    label="Calendar booking agent",
    promise_text="Books flights and calendar slots with confirmed availability.",
    capability_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK",
    value=UNIT_GEN,
):
    vm.sender = provider
    vm.value = value
    contract.submit_offer(round_id, offer_id, label, promise_text, capability_ids_csv)
    fund_contract(vm, value)


def submit_request(
    contract,
    vm,
    requester,
    round_id="round-alpha",
    request_id="request-alpha",
    label="Flight scheduling need",
    need_text="Reserve a flight and place it on my calendar without hotel booking.",
    required_ids_csv="CALENDAR.WRITE,FLIGHT.BOOK",
    excluded_ids_csv="HOTEL.BOOK",
    value=UNIT_GEN,
):
    vm.sender = requester
    vm.value = value
    contract.submit_request(
        round_id,
        request_id,
        label,
        need_text,
        required_ids_csv,
        excluded_ids_csv,
    )
    fund_contract(vm, value)


def lock_round(contract, vm, creator, round_id="round-alpha"):
    vm.sender = creator
    vm.value = 0
    contract.lock_round(round_id)


def mock_clearing(vm, result):
    vm.clear_mocks()
    vm.mock_llm(
        r"(?s).*SkillSlot Clearing semantic batch adjudicator.*",
        result if isinstance(result, str) else json.dumps(result),
    )


def pair_result(offer_id, request_id, decision, required_ids_csv="", prohibited_ids_csv=""):
    required = [item for item in required_ids_csv.split(",") if item]
    if decision == "MATCH":
        matched = ",".join(required)
        missing = ""
        prohibited = ""
    else:
        matched = ""
        missing = ",".join(required)
        prohibited = prohibited_ids_csv
    return {
        "offer_id": offer_id,
        "request_id": request_id,
        "decision": decision,
        "matched_ids_csv": matched,
        "missing_ids_csv": missing,
        "prohibited_ids_csv": prohibited,
    }


def clearable_result(pairs, reason="The bounded compatibility graph is complete."):
    return {"verdict": "CLEARABLE", "pairs": pairs, "reason": reason}


def unverifiable_result(reason="The semantic evidence could not be resolved consistently."):
    return {"verdict": "UNVERIFIABLE", "pairs": [], "reason": reason}
