export interface VisualDependencyScene {
  id: string;
  number: number;
  caption: string;
  visualType?: "image" | "motion_graphic";
  imageId?: string;
  basedOnImageId?: string;
  reusedExistingAsset?: boolean;
  visualId?: string;
  xmlBasedOn?: string;
}

export interface VisualDependencyTreeNode<TScene extends VisualDependencyScene = VisualDependencyScene> {
  scene: TScene;
  relation: "ancestor" | "current" | "descendant";
  children: Array<VisualDependencyTreeNode<TScene>>;
}

export interface VisualDependencyTree<TScene extends VisualDependencyScene = VisualDependencyScene> {
  root: VisualDependencyTreeNode<TScene>;
  hasAncestors: boolean;
  hasDescendants: boolean;
}

function getImageVisualBasedOnValue(scene: VisualDependencyScene): string {
  if (scene.xmlBasedOn !== undefined) {
    return scene.xmlBasedOn;
  }
  if (scene.reusedExistingAsset) {
    return "";
  }
  return scene.basedOnImageId ?? "";
}

function addReferenceIfMissing<TScene extends VisualDependencyScene>(
  sceneByReference: Map<string, TScene>,
  value: string | undefined,
  scene: TScene,
) {
  if (!value || sceneByReference.has(value)) {
    return;
  }
  sceneByReference.set(value, scene);
}

function buildSceneReferenceIndex<TScene extends VisualDependencyScene>(
  imageScenes: TScene[],
) {
  const sceneByReference = new Map<string, TScene>();

  for (const scene of imageScenes) {
    addReferenceIfMissing(sceneByReference, scene.visualId, scene);
    addReferenceIfMissing(sceneByReference, scene.id, scene);

    if (!scene.reusedExistingAsset) {
      addReferenceIfMissing(sceneByReference, scene.imageId, scene);
    }
  }

  return sceneByReference;
}

export function buildVisualDependencyTree<TScene extends VisualDependencyScene>(
  scenes: TScene[],
  currentScene: TScene,
): VisualDependencyTree<TScene> {
  const imageScenes = scenes.filter(
    (scene) => scene.visualType !== "motion_graphic",
  );
  const sceneByReference = buildSceneReferenceIndex(imageScenes);

  const getParent = (scene: TScene): TScene | undefined => {
    const basedOn = getImageVisualBasedOnValue(scene).trim();
    if (!basedOn) {
      return undefined;
    }
    const parent = sceneByReference.get(basedOn);
    return parent && parent.id !== scene.id ? parent : undefined;
  };

  const childrenByParentId = new Map<string, TScene[]>();
  for (const scene of imageScenes) {
    const parent = getParent(scene);
    if (!parent) {
      continue;
    }
    const children = childrenByParentId.get(parent.id) ?? [];
    children.push(scene);
    childrenByParentId.set(parent.id, children);
  }

  const buildDescendants = (
    scene: TScene,
    visited: Set<string>,
  ): Array<VisualDependencyTreeNode<TScene>> => {
    const children = childrenByParentId.get(scene.id) ?? [];
    return children
      .filter((child) => !visited.has(child.id))
      .map((child) => {
        const nextVisited = new Set(visited);
        nextVisited.add(child.id);
        return {
          scene: child,
          relation: "descendant" as const,
          children: buildDescendants(child, nextVisited),
        };
      });
  };

  const ancestorScenes: TScene[] = [];
  const ancestorVisited = new Set<string>([currentScene.id]);
  let parent = getParent(currentScene);
  while (parent && !ancestorVisited.has(parent.id)) {
    ancestorScenes.unshift(parent);
    ancestorVisited.add(parent.id);
    parent = getParent(parent);
  }

  const currentDescendants = buildDescendants(
    currentScene,
    new Set([currentScene.id]),
  );

  let root: VisualDependencyTreeNode<TScene> = {
    scene: currentScene,
    relation: "current",
    children: currentDescendants,
  };

  for (const ancestor of [...ancestorScenes].reverse()) {
    root = {
      scene: ancestor,
      relation: "ancestor",
      children: [root],
    };
  }

  return {
    root,
    hasAncestors: ancestorScenes.length > 0,
    hasDescendants: currentDescendants.length > 0,
  };
}
