import fs from "fs";
import { createRequire } from "module";
import path from "path";
import vm from "vm";
import ts from "typescript";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const helperPath = path.join(repoRoot, "src/lib/short-form-visual-dependencies.ts");
const helperSource = fs.readFileSync(helperPath, "utf-8");

const { outputText } = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: helperPath,
});

const cjsModule = { exports: {} };
vm.runInNewContext(outputText, {
  exports: cjsModule.exports,
  module: cjsModule,
  require,
}, { filename: helperPath });

const { buildVisualDependencyTree } = cjsModule.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectSceneNumbers(node, numbers = []) {
  numbers.push(node.scene.number);
  for (const child of node.children) {
    collectSceneNumbers(child, numbers);
  }
  return numbers;
}

const scenes = [
  {
    id: "scene-1",
    number: 1,
    caption: "Snatched jawline hook",
    visualType: "image",
    visualId: "visual-1",
    imageId: "hook-jawline-closeup",
  },
  {
    id: "scene-9",
    number: 9,
    caption: "Open mouth shape",
    visualType: "image",
    visualId: "visual-9",
    imageId: "exercise-open-mouth",
    basedOnImageId: "visual-1",
    xmlBasedOn: "visual-1",
  },
  {
    id: "scene-10",
    number: 10,
    caption: "Lower lip fold",
    visualType: "image",
    visualId: "visual-10",
    imageId: "exercise-lower-lip-fold",
    basedOnImageId: "exercise-open-mouth",
    xmlBasedOn: "exercise-open-mouth",
  },
  {
    id: "scene-11",
    number: 11,
    caption: "Jaw forward",
    visualType: "image",
    visualId: "visual-11",
    imageId: "exercise-jaw-forward",
    basedOnImageId: "exercise-lower-lip-fold",
    xmlBasedOn: "exercise-lower-lip-fold",
  },
  {
    id: "scene-14",
    number: 14,
    caption: "Open and repeat",
    visualType: "image",
    visualId: "visual-14",
    imageId: "exercise-open-mouth",
    basedOnImageId: "visual-1",
    reusedExistingAsset: true,
    xmlBasedOn: "",
  },
  {
    id: "scene-15",
    number: 15,
    caption: "Derived from repeat",
    visualType: "image",
    visualId: "visual-15",
    imageId: "derived-from-repeat",
    basedOnImageId: "visual-14",
    xmlBasedOn: "visual-14",
  },
];

const visual10Tree = buildVisualDependencyTree(scenes, scenes[2]);
assert(visual10Tree.root.scene.number === 1, `Visual 10 root should be Visual 1, got Visual ${visual10Tree.root.scene.number}`);
assert(visual10Tree.root.children[0]?.scene.number === 9, "Visual 10 should be under Visual 9, not Visual 14");
assert(visual10Tree.root.children[0]?.children[0]?.scene.number === 10, "Visual 10 should appear below its actual Visual 9 parent");
assert(!collectSceneNumbers(visual10Tree.root).includes(14), "Visual 14 exact reuse must not hijack Visual 10's image-id parent");

const visual9Tree = buildVisualDependencyTree(scenes, scenes[1]);
const visual9TreeNumbers = collectSceneNumbers(visual9Tree.root);
assert(visual9TreeNumbers.includes(10), "Visual 9 should show Visual 10 as a based-on dependent");
assert(!visual9TreeNumbers.includes(14), "Visual 9's based-on dependents should not include exact reuse Visual 14");

const visual15Tree = buildVisualDependencyTree(scenes, scenes[5]);
assert(visual15Tree.root.scene.number === 14, "A basedOn reference to visual-14 should resolve to Visual 14 by visual id");
assert(visual15Tree.root.children[0]?.scene.number === 15, "Visual 15 should appear below its explicit Visual 14 parent");

console.log("Short-form visual dependency tree verification passed.");
