import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "skill_slot_clearing.py"
EXPECTED_HEADER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'


def _source() -> str:
    return CONTRACT.read_bytes().decode("ascii")


def _tree() -> ast.Module:
    return ast.parse(_source())


def test_contract_is_ascii_and_uses_locked_header():
    lines = _source().splitlines()
    assert lines[0] == EXPECTED_HEADER
    assert lines[1] == "from genlayer import *"


def test_contract_has_one_named_contract_class_and_explicit_init():
    contract_classes = [
        node
        for node in _tree().body
        if isinstance(node, ast.ClassDef)
        and any(isinstance(base, ast.Attribute) and base.attr == "Contract" for base in node.bases)
    ]
    assert [node.name for node in contract_classes] == ["Contract"]
    assert any(isinstance(node, ast.FunctionDef) and node.name == "__init__" for node in contract_classes[0].body)


def test_init_does_not_reassign_storage_collections():
    contract_class = next(node for node in _tree().body if isinstance(node, ast.ClassDef) and node.name == "Contract")
    init = next(node for node in contract_class.body if isinstance(node, ast.FunctionDef) and node.name == "__init__")
    rendered = ast.unparse(init)
    assert "TreeMap(" not in rendered
    assert "DynArray(" not in rendered


def test_all_treemap_keys_are_str_and_records_are_storage_dataclasses():
    tree = _tree()
    treemap_annotations = [
        node.annotation
        for node in ast.walk(tree)
        if isinstance(node, ast.AnnAssign)
        and isinstance(node.annotation, ast.Subscript)
        and isinstance(node.annotation.value, ast.Name)
        and node.annotation.value.id == "TreeMap"
    ]
    assert treemap_annotations
    assert all(isinstance(annotation.slice, ast.Tuple) and ast.unparse(annotation.slice.elts[0]) == "str" for annotation in treemap_annotations)

    storage_records = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name in {"Round", "Offer", "Request", "Match"}]
    assert {node.name for node in storage_records} == {"Round", "Offer", "Request", "Match"}
    for record in storage_records:
        decorators = {ast.unparse(item) for item in record.decorator_list}
        assert decorators == {"allow_storage", "dataclass"}


def test_position_public_surface_and_nondeterminism_boundary_are_locked():
    source = _source()
    tree = _tree()
    contract_class = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Contract")
    methods = {node.name for node in contract_class.body if isinstance(node, ast.FunctionDef)}
    assert {
        "open_round",
        "submit_offer",
        "submit_request",
        "lock_round",
        "clear_round",
        "cancel_round",
        "recover_expired_round",
        "consume_grant",
        "withdraw_credit",
        "get_round",
        "get_offer",
        "get_request",
        "get_match",
        "can_route",
        "get_credit",
        "get_accounting",
        "get_round_ids",
    }.issubset(methods)
    assert "TODO" not in source
    assert "placeholder" not in source.lower()

    top_level_functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    contract_methods = [node for node in contract_class.body if isinstance(node, ast.FunctionDef)]
    for node in top_level_functions + contract_methods:
        if node.name != "clear_round" and node.name != "_verify_agent_metadata":
            rendered = ast.unparse(node)
            assert "gl.nondet" not in rendered
            assert "gl.vm.run_nondet" not in rendered


def test_only_value_receiving_position_methods_are_payable():
    tree = _tree()
    contract_class = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Contract")
    methods = {
        node.name: node
        for node in contract_class.body
        if isinstance(node, ast.FunctionDef)
    }
    for method_name in ("submit_offer", "submit_request"):
        decorators = {ast.unparse(item) for item in methods[method_name].decorator_list}
        assert "gl.public.write.payable" in decorators
        assert "gl.message.value" in ast.unparse(methods[method_name])

    for method_name in ("open_round", "lock_round"):
        decorators = {ast.unparse(item) for item in methods[method_name].decorator_list}
        assert "gl.public.write" in decorators
        assert "gl.public.write.payable" not in decorators


def test_clear_round_uses_bounded_custom_semantic_consensus():
    source = _source()
    assert "gl.vm.run_nondet(" in source
    assert "gl.nondet.exec_prompt(" in source
    assert 'response_format="json"' in source
    assert "isinstance(leader_result, gl.vm.Return)" in source
    assert "_normalize_clearing" in source
    assert "_critical_fingerprint" in source
    assert "attempt_fingerprints: TreeMap[str, str]" in source


def test_withdrawal_uses_external_recipient_and_debits_before_transfer():
    tree = _tree()
    contract_class = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Contract")
    method = next(node for node in contract_class.body if isinstance(node, ast.FunctionDef) and node.name == "withdraw_credit")
    rendered = ast.unparse(method)
    assert rendered.index("self.credits[account]") < rendered.index("_ExternalRecipient(sender).emit_transfer")
    assert "_ExternalRecipient(sender).emit_transfer(value=u256(requested))" in rendered
    assert "gl.eth" not in rendered
