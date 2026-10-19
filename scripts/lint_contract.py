"""Add v0.3 spelling recognition to linter RC2; never suppress a rule or edit vendor code."""
import ast
from genvm_linter.lint import safety, structure
from genvm_linter.cli import main

safety.SafeEntryPointFinder.SAFE_PATTERNS["gl.vm.run_nondet_default"] = [0, 1]
safety.NONDET_SPAWN_CALLS = safety.NONDET_SPAWN_CALLS | {"gl.vm.run_nondet_default"}
safety.CONTRACT_ACCESS_CALLS = safety.CONTRACT_ACCESS_CALLS | {"gl.contract.get_at"}
original_visit = structure.StorageClassChecker.visit_ClassDef


def visit_storage(self, node):
    if any(ast.unparse(d) == "gl.storage.allow" for d in node.decorator_list):
        self.allow_storage_classes.add(node.name)
    original_visit(self, node)


structure.StorageClassChecker.visit_ClassDef = visit_storage
if __name__ == "__main__":
    main()
