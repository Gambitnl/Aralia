/**
 * This file protects Vite's configuration from the 3D creature implementation graph.
 *
 * Vite imports the Dev Hub manager while starting the development server. This test walks
 * every ordinary source import and every literal lazy import reachable from that manager.
 * It fails if those configuration-visible paths ever enter src/systems/entities3d, while
 * separately proving that the opaque creature route remains wired for matching requests.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Configuration Dependency Walker
// ============================================================================
// This section mirrors the dependency shapes Vite can discover without executing a request:
// source imports and import() calls whose target is a literal string. Variable-held runtime
// URLs intentionally do not appear, because Vite cannot turn them into watched config files.
// ============================================================================

function resolveLocalModule(importer: string, specifier: string): string | null {
  // Package and Node built-in imports cannot lead into the repository's entity source tree.
  if (!specifier.startsWith('.')) return null;

  const unresolved = path.resolve(path.dirname(importer), specifier);
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [`${unresolved}.ts`, path.join(unresolved, 'index.ts')];

  // Follow only checked-in TypeScript modules represented in this focused config graph.
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function literalRuntimeDependencies(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  // Collect imports that survive compilation. Type-only imports describe shapes but do not
  // load files, so they correctly stay outside the runtime configuration dependency graph.
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node)
      && !node.importClause?.isTypeOnly
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    // A literal import() is lazy at request time but remains visible to Vite's config scanner.
    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function configurationGraph(rootFile: string): string[] {
  const pending = [rootFile];
  const visited = new Set<string>();

  // Walk each local dependency once. This keeps cycles harmless and produces a stable set
  // that can be checked for accidental entry into the game entity implementation.
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    for (const specifier of literalRuntimeDependencies(current)) {
      const dependency = resolveLocalModule(current, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return [...visited];
}

// ============================================================================
// WF-G63 Regression Proof
// ============================================================================
// The first assertion covers the whole manager-visible graph. The remaining assertions make
// sure the repair did not achieve isolation by silently removing the creature route.
// ============================================================================

describe('Dev Hub creature route configuration boundary', () => {
  it('keeps the config-visible manager graph outside the 3D entity system', () => {
    const managerPath = path.resolve(process.cwd(), 'scripts/vite-plugins/devHubApiManager.ts');
    const reachableFiles = configurationGraph(managerPath);
    const managerSource = readFileSync(managerPath, 'utf8');

    expect(reachableFiles.filter((file) => file.includes(`${path.sep}src${path.sep}systems${path.sep}entities3d${path.sep}`))).toEqual([]);
    expect(managerSource).toContain('scripts/vite-plugins/devhub/creaturePlanRoutes.ts');
    expect(managerSource).toContain('import(/* @vite-ignore */ moduleUrl)');
    expect(managerSource).toContain("urlPath === '/devhub/api/creature-plan'");
  });
});
