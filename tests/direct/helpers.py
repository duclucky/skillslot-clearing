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
