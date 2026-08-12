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
        "get_round",
        "get_offer",
        "get_request",
        "get_accounting",
        "get_round_ids",
    }.issubset(methods)
    assert "TODO" not in source
    assert "placeholder" not in source.lower()

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name not in {"clear_round", "_run_clearing_consensus"}:
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
