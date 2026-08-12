CONTRACT_PATH = "contracts/skill_slot_clearing.py"
UNIT_GEN = 10**18


def open_round(contract, vm, creator, round_id="round-alpha", title="Agent access morning window"):
    vm.sender = creator
    vm.value = 0
    contract.open_round(round_id, title, UNIT_GEN, UNIT_GEN)
